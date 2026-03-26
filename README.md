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

## Notes

- These tests are real integration tests, so they require Docker access in order to launch a local Arkiv node.
- In restricted environments where Docker is unavailable, the Arkiv integration tests are skipped with a clear message instead of failing for container-connectivity reasons.
- The write example uses a fixed local development key that is imported and funded inside the ephemeral test container only.
