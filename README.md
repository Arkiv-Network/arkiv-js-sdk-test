# arkiv-js-sdk-test

This repository is a minimal demonstration package for running Arkiv SDK integration tests.

It is modeled after the [`test`](https://github.com/Arkiv-Network/arkiv-sdk-js/tree/main/test) package in [`Arkiv-Network/arkiv-sdk-js`](https://github.com/Arkiv-Network/arkiv-sdk-js), but keeps the scope intentionally small with two simple read checks and one write example against a local Arkiv node launched via `testcontainers`.

For agent-oriented instructions on running and extending these integration tests, see [`SKILL.md`](./SKILL.md).

## What is included

- a tiny npm package that depends on `@arkiv-network/sdk`
- integration tests using Node's built-in test runner
- a local Arkiv node launched on demand with `testcontainers`
- simple assertions for:
  - `getChainId()`
  - `getBlockTiming()`
  - `createEntity()` plus a read-back check via `getEntity()`

## Prerequisites

- Node.js 24 or newer
- Docker

## Install dependencies for this checkout

```bash
npm install
```

## Install directly from GitHub

```bash
npm install github:Arkiv-Network/arkiv-js-sdk-test
```

This installs this demo integration-test package directly from the repository. The package is plain JavaScript, so there is no separate build step or compiled `dist/` output to keep in the repository. The GitHub install uses the checked-in package files directly.

## Run the integration tests

```bash
npm test
```

Or run the integration-only script explicitly:

```bash
npm run test:integration
```

## Use this repo as a starter for your own integration tests

This package is best used as a small, copyable template. The main reusable pieces are:

- `test/arkiv.integration.test.js` for a full working example
- `examples/arkiv.integration.example.js` for a smaller starter file you can copy into your own project

If you install from GitHub, both files are available in `node_modules/arkiv-js-sdk-test/`.

## Step-by-step: create your own Arkiv integration test

1. Create a Node.js project for your integration tests.
2. Install this starter package and the direct dependencies your copied test will use:

   ```bash
   npm install github:Arkiv-Network/arkiv-js-sdk-test @arkiv-network/sdk testcontainers viem
   ```

3. Copy the starter example into your own test directory:

   ```bash
   mkdir -p test
   cp node_modules/arkiv-js-sdk-test/examples/arkiv.integration.example.js test/my-feature.integration.test.js
   ```

   If you are working directly in this repository, you can copy from `examples/arkiv.integration.example.js` instead.

4. Open `test/my-feature.integration.test.js` and customize:
   - the payload you want to store with `createEntity()`
   - the attributes you want to index and read back
   - the assertions that prove your integration works
   - any extra Arkiv SDK calls you want to verify

5. Run just your new test while iterating:

   ```bash
   node --test test/my-feature.integration.test.js
   ```

6. Once your test is stable, run your normal test command such as:

   ```bash
   npm test
   ```

## What to change in the example

The starter example already shows the basic Arkiv integration-test flow:

1. launch a local Arkiv node with `testcontainers`
2. create a public client for reads
3. create a wallet client for writes
4. write a JSON payload with `createEntity()`
5. read the entity back with `getEntity()`
6. assert on the decoded JSON payload and indexed attributes

When adapting it for your own project, the most common edits are:

- replace the example payload with your own domain data
- rename the test cases to match your feature
- add more reads after the write, depending on what your integration needs to prove
- keep the Docker startup and cleanup helpers as-is unless you need a different node configuration

## Example workflow

- Start from `examples/arkiv.integration.example.js`
- Rename the test to something feature-specific such as `stores invoice metadata in Arkiv`
- Change the payload to the shape your app writes
- Change the final assertions so they check the fields your app depends on
- Add more tests beside it for additional Arkiv SDK operations

## Notes

- These tests are real integration tests, so they require Docker access in order to launch a local Arkiv node.
- In restricted environments where Docker is unavailable, the Arkiv integration tests are skipped with a clear message instead of failing for container-connectivity reasons.
- The write example uses a fixed local development key that is imported and funded inside the ephemeral test container only.
