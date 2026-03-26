import assert from "node:assert/strict"
import { after, test } from "node:test"

import { createPublicClient, createWalletClient, http } from "@arkiv-network/sdk"
import { localhost } from "@arkiv-network/sdk/chains"
import { GenericContainer, Wait } from "testcontainers"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"

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
    wsPort: container.getMappedPort(8546),
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
          rpcUrl,
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
    if (isConnectivityError(error)) {
      const errorMessage = error instanceof Error ? error.message : String(error)

      t.skip(`Local Arkiv node is unreachable from this environment. ${errorMessage}`)

      return undefined
    }

    if (containerStartupErrorPattern.test(String(error))) {
      const errorMessage = error instanceof Error ? error.message : String(error)

      t.skip(`Local Arkiv node could not be started in this environment. ${errorMessage}`)

      return undefined
    }

    throw error
  }
}

function isPositiveBlockHeight(value) {
  if (typeof value === "bigint") return value > 0n
  if (typeof value === "number") return Number.isInteger(value) && value > 0

  return false
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

test("accepts block heights returned as bigint or number", () => {
  assert.equal(isPositiveBlockHeight(1n), true)
  assert.equal(isPositiveBlockHeight(1), true)
  assert.equal(isPositiveBlockHeight(0n), false)
  assert.equal(isPositiveBlockHeight(0), false)
  assert.equal(isPositiveBlockHeight(1.5), false)
})

test("reads block timing from a local Arkiv node", async (t) => {
  const { client } = (await runIntegrationStep(t, () => getIntegrationContext())) ?? {}
  if (!client) return

  const blockTiming = await runIntegrationStep(t, () => client.getBlockTiming())
  if (blockTiming === undefined) return

  assert.ok(["bigint", "number"].includes(typeof blockTiming.currentBlock))
  assert.equal(typeof blockTiming.currentBlockTime, "number")
  assert.equal(typeof blockTiming.blockDuration, "number")
  assert.ok(isPositiveBlockHeight(blockTiming.currentBlock))
  assert.ok(blockTiming.currentBlockTime > 0)
  assert.ok(blockTiming.blockDuration > 0)
})

test("creates and reads back an entity on a local Arkiv node", async (t) => {
  const context = await runIntegrationStep(t, () => getIntegrationContext())
  if (!context) return

  const { client, walletClient } = context
  const writeTestId = `write-test-${Date.now()}`
  const payload = { id: writeTestId, source: "arkiv-js-sdk-test" }

  const createdEntity = await runIntegrationStep(t, () =>
    walletClient.createEntity({
      payload: new TextEncoder().encode(JSON.stringify(payload)),
      attributes: [{ key: "testRunId", value: writeTestId }],
      contentType: "application/json",
      expiresIn: 600,
    }),
  )
  if (createdEntity === undefined) return

  assert.match(createdEntity.entityKey, /^0x[0-9a-f]+$/i)
  assert.match(createdEntity.txHash, /^0x[0-9a-f]+$/i)

  const entity = await runIntegrationStep(t, () => client.getEntity(createdEntity.entityKey))
  if (entity === undefined) return

  assert.equal(entity.key, createdEntity.entityKey)
  assert.equal(entity.contentType, "application/json")
  assert.equal(entity.toJson().id, writeTestId)
  assert.ok(entity.attributes.some((attribute) => attribute.key === "testRunId" && attribute.value === writeTestId))
})
