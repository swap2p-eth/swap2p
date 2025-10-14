import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import hre from "hardhat";
const { viem, artifacts } = hre as any;

type KeyLabel = [key: string, label: string];
const KEYS: KeyLabel[] = [
  ["G_SELL_setOnline", "SELL:setOnline"],
  ["G_SELL_maker_makeOffer", "SELL:maker_makeOffer"],
  ["G_SELL_taker_requestOffer", "SELL:taker_requestOffer"],
  ["G_SELL_maker_acceptRequest", "SELL:maker_acceptRequest"],
  ["G_SELL_sendMessage", "SELL:sendMessage"],
  ["G_SELL_markFiatPaid", "SELL:markFiatPaid"],
  ["G_SELL_release", "SELL:release"],
  ["G_BUY_maker_makeOffer", "BUY:maker_makeOffer"],
  ["G_BUY_taker_requestOffer", "BUY:taker_requestOffer"],
  ["G_BUY_maker_acceptRequest", "BUY:maker_acceptRequest"],
  ["G_BUY_markFiatPaid", "BUY:markFiatPaid"],
  ["G_BUY_release", "BUY:release"],
];

const BASELINE_PATH = "gas-baseline.json";
const WAD = 10n ** 18n;

function padRight(s: string | number, w: number) {
  const str = String(s);
  return str.length >= w ? str : str + " ".repeat(w - str.length);
}
function row(op: string, gas: string | number, delta: string | number, prev: string | number) {
  // eslint-disable-next-line no-console
  console.log(`| ${padRight(op, 26)} | ${padRight(gas, 10)} | ${padRight(delta, 10)} | ${padRight(prev, 10)} |`);
}
function header() {
  // eslint-disable-next-line no-console
  console.log("+----------------------------+------------+------------+------------+");
  // eslint-disable-next-line no-console
  console.log("| op                         | gas        | delta      | prev       |");
  // eslint-disable-next-line no-console
  console.log("+----------------------------+------------+------------+------------+");
}
function footer() {
  // eslint-disable-next-line no-console
  console.log("+----------------------------+------------+------------+------------+");
}

test("Gas report (Node test runner, TS)", async () => {
  // Debug HRE shape (silenced)
  const net = await (hre as any).network.connect();
  const hreViem: any = (net as any).viem;
  if (!hreViem) {
    throw new Error("Hardhat viem plugin not available on connected network. Ensure @nomicfoundation/hardhat-toolbox-viem is configured.");
  }
  // Hardhat's nodejs runner compiles before executing tests.

  const publicClient = await hreViem.getPublicClient();
  const [maker, taker] = await hreViem.getWalletClients();

  const Swap2pArtifact = await artifacts.readArtifact("Swap2p");
  const MintableArtifact = await artifacts.readArtifact("MintableERC20");

  // Deploy
  const swap = await hreViem.deployContract("Swap2p", []);
  const token = await hreViem.deployContract("MintableERC20", ["Mock", "MCK"]);

  // Helper to send tx and return gas used
  const write = async (
    from: any,
    address: `0x${string}`,
    abi: any,
    functionName: string,
    args: any[],
  ): Promise<number> => {
    const hash = await from.writeContract({ address, abi, functionName, args });
    const rc = await publicClient.waitForTransactionReceipt({ hash });
    return Number(rc.gasUsed);
  };

  // Mint & approve
  const big = 1_000_000n * WAD;
  const maxUint = (1n << 256n) - 1n;
  await write(maker, token.address, MintableArtifact.abi, "mint", [maker.account.address, big]);
  await write(taker, token.address, MintableArtifact.abi, "mint", [taker.account.address, big]);
  await write(maker, token.address, MintableArtifact.abi, "approve", [swap.address, maxUint]);
  await write(taker, token.address, MintableArtifact.abi, "approve", [swap.address, maxUint]);

  const latest: Record<string, number> = {};

  // SELL flow
  latest.G_SELL_setOnline = await write(maker, swap.address, Swap2pArtifact.abi, "setOnline", [true]);
  latest.G_SELL_maker_makeOffer = await write(maker, swap.address, Swap2pArtifact.abi, "maker_makeOffer", [
    token.address, 1, 840, 100n * WAD, 1_000n * WAD, 1n * WAD, 500n * WAD, "wire", "",
  ]);
  const amountSell = 100n * WAD;
  latest.G_SELL_taker_requestOffer = await write(taker, swap.address, Swap2pArtifact.abi, "taker_requestOffer", [
    token.address, 1, maker.account.address, amountSell, 840, 100n * WAD, "details", "0x0000000000000000000000000000000000000000",
  ]);
  latest.G_SELL_maker_acceptRequest = await write(maker, swap.address, Swap2pArtifact.abi, "maker_acceptRequest", [1, "ok"]);
  latest.G_SELL_sendMessage = await write(taker, swap.address, Swap2pArtifact.abi, "sendMessage", [1, "hi"]);
  latest.G_SELL_markFiatPaid = await write(taker, swap.address, Swap2pArtifact.abi, "markFiatPaid", [1, "paid"]);
  latest.G_SELL_release = await write(maker, swap.address, Swap2pArtifact.abi, "release", [1, "release"]);

  // BUY flow
  latest.G_BUY_maker_makeOffer = await write(maker, swap.address, Swap2pArtifact.abi, "maker_makeOffer", [
    token.address, 0, 978, 100n * WAD, 1_000n * WAD, 1n * WAD, 500n * WAD, "sepa", "",
  ]);
  const amountBuy = 200n * WAD;
  latest.G_BUY_taker_requestOffer = await write(taker, swap.address, Swap2pArtifact.abi, "taker_requestOffer", [
    token.address, 0, maker.account.address, amountBuy, 978, 100n * WAD, "details", "0x0000000000000000000000000000000000000000",
  ]);
  latest.G_BUY_maker_acceptRequest = await write(maker, swap.address, Swap2pArtifact.abi, "maker_acceptRequest", [2, "ok"]);
  latest.G_BUY_markFiatPaid = await write(maker, swap.address, Swap2pArtifact.abi, "markFiatPaid", [2, "paid"]);
  latest.G_BUY_release = await write(taker, swap.address, Swap2pArtifact.abi, "release", [2, "release"]);

  // Load previous baseline and print table
  let prev: Record<string, number> = {};
  if (fs.existsSync(BASELINE_PATH)) {
    try {
      prev = JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8"));
    } catch {
      prev = {};
    }
  }

  // eslint-disable-next-line no-console
  console.log("\n=== Gas delta vs previous baseline (TS Node runner) ===");
  header();
  for (const [key, label] of KEYS) {
    const newGas = latest[key];
    const oldGas = prev[key];
    const delta = typeof newGas === "number" && typeof oldGas === "number" ? newGas - oldGas : "n/a";
    const deltaStr = typeof delta === "number" ? (delta >= 0 ? `+${delta}` : `${delta}`) : "n/a";
    row(label, newGas ?? "n/a", deltaStr, typeof oldGas === "number" ? oldGas : "n/a");
  }
  footer();

  // Save baseline when explicitly requested
  if (process.env.UPDATE_GAS_BASELINE === '1') {
    fs.writeFileSync(BASELINE_PATH, JSON.stringify(latest, null, 2) + "\n");
  }

  // Basic assertion to finish the test successfully
  assert.equal(true, true);
});
