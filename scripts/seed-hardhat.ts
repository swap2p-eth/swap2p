import hardhat from "hardhat";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  maxUint256,
  parseEther,
  parseUnits,
  stringToHex,
  zeroAddress,
  type Address,
  type Hex,
} from "viem";

const { network, artifacts } = hardhat;

const USD = 840;
const THB = 764;

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
        fiat: USD,
        price: 68_350_000n,
        reserve: "6",
        min: "0.01",
        max: "2.5",
        paymentMethods: "Fedwire, Wise USD",
        requirements: "Video KYC, proof of funds",
      },
      buy: {
        fiat: THB,
        price: 2_420_000_000n,
        reserve: "4",
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
        fiat: USD,
        price: 100_050n,
        reserve: "60000",
        min: "10",
        max: "15000",
        paymentMethods: "ACH, Wise USD, Revolut",
        requirements: "Name match with bank account",
      },
      buy: {
        fiat: THB,
        price: 3_560_000n,
        reserve: "40000",
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
        fiat: USD,
        price: 100_000n,
        reserve: "70000",
        min: "50",
        max: "20000",
        paymentMethods: "ACH, Zelle",
        requirements: "US resident with KYC",
      },
      buy: {
        fiat: THB,
        price: 3_480_000n,
        reserve: "50000",
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
        fiat: USD,
        price: 3_320_000n,
        reserve: "70",
        min: "0.05",
        max: "20",
        paymentMethods: "SWIFT USD, Wise Business",
        requirements: "Company docs + compliance call",
      },
      buy: {
        fiat: THB,
        price: 120_500_000n,
        reserve: "60",
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

const [deployer, ...otherWallets] = walletClients as [WalletClientType, ...WalletClientType[]];

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

const takers = otherWallets.slice(0, 3);

if (takers.length < 2) {
  throw new Error("Need at least two taker accounts from Hardhat wallet clients.");
}

const makerContexts: MakerContext[] = [];

for (const profile of makerProfiles) {
  await testClient.setBalance({ address: profile.address, value: parseEther("500") });
  await testClient.impersonateAccount({ address: profile.address });
  const client = await hreViem.getWalletClient(profile.address);
  makerContexts.push({ profile, client, offers: [] });
}

const tokenApprovalTargets = [...makerContexts.map((m) => m.client), ...takers];

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

  for (const taker of takers) {
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
    args: [maker.profile.nickname],
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

    const sellReserve = parseAmount(sell.reserve, token.decimals);
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
        sellReserve,
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

    const buyReserve = parseAmount(buy.reserve, token.decimals);
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
        buyReserve,
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
  }
}

function nextTaker(index: { value: number }) {
  const taker = takers[index.value % takers.length];
  index.value += 1;
  return taker;
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
    const taker = nextTaker(takerCursor);
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
    const taker = nextTaker(takerCursor);
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
    const taker = nextTaker(takerCursor);
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
    const taker = nextTaker(takerCursor);
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
    const taker = nextTaker(takerCursor);
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
    const taker = nextTaker(takerCursor);
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
    const taker = nextTaker(takerCursor);
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
    const taker = nextTaker(takerCursor);
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
    const taker = nextTaker(takerCursor);
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
    const taker = nextTaker(takerCursor);
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
const outputPath = path.join(appDir, "hardhat.json");

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
