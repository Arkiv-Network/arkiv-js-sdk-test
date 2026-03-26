import assert from "node:assert/strict"
import test from "node:test"
import { readFile } from "node:fs/promises"

const packageJsonPath = new URL("../package.json", import.meta.url)

test("package metadata supports GitHub installation", async () => {
  const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"))

  assert.equal(packageJson.type, "module")
  assert.deepEqual(packageJson.files, [
    "test/arkiv.integration.test.js",
    "examples/arkiv.integration.example.js",
  ])
})
