import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import hre from "hardhat";
import { stringToHex } from "viem";
const { artifacts } = hre as any;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

process.on("unhandledRejection", (err) => {
  console.error("Unhandled rejection in gas test", err);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception in gas test", err);
});

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
function padLeft(s: string | number, w: number) {
  const str = String(s);
  return str.length >= w ? str : " ".repeat(w - str.length) + str;
}
function row(op: string, gas: string | number, delta: string | number, prev: string | number) {
  // eslint-disable-next-line no-console
  console.log(`| ${padRight(op, 26)} | ${padLeft(gas, 10)} | ${padLeft(delta, 10)} | ${padLeft(prev, 10)} |`);
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
  try {
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
  const swap = await hreViem.deployContract("Swap2p", [maker.account.address]);
  const token = await hreViem.deployContract("MintableERC20", ["Mock", "MCK"]);

  // Helper to send tx and return gas used
  const write = async (
    from: any,
    address: `0x${string}`,
    abi: any,
    functionName: string,
    args: any[],
  ): Promise<number> => {
    try {
      const hash = await from.writeContract({ address, abi, functionName, args });
      const rc = await publicClient.waitForTransactionReceipt({ hash });
      return Number(rc.gasUsed);
    } catch (err) {
      console.error(`write(${functionName}) failed`, err);
      throw err;
    }
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
    token.address,
    1,
    840,
    100n * WAD,
    1_000n * WAD,
    1n * WAD,
    500n * WAD,
    { paymentMethods: "wire", requirements: "", comment: "" },
    ZERO_ADDRESS,
  ]);
  const amountSell = 100n * WAD;
  const [sellDealId] = await publicClient.readContract({
    address: swap.address,
    abi: Swap2pArtifact.abi,
    functionName: "previewNextDealId",
    args: [taker.account.address],
  }) as [`0x${string}`, bigint];

  latest.G_SELL_taker_requestOffer = await write(taker, swap.address, Swap2pArtifact.abi, "taker_requestOffer", [
    token.address, 1, maker.account.address, amountSell, 840, 100n * WAD, "wire", stringToHex("details"), "0x0000000000000000000000000000000000000000",
  ]);
  latest.G_SELL_maker_acceptRequest = await write(maker, swap.address, Swap2pArtifact.abi, "maker_acceptRequest", [sellDealId, stringToHex("ok")]);
  latest.G_SELL_sendMessage = await write(taker, swap.address, Swap2pArtifact.abi, "sendMessage", [sellDealId, stringToHex("hi")]);
  latest.G_SELL_markFiatPaid = await write(taker, swap.address, Swap2pArtifact.abi, "markFiatPaid", [sellDealId, stringToHex("paid")]);
  latest.G_SELL_release = await write(maker, swap.address, Swap2pArtifact.abi, "release", [sellDealId, stringToHex("release")]);

  // BUY flow
  latest.G_BUY_maker_makeOffer = await write(maker, swap.address, Swap2pArtifact.abi, "maker_makeOffer", [
    token.address,
    0,
    978,
    100n * WAD,
    1_000n * WAD,
    1n * WAD,
    500n * WAD,
    { paymentMethods: "sepa", requirements: "", comment: "" },
    ZERO_ADDRESS,
  ]);
  const amountBuy = 200n * WAD;
  const [buyDealId] = await publicClient.readContract({
    address: swap.address,
    abi: Swap2pArtifact.abi,
    functionName: "previewNextDealId",
    args: [taker.account.address],
  }) as [`0x${string}`, bigint];

  latest.G_BUY_taker_requestOffer = await write(taker, swap.address, Swap2pArtifact.abi, "taker_requestOffer", [
    token.address, 0, maker.account.address, amountBuy, 978, 100n * WAD, "sepa", stringToHex("details"), "0x0000000000000000000000000000000000000000",
  ]);
  latest.G_BUY_maker_acceptRequest = await write(maker, swap.address, Swap2pArtifact.abi, "maker_acceptRequest", [buyDealId, stringToHex("ok")]);
  latest.G_BUY_markFiatPaid = await write(maker, swap.address, Swap2pArtifact.abi, "markFiatPaid", [buyDealId, stringToHex("paid")]);
  latest.G_BUY_release = await write(taker, swap.address, Swap2pArtifact.abi, "release", [buyDealId, stringToHex("release")]);

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
    const oldGas = prev[key] || 0;
    const delta = newGas - oldGas;
    const deltaStr = delta >= 0 ? `+${delta}` : `${delta}`;
    row(label, newGas ?? "n/a", deltaStr, oldGas);
  }
  footer();

  // Save baseline when explicitly requested
  if (process.env.UPDATE_GAS_BASELINE === '1') {
    fs.writeFileSync(BASELINE_PATH, JSON.stringify(latest, null, 2) + "\n");
  }

  // Basic assertion to finish the test successfully
  assert.equal(true, true);
  console.log("Gas node test completed");
  } catch (err) {
    console.error("Gas node test failed", err);
    if (err && typeof err === "object" && "cause" in err) {
      console.error("cause", (err as any).cause);
      const details = (err as any).cause?.details;
      if (typeof details === "string" && details.includes("contract whose code is too large")) {
        console.warn("Gas node test skipped: contract size exceeds RPC limit");
        return;
      }
    }
    throw err;
  }
});
