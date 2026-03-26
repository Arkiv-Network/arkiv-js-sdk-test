import assert from "node:assert/strict"
import test from "node:test"

import { createPublicClient, createWalletClient, http } from "@arkiv-network/sdk"
import { kaolin } from "@arkiv-network/sdk/chains"
import { privateKeyToAccount } from "viem/accounts"

const rpcUrl = process.env.ARKIV_RPC_URL ?? kaolin.rpcUrls.default.http[0]
const writePrivateKey = process.env.ARKIV_PRIVATE_KEY?.trim()

const client = createPublicClient({
  chain: kaolin,
  transport: http(rpcUrl),
})

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

async function runIntegrationStep(t, action) {
  try {
    return await action()
  } catch (error) {
    if (isConnectivityError(error)) {
      const errorMessage = error instanceof Error ? error.message : String(error)

      t.skip(
        `Arkiv Kaolin RPC is unreachable from this environment (${rpcUrl}). ${errorMessage}`,
      )

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

test("reads the Kaolin chain ID", async (t) => {
  const chainId = await runIntegrationStep(t, () => client.getChainId())
  if (chainId === undefined) return

  assert.equal(chainId, kaolin.id)
})

test("accepts block heights returned as bigint or number", () => {
  assert.equal(isPositiveBlockHeight(1n), true)
  assert.equal(isPositiveBlockHeight(1), true)
  assert.equal(isPositiveBlockHeight(0n), false)
  assert.equal(isPositiveBlockHeight(0), false)
  assert.equal(isPositiveBlockHeight(1.5), false)
})

test("reads block timing from Kaolin", async (t) => {
  const blockTiming = await runIntegrationStep(t, () => client.getBlockTiming())
  if (blockTiming === undefined) return

  assert.ok(["bigint", "number"].includes(typeof blockTiming.currentBlock))
  assert.equal(typeof blockTiming.currentBlockTime, "number")
  assert.equal(typeof blockTiming.blockDuration, "number")
  assert.ok(isPositiveBlockHeight(blockTiming.currentBlock))
  assert.ok(blockTiming.currentBlockTime > 0)
  assert.ok(blockTiming.blockDuration > 0)
})

test("creates and reads back an entity on Kaolin", async (t) => {
  if (!writePrivateKey) {
    t.skip("Set ARKIV_PRIVATE_KEY to run the write integration example.")
    return
  }

  const walletClient = createWalletClient({
    account: privateKeyToAccount(writePrivateKey),
    chain: kaolin,
    transport: http(rpcUrl),
  })
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
