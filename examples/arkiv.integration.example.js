import assert from "node:assert/strict"
import { after, test } from "node:test"

import { createPublicClient, createWalletClient, http } from "@arkiv-network/sdk"
import { localhost } from "@arkiv-network/sdk/chains"
import { GenericContainer, Wait } from "testcontainers"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"

// Copy this file into your own project and rename it to something like:
// test/my-feature.integration.test.js

const localWritePrivateKey = generatePrivateKey()
const localWriteAccount = privateKeyToAccount(localWritePrivateKey)
const containerStartupErrorPattern = /docker|container|podman|socket|No such container/i
let localIntegrationContextPromise
let localIntegrationContainer

function isConnectivityError(error) {
  const messages = [
    error?.message,
    error?.shortMessage,
    error?.details,
    error?.cause?.message,
    error?.cause?.code,
  ]
    .filter(Boolean)
    .join(" ")

  return /ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|ETIMEDOUT|fetch failed|HTTP request failed/i.test(
    messages,
  )
}

async function launchLocalArkivNode(accountPrivateKey = undefined) {
  const container = await new GenericContainer("golemnetwork/arkiv-op-geth:latest")
    .withExposedPorts(8545, 8546)
    .withCommand([
      "--http",
      "--http.addr",
      "0.0.0.0",
      "--http.port",
      "8545",
      "--http.api",
      "eth,net,web3,debug,golembase,arkiv",
      "--http.corsdomain",
      "*",
      "--ws",
      "--ws.addr",
      "0.0.0.0",
      "--ws.port",
      "8546",
      "--ws.api",
      "eth,net,web3,debug,golembase,arkiv",
      "--ws.origins",
      "*",
      "--networkid",
      "1",
      "--dev",
      "--allow-insecure-unlock",
    ])
    .withWaitStrategy(Wait.forLogMessage("HTTP server started", 1))
    .withStartupTimeout(30_000)
    .withEnvironment({
      WALLET_PASSWORD: "password",
    })
    .start()

  if (accountPrivateKey) {
    await execCommand(container, [
      "golembase",
      "account",
      "import",
      "--privatekey",
      accountPrivateKey,
    ])
    await execCommand(container, ["golembase", "account", "fund"])
  }

  return {
    container,
    httpPort: container.getMappedPort(8545),
  }
}

async function execCommand(container, command) {
  const result = await container.exec(command)

  if (result.exitCode !== 0) {
    throw new Error(`Command failed (${result.exitCode}): ${command.join(" ")}\n${result.output}`)
  }

  return result.output
}

async function getIntegrationContext() {
  if (!localIntegrationContextPromise) {
    localIntegrationContextPromise = (async () => {
      let localNode

      try {
        localNode = await launchLocalArkivNode(localWritePrivateKey)
        localIntegrationContainer = localNode.container

        const rpcUrl = `http://${localNode.container.getHost()}:${localNode.httpPort}`
        return {
          client: createPublicClient({
            chain: localhost,
            transport: http(rpcUrl),
          }),
          walletClient: createWalletClient({
            account: localWriteAccount,
            chain: localhost,
            transport: http(rpcUrl),
          }),
        }
      } catch (error) {
        await localNode?.container?.stop().catch(() => {})
        throw error
      }
    })()
  }

  return localIntegrationContextPromise
}

async function runIntegrationStep(t, action) {
  try {
    return await action()
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)

    if (isConnectivityError(error)) {
      t.skip(`Local Arkiv node is unreachable from this environment. ${errorMessage}`)
      return undefined
    }

    if (containerStartupErrorPattern.test(errorMessage)) {
      t.skip(`Local Arkiv node could not be started in this environment. ${errorMessage}`)
      return undefined
    }

    throw error
  }
}

after(async () => {
  await localIntegrationContainer?.stop().catch(() => {})
})

test("reads the local Arkiv chain ID", async (t) => {
  const { client } = (await runIntegrationStep(t, () => getIntegrationContext())) ?? {}
  if (!client) return

  const chainId = await runIntegrationStep(t, () => client.getChainId())
  if (chainId === undefined) return

  assert.equal(chainId, localhost.id)
})

test("creates and reads back an entity with a custom payload", async (t) => {
  const context = await runIntegrationStep(t, () => getIntegrationContext())
  if (!context) return

  const { client, walletClient } = context
  const recordId = `customer-record-${Date.now()}`
  const payload = {
    id: recordId,
    customerEmail: "customer@example.com",
    source: "my-app",
  }

  const createdEntity = await runIntegrationStep(t, () =>
    walletClient.createEntity({
      payload: new TextEncoder().encode(JSON.stringify(payload)),
      attributes: [{ key: "recordId", value: recordId }],
      contentType: "application/json",
      expiresIn: 600,
    }),
  )
  if (createdEntity === undefined) return

  const entity = await runIntegrationStep(t, () => client.getEntity(createdEntity.entityKey))
  if (entity === undefined) return

  assert.equal(entity.key, createdEntity.entityKey)
  assert.equal(entity.contentType, "application/json")
  assert.equal(entity.toJson().id, recordId)
  assert.equal(entity.toJson().customerEmail, payload.customerEmail)
  assert.ok(entity.attributes.some((attribute) => attribute.key === "recordId" && attribute.value === recordId))
})
