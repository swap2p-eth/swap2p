import {
  type Account,
  type Address,
  type Chain,
  type Hash,
  type Hex,
  type PublicClient,
  type Transport,
  type WalletClient,
  getAddress,
} from "viem";
import { swap2pAbi } from "@/lib/swap2p/generated";
import { DEFAULT_PARTNER_ADDRESS } from "@/config";
import { error as logError, warn as logWarn } from "@/lib/logger";
import type {
  CancelDealArgs,
  CancelRequestArgs,
  Deal,
  DealChatMessage,
  MakerAcceptRequestArgs,
  MakerDeleteOfferArgs,
  MakerMakeOfferArgs,
  MakerProfile,
  MarkFiatPaidArgs,
  Offer,
  OfferFilter,
  OfferKey,
  OfferWithKey,
  PaginationArgs,
  ReleaseDealArgs,
  SendMessageArgs,
  SetOnlineArgs,
  SetNicknameArgs,
  SetChatPublicKeyArgs,
  Swap2pAdapter,
  TakerRequestOfferArgs,
  DealsQuery,
} from "./types";
import { SwapDealState, SwapSide } from "./types";
import {
  ZERO,
  ZERO_BYTES32,
  asHex,
  debugLog,
  decodeBytes32,
  encodeBytes32,
  requireDealId,
  toBigInt,
  toBytes32,
  toNumber,
} from "./utils";
import { isUserRejectedError } from "@/lib/errors";

type AnyPublicClient = PublicClient<Transport, Chain | undefined>;
type AnyWalletClient = WalletClient<Transport, Chain | undefined, Account>;

export type Swap2pViemAdapterConfig = {
  address: Address;
  publicClient: AnyPublicClient;
  walletClient?: AnyWalletClient;
};

type ReadArgs<Fn extends string, Args extends readonly unknown[]> = {
  functionName: Fn;
  args: Args;
};

const DEFAULT_LIMIT = 100;

type Swap2pWriteFunctionName = Extract<
  (typeof swap2pAbi)[number],
  { type: "function"; stateMutability: "nonpayable" | "payable" }
>["name"];

const normalizeAccount = (
  walletClient: AnyWalletClient | undefined,
  fallback: Address | undefined,
) => {
  if (fallback) {
    return fallback;
  }
  const configured = walletClient?.account;
  if (configured?.address) {
    return getAddress(configured.address);
  }
  return undefined;
};

const toSide = (value: bigint | number): SwapSide => {
  const numeric = toNumber(value);
  return numeric === SwapSide.SELL ? SwapSide.SELL : SwapSide.BUY;
};

const toDealState = (value: bigint | number): SwapDealState => {
  const numeric = toNumber(value);
  if (
    numeric === SwapDealState.REQUESTED ||
    numeric === SwapDealState.ACCEPTED ||
    numeric === SwapDealState.PAID ||
    numeric === SwapDealState.RELEASED ||
    numeric === SwapDealState.CANCELED
  ) {
    return numeric;
  }
  return SwapDealState.NONE;
};

// contract fiat fields carry ISO country codes (see encodeCountryCode)
const mapOfferStruct = (raw: any): Offer | null => {
  if (!raw) return null;
  const maxAmt = raw.maxAmt ?? raw[1];
  if (maxAmt === undefined) return null;
  const maxBigInt = toBigInt(maxAmt);
  if (maxBigInt === ZERO) return null;
  const token = raw.token ?? raw[6] ?? "0x0000000000000000000000000000000000000000";
  const maker = raw.maker ?? raw[7] ?? "0x0000000000000000000000000000000000000000";
  const fiat = raw.fiat ?? raw[4] ?? 0;
  const side = raw.side ?? raw[5] ?? SwapSide.BUY;
  return {
    minAmount: toBigInt(raw.minAmt ?? raw[0] ?? 0),
    maxAmount: maxBigInt,
    priceFiatPerToken: toBigInt(raw.priceFiatPerToken ?? raw[2] ?? 0),
    fiat: toNumber(fiat),
    side: toSide(side),
    token: getAddress(token),
    paymentMethods: raw.paymentMethods ?? raw[8] ?? "",
    requirements:
      raw.requirements !== undefined
        ? String(raw.requirements)
        : raw[9] !== undefined
        ? String(raw[9])
        : "",
    updatedAt: toNumber(raw.ts ?? raw[3] ?? 0),
    maker: getAddress(maker),
  };
};

const mapOfferInfo = (raw: any): OfferWithKey | null => {
  if (!raw) return null;
  const offerStruct = raw.offer ?? raw[2];
  const offer = mapOfferStruct(offerStruct);
  if (!offer) return null;
  const maker = raw.maker ?? raw[1] ?? offer.maker;
  const idValue = raw.id ?? raw[0];
  const idHex = toBytes32(idValue);
  if (!idHex) return null;
  let onlineValue: boolean | undefined;
  if (typeof raw === "object") {
    if ("online" in raw && typeof raw.online === "boolean") {
      onlineValue = raw.online;
    } else if (Array.isArray(raw) && raw.length > 3) {
      const candidate = raw[3];
      if (typeof candidate === "boolean") {
        onlineValue = candidate;
      }
    }
  }
  return {
    id: idHex,
    key: {
      token: offer.token,
      side: offer.side,
      fiat: offer.fiat,
      maker: getAddress(maker),
    },
    offer: {
      ...offer,
      maker: getAddress(maker),
    },
    online: onlineValue,
  };
};

const mapDeal = (id: Hex, raw: any): Deal | null => {
  if (!raw) return null;
  const amount = raw.amount ?? raw[0] ?? 0;
  const price = raw.price ?? raw[1] ?? 0;
  const fiat = raw.fiat ?? raw[2] ?? 0;
  const stateValue = raw.state ?? raw[3] ?? SwapDealState.NONE;
  const sideValue = raw.side ?? raw[4] ?? SwapSide.BUY;
  const tsRequest = raw.tsRequest ?? raw[5] ?? 0;
  const tsLast = raw.tsLast ?? raw[6] ?? tsRequest ?? 0;
  const makerAddr = raw.maker ?? raw[7] ?? "0x0000000000000000000000000000000000000000";
  const takerAddr = raw.taker ?? raw[8] ?? "0x0000000000000000000000000000000000000000";
  const tokenAddr = raw.token ?? raw[9] ?? "0x0000000000000000000000000000000000000000";
  const paymentMethodRaw = raw.paymentMethod ?? raw[10] ?? "";
  const chatSource = raw.chat ?? raw[11];

  const state = toDealState(stateValue);
  if (state === SwapDealState.NONE) return null;
  const paymentMethod =
    paymentMethodRaw !== undefined ? String(paymentMethodRaw) : "";
  const chatRaw = Array.isArray(chatSource) ? chatSource : Array.isArray(raw.chat) ? raw.chat : [];
  const chat: DealChatMessage[] = chatRaw.map((entry: any) => {
    const ts = toNumber(entry?.ts ?? entry?.[0] ?? 0);
    const toMaker = Boolean(entry?.toMaker ?? entry?.[1] ?? false);
    const rawState = entry?.state ?? entry?.[2] ?? SwapDealState.NONE;
    const payload = asHex(entry?.text ?? entry?.[3]) ?? "0x";
    return {
      timestamp: ts,
      toMaker,
      state: toDealState(rawState),
      payload,
    };
  });
  return {
    id: BigInt(id),
    amount: toBigInt(amount),
    price: toBigInt(price),
    state,
    side: toSide(sideValue),
    maker: getAddress(makerAddr),
    taker: getAddress(takerAddr),
    fiat: toNumber(fiat),
    requestedAt: toNumber(tsRequest),
    updatedAt: toNumber(tsLast || tsRequest),
    token: getAddress(tokenAddr),
    paymentMethod,
    chat,
  };
};

const mapDealInfo = (entry: any): Deal | null => {
  if (!entry) return null;
  const idValue = entry.id ?? entry[0];
  const rawDeal = entry.deal ?? entry[1];
  const bytesId = toBytes32(idValue);
  if (!bytesId) return null;
  return mapDeal(bytesId, rawDeal);
};

const mapMakerProfile = (_address: Address, raw: any): MakerProfile | null => {
  if (!raw) return null;
  const dealsCancelled = Number(raw.dealsCancelled ?? raw[0] ?? 0);
  const dealsCompleted = Number(raw.dealsCompleted ?? raw[1] ?? 0);
  const online = Boolean(raw.online ?? raw[2] ?? false);
  const nicknameRaw = raw.nickname ?? raw[3];
  const chatPublicKeyRaw = raw.chatPublicKey ?? raw[4];
  return {
    online,
    dealsCancelled,
    dealsCompleted,
    nickname: decodeBytes32(nicknameRaw),
    chatPublicKey: decodeBytes32(chatPublicKeyRaw),
  };
};

const ensureWalletClient = (
  walletClient: AnyWalletClient | undefined,
  action: string,
) => {
  if (!walletClient) {
    throw new Error(
      `Swap2pViemAdapter: wallet client is required to call ${action}`,
    );
  }
  return walletClient;
};

const simulateAndWrite = async (
  walletClient: AnyWalletClient,
  publicClient: AnyPublicClient,
  address: Address,
  functionName: Swap2pWriteFunctionName,
  args: readonly unknown[],
  account: Address,
  value?: bigint,
): Promise<Hash> => {
  debugLog("[swap2p][simulate]", {
    functionName,
    args,
    account,
    value,
  });
  try {
    const { request } = await publicClient.simulateContract({
      address,
      abi: swap2pAbi,
      functionName,
      args: args as any,
      account,
      value,
    } as any);
    debugLog("[swap2p][write]", {
      functionName,
      account,
      request,
    });
    const txHash = await walletClient.writeContract(request);
    debugLog("[swap2p][write:submitted]", {
      functionName,
      hash: txHash,
    });
    return txHash;
  } catch (error) {
    const payload = {
      functionName,
      account,
      args,
      value,
      error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
    };
    const log = isUserRejectedError(error) ? logWarn : logError;
    log("swap2p:simulate", "error", payload);
    debugLog("[swap2p][simulate:error]", payload);
    throw error;
  }
};

export const createSwap2pViemAdapter = (
  config: Swap2pViemAdapterConfig,
): Swap2pAdapter => {
  const { address, publicClient, walletClient } = config;

  const read = async <Fn extends string, Args extends readonly unknown[]>(
    params: ReadArgs<Fn, Args>,
  ) =>
    (async () => {
      debugLog("[swap2p][read]", {
        functionName: params.functionName,
        args: params.args,
      });
      try {
        const result = await publicClient.readContract({
          address,
          abi: swap2pAbi,
          functionName: params.functionName,
          args: params.args,
        } as any);
        debugLog("[swap2p][read:result]", {
          functionName: params.functionName,
          result,
        });
        return result;
      } catch (error) {
        const payload = {
          functionName: params.functionName,
          args: params.args,
          error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
        };
        const log = isUserRejectedError(error) ? logWarn : logError;
        log("swap2p:read", "error", payload);
        debugLog("[swap2p][read:error]", payload);
        throw error;
      }
    })();

  const readDeal = async (id: Hex): Promise<Deal | null> => {
    const raw = (await read({
      functionName: "deals",
      args: [id] as const,
    })) as any;
    if (!raw) return null;
    const stateValue = raw.state ?? raw[3] ?? SwapDealState.NONE;
    const state = toDealState(stateValue);
    if (state === SwapDealState.NONE) return null;
    const chatLengthRaw = await read({
      functionName: "getDealChatLength",
      args: [id] as const,
    });
    const chatLength = toNumber(chatLengthRaw as bigint | number);
    let chat: unknown[] = [];
    if (chatLength > 0) {
      chat = (await read({
        functionName: "getDealChatSlice",
        args: [id, 0n, BigInt(chatLength)] as const,
      })) as unknown[];
    }
    const structured = {
      amount: raw.amount ?? raw[0],
      price: raw.price ?? raw[1],
      fiat: raw.fiat ?? raw[2],
      state: stateValue,
      side: raw.side ?? raw[4],
      tsRequest: raw.tsRequest ?? raw[5],
      tsLast: raw.tsLast ?? raw[6],
      maker: raw.maker ?? raw[7],
      taker: raw.taker ?? raw[8],
      token: raw.token ?? raw[9],
      paymentMethod: raw.paymentMethod ?? raw[10],
      chat,
    };
    return mapDeal(id, structured);
  };

  const fetchMarketOffers = async (
    filter: OfferFilter & PaginationArgs,
  ): Promise<OfferWithKey[]> => {
    const pageSize = Math.max(filter.limit ?? DEFAULT_LIMIT, DEFAULT_LIMIT);
    let offset = filter.offset ?? 0;
    const items: OfferWithKey[] = [];
    for (;;) {
      const rawPage = (await read({
        functionName: "getMarketOffers",
        args: [filter.token, filter.side, filter.fiat, offset, pageSize] as const,
      })) as readonly unknown[] | null;
      if (!rawPage || rawPage.length === 0) break;
      const page = rawPage
        .map((entry) => mapOfferInfo(entry))
        .filter((entry): entry is OfferWithKey => entry !== null);
      items.push(...page);
      if (rawPage.length < pageSize) break;
      offset += pageSize;
    }
    return items;
  };

  const fetchMakerOffers = async (maker: Address): Promise<OfferWithKey[]> => {
    const pageSize = DEFAULT_LIMIT;
    let offset = 0;
    const items: OfferWithKey[] = [];
    for (;;) {
      const rawPage = (await read({
        functionName: "getMakerOffers",
        args: [getAddress(maker), offset, pageSize] as const,
      })) as readonly unknown[] | null;
      if (!rawPage || rawPage.length === 0) break;
      const page = rawPage
        .map((entry) => mapOfferInfo(entry))
        .filter((entry): entry is OfferWithKey => entry !== null);
      items.push(...page);
      if (rawPage.length < pageSize) break;
      offset += pageSize;
    }
    return items;
  };

  const fetchDealsDetailed = async (
    fnName: "getOpenDealsDetailed" | "getRecentDealsDetailed",
    user: Address,
  ): Promise<Deal[]> => {
    const pageSize = DEFAULT_LIMIT;
    let offset = 0;
    const items: Deal[] = [];
    for (;;) {
      const rawPage = (await read({
        functionName: fnName,
        args: [user, offset, pageSize] as const,
      })) as readonly unknown[] | null;
      if (!rawPage || rawPage.length === 0) break;
      const page = rawPage
        .map((entry) => mapDealInfo(entry))
        .filter((entry): entry is Deal => entry !== null);
      items.push(...page);
      if (rawPage.length < pageSize) break;
      offset += pageSize;
    }
    return items;
  };

  const withAccount = (account?: Address) =>
    normalizeAccount(walletClient, account);

  return {
    mode: "viem",
    address,

    async getOfferCount(filter: OfferFilter) {
      const result = await read({
        functionName: "getOfferCount",
        args: [filter.token, filter.side, filter.fiat] as const,
      });
      return toNumber(result as bigint | number);
    },

    async getOfferKeys(filter: OfferFilter & PaginationArgs) {
      const offers = await fetchMarketOffers(filter);
      return offers.map(({ key }) => key);
    },

    async getOffer(key: OfferKey) {
      const id = await read({
        functionName: "getOfferId",
        args: [key.token, key.maker, key.side, key.fiat] as const,
      });
      const offerId = toBytes32(id);
      if (!offerId || offerId === ZERO_BYTES32) {
        return null;
      }
      try {
        if (BigInt(offerId) === ZERO) {
          return null;
        }
      } catch (error) {
        const err = error instanceof Error ? error.message : String(error);
        debugLog("[swap2p][warn:getOfferId]", { error: err });
        return null;
      }
      try {
        const raw = await read({
          functionName: "offers",
          args: [offerId] as const,
        }) as readonly unknown[];
        if (!raw) return null;
        const mapped = mapOfferStruct({
          minAmt: raw[0],
          maxAmt: raw[1],
          priceFiatPerToken: raw[2],
          ts: raw[3],
          fiat: raw[4],
          side: raw[5],
          token: raw[6],
          maker: raw[7],
          paymentMethods: raw[8],
          requirements: raw[9],
        });
        if (!mapped) return null;
        return mapped;
      } catch (error) {
        const err = error instanceof Error ? error.message : String(error);
        debugLog("[swap2p][warn:getOffer]", { error: err, offerId });
        return null;
      }
    },

    async getOffers(filter: OfferFilter & PaginationArgs) {
      return fetchMarketOffers(filter);
    },

    async getMakerOffers({ maker, offset = 0, limit = DEFAULT_LIMIT }) {
      void offset;
      void limit;
      return fetchMakerOffers(maker);
    },

    async getDeal(id: bigint) {
      const bytes = toBytes32(id);
      if (!bytes || bytes === ZERO_BYTES32) return null;
      const deal = await readDeal(bytes);
      return deal;
    },

    async getOpenDeals(query: DealsQuery) {
      debugLog("[mydeals] getOpenDeals:request", {
        user: query.user,
      });
      const deals = await fetchDealsDetailed("getOpenDealsDetailed", query.user);
      debugLog("[mydeals] getOpenDeals:deals", {
        count: deals.length,
      });
      return deals;
    },

    async getRecentDeals(query: DealsQuery) {
      debugLog("[mydeals] getRecentDeals:request", {
        user: query.user,
      });
      const deals = await fetchDealsDetailed("getRecentDealsDetailed", query.user);
      debugLog("[mydeals] getRecentDeals:deals", {
        count: deals.length,
      });
      return deals;
    },

    async getMakerProfile(addr: Address) {
      const raw = await read({
        functionName: "makerInfo",
        args: [addr] as const,
      });
      return mapMakerProfile(addr, raw);
    },

    async getMakerProfiles(addresses: Address[]) {
      if (addresses.length === 0) return [];
      const raw = (await read({
        functionName: "getMakerProfiles",
        args: [addresses] as const,
      })) as readonly unknown[] | null;
      if (!raw) {
        return addresses.map(
          () =>
            ({
              online: false,
              nickname: "",
              dealsCancelled: 0,
              dealsCompleted: 0,
              chatPublicKey: "",
            }) satisfies MakerProfile,
        );
      }
      return addresses.map(
        (addr, index) =>
          mapMakerProfile(addr, raw[index]) ?? {
            online: false,
            nickname: "",
            dealsCancelled: 0,
            dealsCompleted: 0,
            chatPublicKey: "",
          },
      );
    },

    async setOnline({ account, online }: SetOnlineArgs) {
      const sender = withAccount(account);
      const signer = ensureWalletClient(walletClient, "setOnline");
      if (!sender) {
        throw new Error("Swap2pViemAdapter: account is required for setOnline");
      }
      return simulateAndWrite(
        signer,
        publicClient,
        address,
        "setOnline",
        [online] as const,
        sender,
      );
    },

    async setNickname({ account, nickname }: SetNicknameArgs) {
      const sender = withAccount(account);
      const signer = ensureWalletClient(walletClient, "setNickname");
      if (!sender) {
        throw new Error(
          "Swap2pViemAdapter: account is required for setNickname",
        );
      }
      const encoded = encodeBytes32(nickname);
      return simulateAndWrite(
        signer,
        publicClient,
        address,
        "setNickname",
        [encoded] as const,
        sender,
      );
    },

    async setChatPublicKey({ account, chatPublicKey }: SetChatPublicKeyArgs) {
      const sender = withAccount(account);
      const signer = ensureWalletClient(walletClient, "setChatPublicKey");
      if (!sender) {
        throw new Error(
          "Swap2pViemAdapter: account is required for setChatPublicKey",
        );
      }
      const encoded = encodeBytes32(chatPublicKey);
      return simulateAndWrite(
        signer,
        publicClient,
        address,
        "setChatPublicKey",
        [encoded] as const,
        sender,
      );
    },

    async makerMakeOffer(args: MakerMakeOfferArgs) {
      const {
        account,
        token,
        side,
        fiat,
        price,
        minAmount,
        maxAmount,
        paymentMethods,
        requirements,
        partner,
      } = args;
      const sender = withAccount(account);
      const signer = ensureWalletClient(walletClient, "maker_makeOffer");
      if (!sender) {
        throw new Error(
          "Swap2pViemAdapter: account is required for maker_makeOffer",
        );
      }
      const partnerAddress = partner ?? DEFAULT_PARTNER_ADDRESS;
      return simulateAndWrite(
        signer,
        publicClient,
        address,
        "maker_makeOffer",
        [
          token,
          side,
          fiat,
          price,
          minAmount,
          maxAmount,
          paymentMethods,
          requirements ?? "",
          partnerAddress,
        ] as const,
        sender,
      );
    },

    async makerDeleteOffer(args: MakerDeleteOfferArgs) {
      const { account, token, side, fiat } = args;
      const sender = withAccount(account);
      const signer = ensureWalletClient(walletClient, "maker_deleteOffer");
      if (!sender) {
        throw new Error(
          "Swap2pViemAdapter: account is required for maker_deleteOffer",
        );
      }
      return simulateAndWrite(
        signer,
        publicClient,
        address,
        "maker_deleteOffer",
        [token, side, fiat] as const,
        sender,
      );
    },

    async takerRequestOffer(args: TakerRequestOfferArgs) {
      const {
        account,
        token,
        side,
        maker,
        amount,
        fiat,
        expectedPrice,
        paymentMethod,
        details,
        partner,
      } = args;
      const sender = withAccount(account);
      const signer = ensureWalletClient(walletClient, "taker_requestOffer");
      if (!sender) {
        throw new Error(
          "Swap2pViemAdapter: account is required for taker_requestOffer",
        );
      }
      return simulateAndWrite(
        signer,
        publicClient,
        address,
        "taker_requestOffer",
        [
          token,
          side,
          maker,
          amount,
          fiat,
          expectedPrice,
          paymentMethod ?? "",
          details ?? "",
          partner ?? DEFAULT_PARTNER_ADDRESS,
        ] as const,
        sender,
      );
    },

    async makerAcceptRequest(args: MakerAcceptRequestArgs) {
      const sender = withAccount(args.account);
      const signer = ensureWalletClient(walletClient, "maker_acceptRequest");
      if (!sender) {
        throw new Error(
          "Swap2pViemAdapter: account is required for maker_acceptRequest",
        );
      }
      const id = requireDealId(args.id, "maker_acceptRequest");
      return simulateAndWrite(
        signer,
        publicClient,
        address,
        "maker_acceptRequest",
        [id, asHex(args.message) ?? "0x"] as const,
        sender,
      );
    },

    async cancelRequest(args: CancelRequestArgs) {
      const sender = withAccount(args.account);
      const signer = ensureWalletClient(walletClient, "cancelRequest");
      if (!sender) {
        throw new Error(
          "Swap2pViemAdapter: account is required for cancelRequest",
        );
      }
      const id = requireDealId(args.id, "cancelRequest");
      return simulateAndWrite(
        signer,
        publicClient,
        address,
        "cancelRequest",
        [id, asHex(args.reason) ?? "0x"] as const,
        sender,
      );
    },

    async cancelDeal(args: CancelDealArgs) {
      const sender = withAccount(args.account);
      const signer = ensureWalletClient(walletClient, "cancelDeal");
      if (!sender) {
        throw new Error(
          "Swap2pViemAdapter: account is required for cancelDeal",
        );
      }
      const id = requireDealId(args.id, "cancelDeal");
      return simulateAndWrite(
        signer,
        publicClient,
        address,
        "cancelDeal",
        [id, asHex(args.reason) ?? "0x"] as const,
        sender,
      );
    },

    async markFiatPaid(args: MarkFiatPaidArgs) {
      const sender = withAccount(args.account);
      const signer = ensureWalletClient(walletClient, "markFiatPaid");
      if (!sender) {
        throw new Error(
          "Swap2pViemAdapter: account is required for markFiatPaid",
        );
      }
      const id = requireDealId(args.id, "markFiatPaid");
      return simulateAndWrite(
        signer,
        publicClient,
        address,
        "markFiatPaid",
        [id, asHex(args.message) ?? "0x"] as const,
        sender,
      );
    },

    async release(args: ReleaseDealArgs) {
      const sender = withAccount(args.account);
      const signer = ensureWalletClient(walletClient, "release");
      if (!sender) {
        throw new Error("Swap2pViemAdapter: account is required for release");
      }
      const id = requireDealId(args.id, "release");
      return simulateAndWrite(
        signer,
        publicClient,
        address,
        "release",
        [id, asHex(args.message) ?? "0x"] as const,
        sender,
      );
    },

    async sendMessage(args: SendMessageArgs) {
      const sender = withAccount(args.account);
      const signer = ensureWalletClient(walletClient, "sendMessage");
      if (!sender) {
        throw new Error(
          "Swap2pViemAdapter: account is required for sendMessage",
        );
      }
      const id = requireDealId(args.id, "sendMessage");
      return simulateAndWrite(
        signer,
        publicClient,
        address,
        "sendMessage",
        [id, asHex(args.message) ?? "0x"] as const,
        sender,
      );
    },

  };
};
