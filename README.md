<img style="float:right" src="app/public/swap2p-icon.svg" alt="Swap2p icon" width="96" height="96" />

# Swap2p
_On-chain rails for cross-border P2P market makers._

Swap2p is a P2P swap protocol focused on off-ramp/on-ramp market makers. This repository contains the Solidity contracts, Hardhat tooling, seeding scripts, and supporting TypeScript tests that power the on-chain side of the project. The web UI lives in `app/` (see `app/README.md` for full details) and consumes the generated artifacts from this workspace.

## Project Layout

- `contracts/`: Solidity sources for Swap2p and test fixtures.
- `contracts/tests/*.t.sol`: Foundry-style tests executed through Hardhat.
- `scripts/`: Node scripts for deployment, seeding, and artifact syncing.
- `test/`: TypeScript integration tests run with Node's native `node:test` runner.
- `app/`: Swap2p frontend (Next.js) that uses the compiled artifacts from this repo.

## Getting Started

```shell
npm install
cp .env.example .env    # optional – override seed addresses or network keys
```

Environment overrides:

- `SEED_KEY_1`, `SEED_KEY_2`: private keys for the two maker wallets used by the seeding script. The script funds each wallet with native gas and deploys using these accounts.

## Testing the UI Locally

The frontend is located under `app/` and has its own README with full instructions. To preview the UI against a seeded Hardhat network:

1. In the repository root, start the local node: `npm run local:node`.
2. With the node running, seed it in a second terminal: `npm run local:seed`.
3. Open a third terminal, `cd app`, and run `npm run dev` to launch the UI.
4. In the web app, switch the network selector to `hardhat` to connect to the seeded environment.
5. Import seed private keys into two different browsers / profiles 
```
address: 0x111105e09533e5A9120579517e2C532e1CaD022A
SEED_KEY_1=0x4f3edf983ac636a65a842ce7c78d9aa706d3b113b37d8d7a593c2b912b9b0df

address: 0x222202a7e49088fc50FaF552ec60f992e813863E
SEED_KEY_2=0x6c3699283bda56ad74f6bc422a28c05fe1a30aa03d1c0e54796d312fcf1f5b1
```
6. Play with the app.

## Testing the UI on Mezo Testnet

1. Import seed private keys into two different browsers / profiles
```
address: 0x111105e09533e5A9120579517e2C532e1CaD022A
SEED_KEY_1=0x4f3edf983ac636a65a842ce7c78d9aa706d3b113b37d8d7a593c2b912b9b0df

address: 0x222202a7e49088fc50FaF552ec60f992e813863E
SEED_KEY_2=0x6c3699283bda56ad74f6bc422a28c05fe1a30aa03d1c0e54796d312fcf1f5b1
```
These addresses has some test USDT and BTC prefilled.
Or you can mint some USDT to your address: https://explorer.test.mezo.org/address/0x44a1A403D28d1551D6B814107fD3250CDDbfA5E0?tab=write_contract#40c10f19 
2. Open https://swap2p.org 
3. In the web app, switch the network selector to `Mezo Testnet` to connect to the test environment.

## Local Development

| Command | Description |
| --- | --- |
| `npm run compile` | Force-compile contracts with Hardhat 3 (solc 0.8.28). |
| `npm run typechain` | Regenerate TypeScript typings for the contracts. |
| `npm run sync:app-contracts` | Copy fresh ABIs/addresses into `app/lib/swap2p/generated/`. |
| `npm test` | Run Solidity tests and Node TypeScript tests. |
| `npm run test-gas` | Execute gas benchmark (`test/gas.node.ts`). |
| `npm run test-gas:update` | Same as above but refresh `gas-baseline.json`. |
| `npm run test-gas:sol` | Run the Solidity gas harness (`contracts/tests/Swap2p_Gas.t.sol`). |
| `npm run coverage` | Produce coverage report. |
| `npm run echidna` | Launch Echidna invariant fuzzing harness. |
| `npm run medusa` | Launch Medusa fuzzer with the provided config. |
| `npm run local:node` | Start a verbose Hardhat node for local workflows. |
| `npm run local:seed` | Seed the local Hardhat node with makers, offers, and deals. |
| `npm run deploy:hardhat` | Broadcast Swap2p deployment to the in-process Hardhat network. |
| `npm run deploy:mezo` | Broadcast Swap2p deployment to the configured Mezo network. |
| `npm run compile:app` | Rebuild contracts, run TypeChain, and sync artifacts into the frontend. |

## Deploying Swap2p

When you're ready to deploy:

```shell
npx hardhat run --network mezo scripts/deploy-swap2p.ts
```

To sync fresh artifacts into the UI after any contract change or deployment, rerun `npm run compile:app`.
