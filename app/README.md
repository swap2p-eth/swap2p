# Swap2p App (web console)

This is a Next.js 14 app router project that lives alongside the core `Swap2p` contracts. It ships with:

- **shadcn/ui** primitives wired with Tailwind CSS and theming.
- **TanStack Query + Table** for data fetching/state and tabular views.
- **@tanstack/react-virtual** powering the chat timeline.
- **react-day-picker** for range selections.
- **lucide-react** icons.
- Minimal chat widget hooked up to bytes-first messaging and a theme toggle (light/dark/system).

## Getting started

```bash
cd app
npm install
npm run dev:mock
```

The dev server will start on `http://localhost:3000`. `npm run dev:mock` boots the UI against the in-memory adapter so the app renders without any RPC calls.

To exercise the real contract, point the Next.js server at a deployed address and run:

```bash
NEXT_PUBLIC_SWAP2P_ADDRESS=0x... NEXT_PUBLIC_SWAP2P_CHAIN_ID=11155111 npm run dev:real
```

`dev:real` keeps using the same components but swaps in the viem-powered adapter. Set `NEXT_PUBLIC_SWAP2P_CHAIN_ID` to the chain your viem client is connected to (optional if the client already knows the chain).

## Contract bindings & adapters

- The contracts package exposes `npm run compile:app`, which force-compiles with Hardhat, regenerates the viem-friendly ABI (`typechain-types/`), and copies the artifacts into `app/lib/swap2p/generated/`.
- The app side provides `createSwap2pAdapter` in `lib/swap2p/index.ts`. It chooses the mock adapter when `NEXT_PUBLIC_SWAP2P_MODE=mock` and otherwise expects a viem `publicClient`/`walletClient` pair plus a contract address.
- `lib/swap2p/mock-adapter.ts` mirrors contract logic (state transitions, price bounds, reserves, cleanup) and ships with seeded offers/deals so UI flows work offline.
- `lib/swap2p/viem-adapter.ts` wraps the on-chain contract with typed helpers (`getOffers`, `takerRequestOffer`, `release`, etc.) and exposes a consistent API for the UI layer.

## Next steps

- Wire deal fetching to your Hardhat deployments or a viem client that calls `Swap2p`.
- Replace the mock chat adapter with encrypted message handling (messages are already modelled as `bytes` in the contract).
- Add authentication (e.g. wagmi + RainbowKit) so makers/takers can act from their wallets.
- Convert the mock data to TanStack Query sources (Subgraph, viem, custom RPC).
- Move this folder into its own repo when ready—only the relative import of ABI/artifacts will need to be adjusted.
