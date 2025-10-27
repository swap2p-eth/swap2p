import hardhat from "hardhat";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  maxUint256,
  parseEther,
  parseUnits,
  padHex,
  stringToHex,
  zeroAddress,
  type Address,
  type Hex,
} from "viem";

const { network, artifacts } = hardhat;

export function toCountryCode(code: string): number {
  const value = code.trim().toUpperCase();
  if (value.length !== 2) {
    throw new Error("Country code must contain exactly 2 characters, received \"" + code + "\"");
  }
  const c0 = value.charCodeAt(0);
  const c1 = value.charCodeAt(1);
  if (c0 < 65 || c0 > 90 || c1 < 65 || c1 > 90) {
    throw new Error("Country code must be A-Z letters (e.g., 'US'), received \"" + code + "\"");
  }
  return (c0 << 8) | c1;
}

const US = toCountryCode("US");
const TH = toCountryCode("TH");

const ZERO_BYTES32 =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as Hex;

const clampHexToBytes32 = (value: Hex): Hex => {
  if (value.length <= 66) return value;
  return (`0x${value.slice(2, 66)}`) as Hex;
};

const encodeBytes32 = (value: string): Hex => {
  if (!value) return ZERO_BYTES32;
  const encoded = stringToHex(value);
  const trimmed = clampHexToBytes32(encoded as Hex);
  return padHex(trimmed, { size: 32, dir: "right" }) as Hex;
};

const makerProfiles = [
  {
    address: "0x1Ffa68359Fc14d9296503Ff99c2f6dF6Be28B12f" as Address,
    nickname: "desk-atlas",
    paymentNotes: "Wise USD, Fedwire, PromptPay",
    requirements: "Government ID + liveness selfie",
  },
  {
    address: "0x96a8fa7F568Bc9CA474201727483954F6d0CC2c1" as Address,
    nickname: "liquidity-hub",
    paymentNotes: "SEPA Instant, Kasikorn, Revolut Business",
    requirements: "Business account statement <30 days",
  },
];

const tokenConfigs = [
  {
    key: "WBTC",
    name: "Wrapped Bitcoin",
    symbol: "WBTC",
    decimals: 8,
    makerMint: "10",
    takerMint: "12",
    offers: {
      sell: {
        fiat: US,
        price: 68_350_000n,
        min: "0.01",
        max: "2.5",
        paymentMethods: "Fedwire, Wise USD",
        requirements: "Video KYC, proof of funds",
      },
      buy: {
        fiat: TH,
        price: 2_420_000_000n,
        min: "0.01",
        max: "1.5",
        paymentMethods: "SCB PromptPay, Wise THB",
        requirements: "Thai bank account required",
      },
    },
  },
  {
    key: "USDT",
    name: "Tether USD",
    symbol: "USDT",
    decimals: 6,
    makerMint: "100000",
    takerMint: "120000",
    offers: {
      sell: {
        fiat: US,
        price: 100_050n,
        min: "10",
        max: "15000",
        paymentMethods: "ACH, Wise USD, Revolut",
        requirements: "Name match with bank account",
      },
      buy: {
        fiat: TH,
        price: 3_560_000n,
        min: "10",
        max: "12000",
        paymentMethods: "PromptPay, Bangkok Bank",
        requirements: "Verified local account",
      },
    },
  },
  {
    key: "DAI",
    name: "MakerDAO DAI",
    symbol: "DAI",
    decimals: 18,
    makerMint: "100000",
    takerMint: "110000",
    offers: {
      sell: {
        fiat: US,
        price: 100_000n,
        min: "50",
        max: "20000",
        paymentMethods: "ACH, Zelle",
        requirements: "US resident with KYC",
      },
      buy: {
        fiat: TH,
        price: 3_480_000n,
        min: "50",
        max: "18000",
        paymentMethods: "Krungsri, Kasikorn",
        requirements: "Passport copy + address",
      },
    },
  },
  {
    key: "WETH",
    name: "Wrapped Ether",
    symbol: "WETH",
    decimals: 18,
    makerMint: "100",
    takerMint: "120",
    offers: {
      sell: {
        fiat: US,
        price: 3_320_000n,
        min: "0.05",
        max: "20",
        paymentMethods: "SWIFT USD, Wise Business",
        requirements: "Company docs + compliance call",
      },
      buy: {
        fiat: TH,
        price: 120_500_000n,
        min: "0.05",
        max: "18",
        paymentMethods: "SCB PromptPay, Krungthai",
        requirements: "Video call before settlement",
      },
    },
  },
];

type TokenInstance = {
  config: (typeof tokenConfigs)[number];
  address: Address;
  decimals: number;
};

const connection = await network.connect();
const hreViem: any = connection.viem;

if (!hreViem) {
  throw new Error("Hardhat viem plugin is not available. Ensure @nomicfoundation/hardhat-toolbox-viem is configured.");
}

const publicClient = await hreViem.getPublicClient();
const testClient = await hreViem.getTestClient();
const walletClients = await hreViem.getWalletClients();

type WalletArray = typeof walletClients;
type WalletClientType = WalletArray[number];

type MakerContext = {
  profile: (typeof makerProfiles)[number];
  client: WalletClientType;
  offers: OfferDescriptor[];
};

type OfferDescriptor = {
  maker: MakerContext;
  token: TokenInstance;
  side: number;
  fiat: number;
  price: bigint;
  min: bigint;
  max: bigint;
  paymentMethods: string;
};

if (walletClients.length === 0) {
  throw new Error("Hardhat wallet clients are unavailable.");
}
const [deployer] = walletClients as [WalletClientType, ...WalletClientType[]];

function parseAmount(value: string, decimals: number): bigint {
  return parseUnits(value, decimals);
}

async function waitTx(hash: Hex) {
  await publicClient.waitForTransactionReceipt({ hash });
}

async function writeWith(
  client: WalletClientType,
  request: {
    address: Address;
    abi: any;
    functionName: string;
    args: readonly unknown[];
  },
  label: string,
) {
  const hash = await client.writeContract(request);
  console.log(`→ ${label}: ${hash}`);
  await waitTx(hash);
  return hash;
}

const mintableArtifact = await artifacts.readArtifact("MintableToken");
const swapArtifact = await artifacts.readArtifact("Swap2p");

const tokens = new Map<string, TokenInstance>();

console.log("Deploying Swap2p and mock tokens for local Hardhat network...");

const swap = await hreViem.deployContract("Swap2p", [deployer.account.address], { confirmations: 1 });
console.log(`Swap2p deployed at ${swap.address}`);

for (const config of tokenConfigs) {
  const token = await hreViem.deployContract("MintableToken", [config.name, config.symbol, config.decimals], { confirmations: 1 });
  tokens.set(config.key, {
    config,
    address: token.address as Address,
    decimals: config.decimals,
  });
  console.log(`${config.symbol} deployed at ${token.address}`);
}

const makerContexts: MakerContext[] = [];

for (const profile of makerProfiles) {
  await testClient.setBalance({ address: profile.address, value: parseEther("500") });
  await testClient.impersonateAccount({ address: profile.address });
  const client = await hreViem.getWalletClient(profile.address);
  makerContexts.push({ profile, client, offers: [] });
}

if (makerContexts.length < 2) {
  throw new Error("Need at least two maker profiles to seed deals.");
}

const uniqueClientMap = new Map<string, WalletClientType>();
for (const context of makerContexts) {
  uniqueClientMap.set(context.profile.address.toLowerCase(), context.client);
}
const tokenApprovalTargets = Array.from(uniqueClientMap.values());
const takerClients = makerContexts.map(context => context.client);

for (const { config, address: tokenAddress, decimals } of tokens.values()) {
  const makerAmount = parseAmount(config.makerMint, decimals);
  const takerAmount = parseAmount(config.takerMint, decimals);

  for (const maker of makerContexts) {
    await writeWith(deployer, {
      address: tokenAddress,
      abi: mintableArtifact.abi,
      functionName: "mint",
      args: [maker.profile.address, makerAmount],
    }, `mint ${config.symbol} to maker ${maker.profile.nickname}`);
  }

  for (const taker of takerClients) {
    await writeWith(deployer, {
      address: tokenAddress,
      abi: mintableArtifact.abi,
      functionName: "mint",
      args: [taker.account.address, takerAmount],
    }, `mint ${config.symbol} to taker ${taker.account.address}`);
  }

  for (const wallet of tokenApprovalTargets) {
    await writeWith(wallet, {
      address: tokenAddress,
      abi: mintableArtifact.abi,
      functionName: "approve",
      args: [swap.address, maxUint256],
    }, `approve ${config.symbol} for ${wallet.account.address}`);
  }
}

for (const maker of makerContexts) {
  await writeWith(maker.client, {
    address: swap.address as Address,
    abi: swapArtifact.abi,
    functionName: "setNickname",
    args: [encodeBytes32(maker.profile.nickname)],
  }, `set nickname ${maker.profile.nickname}`);

  await writeWith(maker.client, {
    address: swap.address as Address,
    abi: swapArtifact.abi,
    functionName: "setOnline",
    args: [true],
  }, `set online status for ${maker.profile.nickname}`);
}

for (const maker of makerContexts) {
  for (const token of tokens.values()) {
    const sell = token.config.offers.sell;
    const buy = token.config.offers.buy;

    const sellMin = parseAmount(sell.min, token.decimals);
    const sellMax = parseAmount(sell.max, token.decimals);

    await writeWith(maker.client, {
      address: swap.address as Address,
      abi: swapArtifact.abi,
      functionName: "maker_makeOffer",
      args: [
        token.address,
        1,
        sell.fiat,
        sell.price,
        sellMin,
        sellMax,
        sell.paymentMethods,
        `${sell.requirements}. Preferred payment: ${maker.profile.paymentNotes}`,
        zeroAddress,
      ],
    }, `create SELL offer for ${token.config.symbol} (${maker.profile.nickname})`);

    maker.offers.push({
      maker,
      token,
      side: 1,
      fiat: sell.fiat,
      price: sell.price,
      min: sellMin,
      max: sellMax,
      paymentMethods: sell.paymentMethods,
    });

    const buyMin = parseAmount(buy.min, token.decimals);
    const buyMax = parseAmount(buy.max, token.decimals);

    await writeWith(maker.client, {
      address: swap.address as Address,
      abi: swapArtifact.abi,
      functionName: "maker_makeOffer",
      args: [
        token.address,
        0,
        buy.fiat,
        buy.price,
        buyMin,
        buyMax,
        buy.paymentMethods,
        `${buy.requirements}. Preferred payment: ${maker.profile.paymentNotes}`,
        zeroAddress,
      ],
    }, `create BUY offer for ${token.config.symbol} (${maker.profile.nickname})`);

    maker.offers.push({
      maker,
      token,
      side: 0,
      fiat: buy.fiat,
      price: buy.price,
      min: buyMin,
      max: buyMax,
      paymentMethods: buy.paymentMethods,
    });

    // Extra liquidity: mirror SELL settings as a USD BUY market so the UI shows both sides by default.
    const mirroredBuyMin = sellMin * 2n;
    const mirroredBuyMax = sellMax * 2n;

    await writeWith(maker.client, {
      address: swap.address as Address,
      abi: swapArtifact.abi,
      functionName: "maker_makeOffer",
      args: [
        token.address,
        0,
        sell.fiat,
        sell.price,
        mirroredBuyMin,
        mirroredBuyMax,
        sell.paymentMethods,
        `${sell.requirements} (mirrored BUY). Preferred payment: ${maker.profile.paymentNotes}`,
        zeroAddress,
      ],
    }, `create mirrored BUY offer for ${token.config.symbol} (${maker.profile.nickname})`);

    maker.offers.push({
      maker,
      token,
      side: 0,
      fiat: sell.fiat,
      price: sell.price,
      min: mirroredBuyMin,
      max: mirroredBuyMax,
      paymentMethods: sell.paymentMethods,
    });

    // Provide a SELL-side offer for the buy fiat so both market directions are populated.
    const mirroredSellMin = parseAmount(buy.min, token.decimals);
    const mirroredSellMax = parseAmount(buy.max, token.decimals);

    await writeWith(maker.client, {
      address: swap.address as Address,
      abi: swapArtifact.abi,
      functionName: "maker_makeOffer",
      args: [
        token.address,
        1,
        buy.fiat,
        buy.price,
        mirroredSellMin,
        mirroredSellMax,
        buy.paymentMethods,
        `${buy.requirements}. Mirrored SELL offer for takers buying ${token.config.symbol}`,
        zeroAddress,
      ],
    }, `create SELL offer (mirrored) for ${token.config.symbol} (${maker.profile.nickname})`);

    maker.offers.push({
      maker,
      token,
      side: 1,
      fiat: buy.fiat,
      price: buy.price,
      min: mirroredSellMin,
      max: mirroredSellMax,
      paymentMethods: buy.paymentMethods,
    });
  }
}

function nextTaker(maker: MakerContext, index: { value: number }) {
  const candidates = makerContexts.filter(ctx => ctx.profile.address !== maker.profile.address);
  if (candidates.length === 0) {
    throw new Error("No counterparty available for maker " + maker.profile.address);
  }
  const takerContext = candidates[index.value % candidates.length];
  index.value += 1;
  return takerContext.client;
}

async function requestDeal(params: {
  taker: WalletClientType;
  offer: OfferDescriptor;
  maker: MakerContext;
  amount: bigint;
  paymentMethod: string;
  paymentNote: string;
}) {
  const { taker, offer, maker, amount, paymentMethod, paymentNote } = params;

  const [dealId] = await publicClient.readContract({
    address: swap.address as Address,
    abi: swapArtifact.abi,
    functionName: "previewNextDealId",
    args: [taker.account.address],
  }) as [`0x${string}`, bigint];

  await writeWith(taker, {
    address: swap.address as Address,
    abi: swapArtifact.abi,
    functionName: "taker_requestOffer",
    args: [
      offer.token.address,
      offer.side,
      maker.profile.address,
      amount,
      offer.fiat,
      offer.price,
      paymentMethod,
      stringToHex(paymentNote),
      zeroAddress,
    ],
  }, `request deal ${dealId}`);

  return dealId;
}

async function sendChat(sender: WalletClientType, dealId: Hex, message: string, label: string) {
  await writeWith(sender, {
    address: swap.address as Address,
    abi: swapArtifact.abi,
    functionName: "sendMessage",
    args: [dealId, stringToHex(message)],
  }, `${label} chat`);
}

async function cancelAs(sender: WalletClientType, dealId: Hex, reason: string) {
  await writeWith(sender, {
    address: swap.address as Address,
    abi: swapArtifact.abi,
    functionName: "cancelRequest",
    args: [dealId, stringToHex(reason)],
  }, `cancel deal ${dealId}`);
}

async function acceptAs(maker: MakerContext, dealId: Hex, note: string) {
  await writeWith(maker.client, {
    address: swap.address as Address,
    abi: swapArtifact.abi,
    functionName: "maker_acceptRequest",
    args: [dealId, stringToHex(note)],
  }, `accept deal ${dealId}`);
}

async function markPaidAs(sender: WalletClientType, dealId: Hex, note: string) {
  await writeWith(sender, {
    address: swap.address as Address,
    abi: swapArtifact.abi,
    functionName: "markFiatPaid",
    args: [dealId, stringToHex(note)],
  }, `mark paid ${dealId}`);
}

async function releaseAs(sender: WalletClientType, dealId: Hex, note: string) {
  await writeWith(sender, {
    address: swap.address as Address,
    abi: swapArtifact.abi,
    functionName: "release",
    args: [dealId, stringToHex(note)],
  }, `release deal ${dealId}`);
}

const takerCursor = { value: 0 };

for (const maker of makerContexts) {
  const sellOffer = maker.offers.find((offer) => offer.side === 1 && offer.token.config.key === "USDT");
  const buyOffer = maker.offers.find((offer) => offer.side === 0 && offer.token.config.key === "WETH");

  if (!sellOffer || !buyOffer) {
    throw new Error(`Missing expected offers for maker ${maker.profile.nickname}`);
  }

  const sellAmount = parseAmount("5000", sellOffer.token.decimals);
  const buyAmount = parseAmount("2.5", buyOffer.token.decimals);

  // SELL side scenarios
  {
    const taker = nextTaker(maker, takerCursor);
    const dealId = await requestDeal({
      taker,
      offer: sellOffer,
      maker,
      amount: sellAmount,
      paymentMethod: "SWIFT USD",
      paymentNote: "Need same-day settlement. Ref: SWIFT-221",
    });
    await sendChat(maker.client, dealId, "Can you share account holder name?", "maker");
    await sendChat(taker, dealId, "Name is John Murray, Bank of America.", "taker");
    await cancelAs(taker, dealId, "Client switched to SEPA route, canceling for now.");
  }

  {
    const taker = nextTaker(maker, takerCursor);
    const dealId = await requestDeal({
      taker,
      offer: sellOffer,
      maker,
      amount: sellAmount,
      paymentMethod: "Wise USD",
      paymentNote: "Sending via Wise USD balance within 15 minutes.",
    });
    await acceptAs(maker, dealId, "Locked rates, waiting for transfer receipt.");
    await sendChat(taker, dealId, "Wire initiated, attachment sent in email.", "taker");
    await markPaidAs(taker, dealId, "Transfer receipt uploaded, please confirm.");
    await releaseAs(maker.client, dealId, "Funds received with correct memo. Releasing now.");
  }

  {
    const taker = nextTaker(maker, takerCursor);
    await requestDeal({
      taker,
      offer: sellOffer,
      maker,
      amount: sellAmount,
      paymentMethod: "ACH",
      paymentNote: "Verifying receiving account before wire.",
    });
    // Leave as REQUESTED
  }

  {
    const taker = nextTaker(maker, takerCursor);
    const dealId = await requestDeal({
      taker,
      offer: sellOffer,
      maker,
      amount: sellAmount,
      paymentMethod: "Revolut Business",
      paymentNote: "Please confirm Revolut account details.",
    });
    await acceptAs(maker, dealId, "Account confirmed. Waiting transfer ETA.");
    // Leave as ACCEPTED
  }

  {
    const taker = nextTaker(maker, takerCursor);
    const dealId = await requestDeal({
      taker,
      offer: sellOffer,
      maker,
      amount: sellAmount,
      paymentMethod: "USDC on-chain",
      paymentNote: "Collateral securing fiat leg, sending from Coinbase Prime.",
    });
    await acceptAs(maker, dealId, "Collateral received. Waiting on fiat.");
    await markPaidAs(taker, dealId, "Swift receipt attached. Funds should land in 1h.");
    // Leave as PAID
  }

  // BUY side scenarios
  {
    const taker = nextTaker(maker, takerCursor);
    const dealId = await requestDeal({
      taker,
      offer: buyOffer,
      maker,
      amount: buyAmount,
      paymentMethod: "PromptPay",
      paymentNote: "Quoting PromptPay, need payer name for invoice.",
    });
    await sendChat(taker, dealId, "Invoice draft shared, waiting confirmation.", "taker");
    await cancelAs(maker.client, dealId, "Switching desk for FX coverage, canceling request.");
  }

  {
    const taker = nextTaker(maker, takerCursor);
    const dealId = await requestDeal({
      taker,
      offer: buyOffer,
      maker,
      amount: buyAmount,
      paymentMethod: "Kasikorn Bank",
      paymentNote: "Kasikorn THB wire scheduled once maker confirms totals.",
    });
    await acceptAs(maker, dealId, "Collateral received. Paying out in 5 minutes.");
    await markPaidAs(maker.client, dealId, "Kasikorn transfer executed. Receipt in chat.");
    await releaseAs(taker, dealId, "Incoming confirmed. Releasing escrow.");
  }

  {
    const taker = nextTaker(maker, takerCursor);
    await requestDeal({
      taker,
      offer: buyOffer,
      maker,
      amount: buyAmount,
      paymentMethod: "SCB PromptPay",
      paymentNote: "Need to double-check SCB account number format.",
    });
    // Leave as REQUESTED
  }

  {
    const taker = nextTaker(maker, takerCursor);
    const dealId = await requestDeal({
      taker,
      offer: buyOffer,
      maker,
      amount: buyAmount,
      paymentMethod: "Siam Commercial Bank",
      paymentNote: "Routing through Siam Commercial. Payment ETA 30m.",
    });
    await acceptAs(maker, dealId, "Deposits locked. I'll confirm once funds leave.");
    // Leave as ACCEPTED
  }

  {
    const taker = nextTaker(maker, takerCursor);
    const dealId = await requestDeal({
      taker,
      offer: buyOffer,
      maker,
      amount: buyAmount,
      paymentMethod: "Krungthai",
      paymentNote: "Krungthai corporate account is ready, waiting instructions.",
    });
    await acceptAs(maker, dealId, "Standing by for FX confirmation.");
    await markPaidAs(maker.client, dealId, "Payment initiated via Krungthai. Screenshot shared.");
    // Leave as PAID
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const appDir = path.join(rootDir, "app");
const netsDir = path.join(appDir, "networks");
const outputPath = path.join(netsDir, "hardhat.json");

await mkdir(appDir, { recursive: true });

const chainId = await publicClient.getChainId();

const output = {
  chainId,
  rpcUrl: "http://127.0.0.1:8545",
  swap2p: swap.address,
  tokens: Object.fromEntries(
    [...tokens.entries()].map(([key, value]) => [key, value.address])
  ),
  makers: makerContexts.map((maker) => ({
    address: maker.profile.address,
    nickname: maker.profile.nickname,
  })),
};

await writeFile(outputPath, JSON.stringify(output, null, 2), "utf8");

console.log(`Seed data written to ${path.relative(rootDir, outputPath)}`);
console.log("Local Hardhat network is now populated with offers and deals.");
