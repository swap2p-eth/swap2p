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
  isHex,
  stringToHex,
} from "viem";
import { swap2pAbi } from "@/lib/swap2p/generated";
import type {
  CancelDealArgs,
  CancelRequestArgs,
  CleanupDealsArgs,
  Deal,
  MakerAcceptRequestArgs,
  MakerDeleteOfferArgs,
  MakerMakeOfferArgs,
  MakerProfile,
  MarkFiatPaidArgs,
  Offer,
  OfferFilter,
  OfferKey,
  OfferWithKey,
  ReleaseDealArgs,
  SendMessageArgs,
  SetOnlineArgs,
  SetNicknameArgs,
  Swap2pAdapter,
  TakerRequestOfferArgs,
} from "./types";
import { SwapDealState, SwapSide } from "./types";

type AnyPublicClient = PublicClient<Transport, Chain | undefined>;
type AnyWalletClient = WalletClient<Transport, Chain | undefined, Account>;

export type Swap2pViemAdapterConfig = {
  address: Address;
  publicClient: AnyPublicClient;
  walletClient?: AnyWalletClient;
};

type ReadArgs<Fn extends string, Args extends unknown[]> = {
  functionName: Fn;
  args: Args;
};

const ZERO = 0n;

const DEFAULT_LIMIT = 20;

const normalizeAccount = (
  walletClient: AnyWalletClient | undefined,
  fallback: Address | undefined,
) => {
  if (fallback) {
    return fallback;
  }
  const configured = walletClient?.account;
  if (configured && "address" in configured) {
    return configured.address as Address;
  }
  if (typeof configured === "string") {
    return getAddress(configured);
  }
  return undefined;
};

const toNumber = (value: bigint | number) =>
  typeof value === "bigint" ? Number(value) : value;

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

const asHex = (value?: string | Hex | null) => {
  if (!value) return undefined;
  if (isHex(value, { strict: false })) {
    return value as Hex;
  }
  return stringToHex(value);
};

const mapOffer = (key: OfferKey, raw: any): Offer | null => {
  if (!raw) return null;
  const maxAmt = raw.maxAmt as bigint | number | undefined;
  if (maxAmt === undefined) return null;
  const hasOffer =
    (typeof maxAmt === "bigint" ? maxAmt : BigInt(maxAmt ?? 0)) !== ZERO;
  if (!hasOffer) return null;
  return {
    minAmount: BigInt(raw.minAmt ?? 0),
    maxAmount: BigInt(raw.maxAmt ?? 0),
    reserve: BigInt(raw.reserve ?? 0),
    priceFiatPerToken: BigInt(raw.priceFiatPerToken ?? 0),
    fiat: toNumber(raw.fiat ?? key.fiat),
    side: toSide(raw.side ?? key.side),
    token: getAddress(raw.token ?? key.token),
    paymentMethods: raw.paymentMethods ?? "",
    requirements: raw.requirements !== undefined ? String(raw.requirements) : "",
    updatedAt: toNumber(raw.ts ?? 0),
    maker: key.maker,
  };
};

const mapDeal = (id: bigint, raw: any): Deal | null => {
  if (!raw) return null;
  const state = toDealState(raw.state ?? SwapDealState.NONE);
  if (state === SwapDealState.NONE) return null;
  return {
    id,
    amount: BigInt(raw.amount ?? 0),
    price: BigInt(raw.price ?? 0),
    state,
    side: toSide(raw.side ?? SwapSide.BUY),
    maker: getAddress(raw.maker ?? "0x0000000000000000000000000000000000000000"),
    taker: getAddress(raw.taker ?? "0x0000000000000000000000000000000000000000"),
    fiat: toNumber(raw.fiat ?? 0),
    requestedAt: toNumber(raw.tsRequest ?? 0),
    updatedAt: toNumber(raw.tsLast ?? raw.tsRequest ?? 0),
    token: getAddress(raw.token ?? "0x0000000000000000000000000000000000000000"),
  };
};

const mapMakerProfile = (_address: Address, raw: any): MakerProfile | null => {
  if (!raw) return null;
  const nickname = raw.nickname ?? raw[2];
  return {
    online: Boolean(raw[0] ?? raw.online ?? false),
    lastActivity: toNumber(raw[1] ?? raw.lastActivity ?? 0),
    nickname: nickname !== undefined ? String(nickname) : "",
    dealsCancelled: Number(raw[3] ?? raw.dealsCancelled ?? 0),
    dealsCompleted: Number(raw[4] ?? raw.dealsCompleted ?? 0),
  };
};

const paginateKeys = (keys: Address[], filter: OfferFilter): OfferKey[] =>
  keys.map((maker) => ({
    ...filter,
    maker: getAddress(maker),
  }));

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
  functionName: string,
  args: readonly unknown[],
  account: Address,
  value?: bigint,
): Promise<Hash> => {
  const { request } = await publicClient.simulateContract({
    address,
    abi: swap2pAbi,
    functionName,
    args,
    account,
    value,
  });
  return walletClient.writeContract(request);
};

export const createSwap2pViemAdapter = (
  config: Swap2pViemAdapterConfig,
): Swap2pAdapter => {
  const { address, publicClient, walletClient } = config;

  const read = async <Fn extends string, Args extends readonly unknown[]>(
    params: ReadArgs<Fn, Args>,
  ) =>
    publicClient.readContract({
      address,
      abi: swap2pAbi,
      functionName: params.functionName,
      args: params.args,
    } as any);

  const readOfferStruct = async (key: OfferKey) => {
    const raw = await read({
      functionName: "offers",
      args: [key.token, key.maker, key.side, key.fiat] as const,
    });
    return mapOffer(key, raw);
  };

  const readDealStruct = async (id: bigint) => {
    const raw = await read({
      functionName: "deals",
      args: [id],
    });
    return mapDeal(id, raw);
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

    async getOfferKeys(filter) {
      const limit = filter.limit ?? DEFAULT_LIMIT;
      const offset = filter.offset ?? 0;
      const result = (await read({
        functionName: "getOfferKeys",
        args: [filter.token, filter.side, filter.fiat, offset, limit] as const,
      })) as Address[];
      return paginateKeys(result ?? [], filter);
    },

    async getOffer(key) {
      return readOfferStruct(key);
    },

    async getOffers(filter) {
      const keys = await this.getOfferKeys(filter);
      if (keys.length === 0) return [];
      const offers = await Promise.all(keys.map(readOfferStruct));
      return offers
        .map((offer, index) =>
          offer
            ? ({
                key: keys[index],
                offer,
              } as OfferWithKey)
            : null,
        )
        .filter((item): item is OfferWithKey => item !== null);
    },

    async getDeal(id) {
      return readDealStruct(id);
    },

    async getOpenDeals(query) {
      const limit = query.limit ?? DEFAULT_LIMIT;
      const offset = query.offset ?? 0;
      const ids = (await read({
        functionName: "getOpenDeals",
        args: [query.user, offset, limit] as const,
      })) as bigint[] | number[];
      if (!ids || ids.length === 0) return [];
      const deals = await Promise.all(
        ids.map((value) => readDealStruct(BigInt(value))),
      );
      return deals.filter((deal): deal is Deal => deal !== null);
    },

    async getRecentDeals(query) {
      const limit = query.limit ?? DEFAULT_LIMIT;
      const offset = query.offset ?? 0;
      const ids = (await read({
        functionName: "getRecentDeals",
        args: [query.user, offset, limit] as const,
      })) as bigint[] | number[];
      if (!ids || ids.length === 0) return [];
      const deals = await Promise.all(
        ids.map((value) => readDealStruct(BigInt(value))),
      );
      return deals.filter((deal): deal is Deal => deal !== null);
    },

    async getMakerProfile(addr) {
      const raw = await read({
        functionName: "makerInfo",
        args: [addr] as const,
      });
      return mapMakerProfile(addr, raw);
    },

    async getMakerProfiles(addresses) {
      if (addresses.length === 0) return [];
      const raw = (await read({
        functionName: "getMakerProfiles",
        args: [addresses] as const,
      })) as readonly unknown[] | null;
      if (!raw) {
        return addresses.map(() => ({
          online: false,
          lastActivity: 0,
          nickname: "",
          dealsCancelled: 0,
          dealsCompleted: 0,
        }));
      }
      return addresses.map((addr, index) =>
        mapMakerProfile(addr, raw[index]) ?? {
          online: false,
          lastActivity: 0,
          nickname: "",
          dealsCancelled: 0,
          dealsCompleted: 0,
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
      return simulateAndWrite(
        signer,
        publicClient,
        address,
        "setNickname",
        [nickname] as const,
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
        reserve,
        minAmount,
        maxAmount,
        paymentMethods,
        requirements,
        comment,
      } = args;
      const sender = withAccount(account);
      const signer = ensureWalletClient(walletClient, "maker_makeOffer");
      if (!sender) {
        throw new Error(
          "Swap2pViemAdapter: account is required for maker_makeOffer",
        );
      }
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
          reserve,
          minAmount,
          maxAmount,
          {
            paymentMethods,
            requirements: requirements ?? "",
            comment: comment ?? "",
          },
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
          details ?? "",
          partner ?? "0x0000000000000000000000000000000000000000",
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
      return simulateAndWrite(
        signer,
        publicClient,
        address,
        "maker_acceptRequest",
        [args.id, asHex(args.message) ?? "0x"] as const,
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
      return simulateAndWrite(
        signer,
        publicClient,
        address,
        "cancelRequest",
        [args.id, asHex(args.reason) ?? "0x"] as const,
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
      return simulateAndWrite(
        signer,
        publicClient,
        address,
        "cancelDeal",
        [args.id, asHex(args.reason) ?? "0x"] as const,
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
      return simulateAndWrite(
        signer,
        publicClient,
        address,
        "markFiatPaid",
        [args.id, asHex(args.message) ?? "0x"] as const,
        sender,
      );
    },

    async release(args: ReleaseDealArgs) {
      const sender = withAccount(args.account);
      const signer = ensureWalletClient(walletClient, "release");
      if (!sender) {
        throw new Error("Swap2pViemAdapter: account is required for release");
      }
      return simulateAndWrite(
        signer,
        publicClient,
        address,
        "release",
        [args.id, asHex(args.message) ?? "0x"] as const,
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
      return simulateAndWrite(
        signer,
        publicClient,
        address,
        "sendMessage",
        [args.id, asHex(args.message) ?? "0x"] as const,
        sender,
      );
    },

    async cleanupDeals(args: CleanupDealsArgs) {
      const sender = withAccount(args.account);
      const signer = ensureWalletClient(walletClient, "cleanupDeals");
      if (!sender) {
        throw new Error(
          "Swap2pViemAdapter: account is required for cleanupDeals",
        );
      }
      return simulateAndWrite(
        signer,
        publicClient,
        address,
        "cleanupDeals",
        [args.ids, BigInt(args.minAgeHours)] as const,
        sender,
      );
    },
  };
};
