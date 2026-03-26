name

arkiv-integration-tests

description

Repo-specific guidance for running and extending Arkiv integration tests in `Arkiv-Network/arkiv-js-sdk-test`. Use this skill together with `arkiv-best-practices` whenever the task is to validate Arkiv SDK behavior, run this repository's integration suite locally or in CI, debug Docker-backed test failures, or add new integration coverage against the local Arkiv node started by `testcontainers`.

## Arkiv Integration Tests for This Repository

This repository is a minimal example of how to run Arkiv SDK integration tests against a disposable local Arkiv node.

## When To Use This Skill

Use this skill when you need to:

- run the existing Arkiv integration tests in this repository
- understand why the tests need Docker and Node.js 24+
- debug failures around local node startup, RPC connectivity, or entity round-trips
- extend the suite with additional read or write integration checks
- confirm how the repository runs the same checks in GitHub Actions

## Prerequisites

- Node.js 24 or newer
- Docker available to the current user
- npm

## Repository Commands

Install dependencies:

```bash
npm ci
```

Run the full test suite:

```bash
npm test
```

Run only the integration tests:

```bash
npm run test:integration
```

These commands are defined in `package.json`.

## What The Integration Tests Cover

The main integration suite lives in `test/arkiv.integration.test.js`.

It demonstrates three core Arkiv flows against a local node:

1. `getChainId()` on a `createPublicClient(...)`
2. `getBlockTiming()` on the same public client
3. `createEntity()` with a `createWalletClient(...)`, followed by `getEntity()` to verify the written payload and attributes

The tests start a local Arkiv node from `golemnetwork/arkiv-op-geth:latest` using `testcontainers`, expose HTTP/WebSocket RPC ports, and then connect the SDK clients to the mapped local HTTP URL.

## How The Local Test Node Works

`test/arkiv.integration.test.js` launches the local node in `launchLocalArkivNode()`:

- starts a Docker container with Arkiv RPC APIs enabled
- waits for `HTTP server started`
- generates a temporary private key for write testing
- imports and funds that key inside the ephemeral container

This means the write example does **not** depend on an externally managed private key. The account exists only inside the disposable local test environment.

## Expected Behavior In Restricted Environments

If Docker or container access is unavailable, the helper `runIntegrationStep()` skips the integration test with a clear message instead of failing due to environment limitations.

If the container starts but the Arkiv RPC endpoint is unreachable, the same helper also skips with a connectivity message.

When debugging, look for these console messages from the first test:

- `Spawning local Arkiv Docker node...`
- `Local Arkiv Docker node spawned successfully.`

## CI Reference

The GitHub Actions workflow in `.github/workflows/integration-tests.yml` runs the same basic flow:

1. check out the repository
2. set up Node.js 24
3. run `npm ci`
4. run `npm run test:integration`

If you are updating the integration test behavior, keep local and CI commands aligned with that workflow.

## How To Extend The Suite Safely

When adding new integration coverage in this repository:

- reuse `getIntegrationContext()` so all tests share the same local node lifecycle
- wrap Arkiv RPC operations in `runIntegrationStep()` so environment-related failures skip cleanly
- prefer small, end-to-end assertions that prove one Arkiv capability at a time
- keep using the local `localhost` chain configuration from `@arkiv-network/sdk/chains`
- use deterministic assertions on payloads, attributes, entity keys, and transaction hashes

Good extension examples:

- add another read-only SDK call that should succeed against the local node
- create an entity with a new attribute shape and verify the read-back data
- verify helper behavior around block metadata or content types

## Reference Files

- `README.md` — quickstart and prerequisites
- `package.json` — `test` and `test:integration` scripts
- `test/arkiv.integration.test.js` — local-node setup and Arkiv integration examples
- `test/package-metadata.test.js` — package metadata coverage
- `.github/workflows/integration-tests.yml` — CI execution example
