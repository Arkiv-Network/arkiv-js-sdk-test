# arkiv-js-sdk-test

This repository is a minimal demonstration package for running Arkiv SDK integration tests.

It is modeled after the [`test`](https://github.com/Arkiv-Network/arkiv-sdk-js/tree/main/test) package in [`Arkiv-Network/arkiv-sdk-js`](https://github.com/Arkiv-Network/arkiv-sdk-js), but keeps the scope intentionally small and only runs a couple of simple read-only integration checks against the public Kaolin network.

## What is included

- a tiny npm package that depends on `@arkiv-network/sdk`
- two integration tests using Node's built-in test runner
- simple assertions for:
  - `getChainId()`
  - `getBlockTiming()`

## Prerequisites

- Node.js 24 or newer
- network access to the Arkiv Kaolin RPC endpoint

If you need to use a different Arkiv RPC endpoint, set `ARKIV_RPC_URL` before running the tests.

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

To override the default RPC URL:

```bash
ARKIV_RPC_URL=https://kaolin.hoodi.arkiv.network/rpc npm test
```

## Notes

- These tests are real integration tests, so they require a reachable Arkiv RPC endpoint.
- In restricted environments where the Kaolin RPC hostname cannot be resolved or reached, the tests are skipped with a clear message instead of failing for DNS/connectivity reasons.
