import assert from "node:assert/strict"
import test from "node:test"

import { createPublicClient, http } from "@arkiv-network/sdk"
import { kaolin } from "@arkiv-network/sdk/chains"

const rpcUrl = process.env.ARKIV_RPC_URL ?? kaolin.rpcUrls.default.http[0]

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

test("reads the Kaolin chain ID", async (t) => {
  const chainId = await runIntegrationStep(t, () => client.getChainId())
  if (chainId === undefined) return

  assert.equal(chainId, kaolin.id)
})

test("reads block timing from Kaolin", async (t) => {
  const blockTiming = await runIntegrationStep(t, () => client.getBlockTiming())
  if (blockTiming === undefined) return

  assert.equal(typeof blockTiming.currentBlock, "bigint")
  assert.equal(typeof blockTiming.currentBlockTime, "number")
  assert.equal(typeof blockTiming.blockDuration, "number")
  assert.ok(blockTiming.currentBlock > 0n)
  assert.ok(blockTiming.currentBlockTime > 0)
  assert.ok(blockTiming.blockDuration > 0)
})
