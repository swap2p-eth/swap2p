# Repository Guidelines

## Project Structure & Module Organization
- contracts/: Solidity sources (main: Swap2p.sol); Foundry-style Solidity tests in contracts/tests/*.t.sol.
- test/: TypeScript Node.js tests (node:test). Gas report: test/gas.node.ts.
- scripts/: Project scripts (if any future automation is added).
- artifacts/, cache/: Hardhat build output.
- gas-baseline.json: Stored gas snapshot for TS gas test.

## Build, Test, and Development Commands
- npm run compile — Force‑compiles with Hardhat 3 (solc 0.8.28).
- npm test — Runs Solidity tests and Node.js TS tests.
- npm run test-gas — Runs test/gas.node.ts and prints gas table with delta vs baseline.
  - UPDATE_GAS_BASELINE=1 npm run test-gas — Also updates gas-baseline.json.
- npm run size — Prints contract sizes.
- npm run coverage — Runs tests with coverage.

Networks: Hardhat uses simulated networks (hardhatMainnet, hardhatOp). For Sepolia, set SEPOLIA_RPC_URL and SEPOLIA_PRIVATE_KEY in your env.

## Coding Style & Naming Conventions
- Solidity: 0.8.28, optimizer enabled (runs: 1), EVM London, viaIR disabled.
  - Use 2‑space indentation, explicit visibility, and custom errors.
  - Prefer internal helpers, SafeERC20, and ReentrancyGuard for transfers.
  - Test contracts follow Swap2p_*Test naming in contracts/tests/.
- TypeScript: ESM, Node 16 module resolution, strict on. 2‑space indentation.
  - Place Node.js tests in test/*.ts; name as feature.node.ts when helpful.
  - Write code comments and UI copy in English to keep the documentation consistent.
  - Use the scoped logger in `@/lib/logger` (`debug`, `info`, `warn`, `error`) instead of `console.*` in application code.
  - UI components must not call chain adapters directly; always go through provider helpers (e.g. `refreshOffer`). This ensures fresh data passes through shared sanitizers (`mergeOfferWithOnchain`, token/fiat lookup helpers) before reaching the UI.

## Testing Guidelines
- Solidity tests: Foundry‑style in contracts/tests/*.t.sol (executed by Hardhat).
- Node tests: node:test runner via Hardhat (npx hardhat test nodejs). Use hre.network.connect().viem to interact.
- Gas testing: test/gas.node.ts prints current gas, delta vs gas-baseline.json; update the baseline only when intentional.

## Data Access Principles
- UI code should never invoke low-level adapter reads directly. Use the offers/deals providers (e.g., `refreshOffer`) so every response passes through shared sanitizers and normalization helpers.
- Whenever on-chain data is mapped into `OfferRow` or similar DTOs, reuse the helpers in `app/lib/offers/normalize.ts` to derive price/amount/fiat metadata. This keeps token decimals, fiat labels, and sanitization consistent across the app.

## Commit & Pull Request Guidelines
- Commits: concise, imperative, scoped (e.g., gas: tighten cleanup loop; tests(gas): show delta).
- PRs: include purpose, summary of changes, testing steps, and gas impact (paste table from npm run test-gas). Link related issues. Keep changes minimal and focused.

## Security & Configuration Tips
- Never store secrets in the repo. Use env vars for RPC URLs and keys.
- Fee‑on‑transfer tokens are rejected by design; don’t remove those checks.
- Maintain non‑reentrancy on state‑changing/token‑moving paths.
