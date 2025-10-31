<img align="right" src="app/public/swap2p-icon.svg" alt="Swap2p icon" width="96" height="96" />

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

## Testing the UI Locally

The frontend is located under `app/` and has its own README with full instructions. To preview the UI against a seeded Hardhat network:

1. In the repository root, start the local node: `npm run local:node`.
2. With the node running, seed it in a second terminal: `npm run local:seed`.
3. Open a third terminal, `cd app`, and run `npm run dev` to launch the UI.
4. In the web app, switch the network selector to `hardhat` to connect to the seeded environment.

This flow spawns mock tokens, registers maker profiles, and populates offers/deals so the UI surfaces realistic data (including revoked allowances for the first maker to test the Approve flow).

## Deploying Swap2p

When you're ready to deploy:

```shell
npx hardhat run --network sepolia scripts/deploy-swap2p.ts
```

Ensure `SEPOLIA_RPC_URL`, `SEPOLIA_PRIVATE_KEY`, and `ETHERSCAN_API_KEY` are configured (via `.env` or Hardhat config vars). The script deploys the main contract and logs the address. Use `npm run deploy:hardhat` for local broadcast or `npm run deploy:mezo` for other configured networks.

To sync fresh artifacts into the UI after any contract change or deployment, rerun `npm run compile:app`.
