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
npm run dev
```

The dev server will start on `http://localhost:3000`. Connect the wallet to **Hardhat (local)** to use the deployment snapshot from `app/networks/hardhat.json`, or pick another network after wiring its metadata into `app/config.ts`.

## Contract bindings & adapters

- The contracts package exposes `npm run compile:app`, which force-compiles with Hardhat, regenerates the viem-friendly ABI (`typechain-types/`), and copies the artifacts into `app/lib/swap2p/generated/`.
- The app side provides `createSwap2pAdapter` in `lib/swap2p/index.ts`. It expects a viem `publicClient`/`walletClient` pair plus a contract address from the network config.
- `lib/swap2p/viem-adapter.ts` wraps the on-chain contract with typed helpers (`getOffers`, `takerRequestOffer`, `release`, etc.) and exposes a consistent API for the UI layer.

## Logging

- Prefer the helpers exported from `@/lib/logger` (`debug`, `info`, `warn`, `error`) instead of calling `console.*` directly. The logger scopes output automatically and only emits debug logs when `NEXT_PUBLIC_SWAP2P_DEBUG=1`.

## UI fallbacks

- `ResourceFallback` (`@/components/resource-fallback`) centralizes the loading/not-found layouts shared across offer/deal flows. Pass `status="loading"` to render the skeletons, or provide `title`, `description`, and an optional `action` when the resource is unavailable. This keeps empty/error states consistent and avoids duplicating skeleton markup inside feature components.

## Next steps

- Wire deal fetching to your Hardhat deployments or a viem client that calls `Swap2p`.
- Replace the mock chat adapter with encrypted message handling (messages are already modelled as `bytes` in the contract).
- Add authentication (e.g. wagmi + RainbowKit) so makers/takers can act from their wallets.
- Wire real data sources into TanStack Query (Subgraph, viem, custom RPC).
- Move this folder into its own repo when ready—only the relative import of ABI/artifacts will need to be adjusted.
