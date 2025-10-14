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

The dev server will start on `http://localhost:3000`. The page shows mock data so it can render without hitting the blockchain.

## Next steps

- Wire deal fetching to your Hardhat deployments or a viem client that calls `Swap2p`.
- Replace the mock chat adapter with encrypted message handling (messages are already modelled as `bytes` in the contract).
- Add authentication (e.g. wagmi + RainbowKit) so makers/takers can act from their wallets.
- Convert the mock data to TanStack Query sources (Subgraph, viem, custom RPC).
- Move this folder into its own repo when ready—only the relative import of ABI/artifacts will need to be adjusted.
