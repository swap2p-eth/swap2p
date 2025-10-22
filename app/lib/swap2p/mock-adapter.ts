import { getAddress, isHex, stringToHex, type Address, type Hash } from "viem";
import {
  type CancelDealArgs,
  type CancelRequestArgs,
  type CleanupDealsArgs,
  type Deal,
  type DealChatMessage,
  type DealsQuery,
  type MakerAcceptRequestArgs,
  type MakerDeleteOfferArgs,
  type MakerMakeOfferArgs,
  type MakerProfile,
  type MarkFiatPaidArgs,
  type Offer,
  type OfferFilter,
  type OfferKey,
  type OfferWithKey,
  type ReleaseDealArgs,
  type SendMessageArgs,
  type SetOnlineArgs,
  type SetNicknameArgs,
  type Swap2pAdapter,
  type TakerRequestOfferArgs,
  SwapDealState,
  SwapSide,
} from "./types";
import {
  mockAffiliates,
  mockDeals,
  mockMakers,
  mockOffers,
} from "./mock-seed";

type MockDealRecord = Deal;

type MockState = {
  offers: Map<string, Offer>;
  offerIndex: Map<string, Address[]>;
  deals: Map<bigint, MockDealRecord>;
  openDeals: Map<Address, bigint[]>;
  recentDeals: Map<Address, bigint[]>;
  makerInfo: Map<Address, MakerProfile>;
  affiliates: Map<Address, Address>;
  nicknames: Map<string, Address>;
  nextDealId: bigint;
  txCounter: bigint;
};

const HOURS = 60 * 60;
const MIN_CLEANUP_AGE_HOURS = 48;
const ADDRESS_ZERO = "0x0000000000000000000000000000000000000000" as Address;

class MockSwap2pError extends Error {
  constructor(code: string) {
    super(code);
    this.name = code;
  }
}

const now = () => Math.floor(Date.now() / 1000);

const makeIndexKey = (filter: OfferFilter) =>
  `${filter.token.toLowerCase()}|${filter.side}|${filter.fiat}`;

const makeOfferKey = (key: OfferKey) =>
  `${key.token.toLowerCase()}|${key.side}|${key.fiat}|${key.maker.toLowerCase()}`;

const cloneOffer = (offer: Offer): Offer => ({
  ...offer,
});

const makeEmptyProfile = (): MakerProfile => ({
  online: false,
  lastActivity: 0,
  nickname: "",
  dealsCancelled: 0,
  dealsCompleted: 0,
});

const cloneDeal = (deal: MockDealRecord): Deal => ({
  id: deal.id,
  amount: deal.amount,
  price: deal.price,
  state: deal.state,
  side: deal.side,
  maker: deal.maker,
  taker: deal.taker,
  fiat: deal.fiat,
  requestedAt: deal.requestedAt,
  updatedAt: deal.updatedAt,
  token: deal.token,
  paymentMethod: deal.paymentMethod,
  chat: deal.chat.map((entry) => ({ ...entry })),
});

const paginate = <T>(items: readonly T[], offset = 0, limit = 20): T[] => {
  if (offset >= items.length) {
    return [];
  }
  const end = Math.min(items.length, offset + limit);
  return Array.from(items.slice(offset, end));
};

const createHashGenerator = () => {
  let counter = 1n;
  return () => {
    const hex = counter.toString(16).padStart(64, "0");
    counter += 1n;
    return (`0x${hex}`) as Hash;
  };
};

const applyHoursAgo = (hoursAgo: number) => now() - Math.floor(hoursAgo * HOURS);

const buildInitialState = (): MockState => {
  const offers = new Map<string, Offer>();
  const offerIndex = new Map<string, Address[]>();
  const deals = new Map<bigint, MockDealRecord>();
  const openDeals = new Map<Address, bigint[]>();
  const recentDeals = new Map<Address, bigint[]>();
  const makerInfo = new Map<Address, MakerProfile>();
  const affiliates = new Map<Address, Address>();
  const nicknames = new Map<string, Address>();
  let maxId = 0n;

  for (const seed of mockMakers) {
    const address = getAddress(seed.address);
    makerInfo.set(address, {
      online: seed.online,
      lastActivity: applyHoursAgo(seed.lastActiveHoursAgo),
      nickname: seed.nickname ?? "",
      dealsCancelled: seed.dealsCancelled ?? 0,
      dealsCompleted: seed.dealsCompleted ?? 0,
    });
    if (seed.nickname) {
      nicknames.set(seed.nickname.trim().toLowerCase(), address);
    }
  }

  for (const seed of mockAffiliates) {
    affiliates.set(getAddress(seed.taker), getAddress(seed.partner));
  }

  for (const seed of mockOffers) {
    const key: OfferKey = {
      token: getAddress(seed.token),
      maker: getAddress(seed.maker),
      side: seed.side,
      fiat: seed.fiat,
    };
    const offer: Offer = {
      minAmount: BigInt(seed.minAmount),
      maxAmount: BigInt(seed.maxAmount),
      reserve: BigInt(seed.reserve),
      priceFiatPerToken: BigInt(seed.priceFiatPerToken),
      fiat: seed.fiat,
      side: seed.side,
      token: key.token,
      paymentMethods: seed.paymentMethods,
      requirements: seed.requirements ?? "",
      updatedAt: applyHoursAgo(seed.updatedHoursAgo),
      maker: key.maker,
    };
    offers.set(makeOfferKey(key), offer);
    const indexKey = makeIndexKey(key);
    const list = offerIndex.get(indexKey) ?? [];
    if (!list.includes(key.maker)) {
      list.push(key.maker);
    }
    offerIndex.set(indexKey, list);
  }

  for (const seed of mockDeals) {
    const id = BigInt(seed.id);
    if (id > maxId) {
      maxId = id;
    }
    const maker = getAddress(seed.maker);
    const taker = getAddress(seed.taker);
    const deal: MockDealRecord = {
      id,
      amount: BigInt(seed.amount),
      price: BigInt(seed.price),
      state: seed.state,
      side: seed.side,
      maker,
      taker,
      fiat: seed.fiat,
      requestedAt: applyHoursAgo(seed.requestedHoursAgo),
      updatedAt: applyHoursAgo(seed.updatedHoursAgo),
      token: getAddress(seed.token),
      paymentMethod: seed.paymentMethod,
      chat: (seed.chat ?? []).map((entry) => ({
        timestamp: applyHoursAgo(entry.hoursAgo),
        toMaker: entry.toMaker,
        state: entry.state,
        payload: isHex(entry.payload, { strict: false })
          ? entry.payload
          : stringToHex(entry.payload),
      })),
    };
    deals.set(id, deal);
    if (
      deal.state === SwapDealState.RELEASED ||
      deal.state === SwapDealState.CANCELED
    ) {
      const makerRecent = recentDeals.get(maker) ?? [];
      makerRecent.push(id);
      recentDeals.set(maker, makerRecent);
      const takerRecent = recentDeals.get(taker) ?? [];
      takerRecent.push(id);
      recentDeals.set(taker, takerRecent);
    } else if (deal.state !== SwapDealState.NONE) {
      const makerOpen = openDeals.get(maker) ?? [];
      makerOpen.push(id);
      openDeals.set(maker, makerOpen);
      const takerOpen = openDeals.get(taker) ?? [];
      takerOpen.push(id);
      openDeals.set(taker, takerOpen);
      const offerKey: OfferKey = {
        token: deal.token,
        maker: deal.maker,
        side: deal.side,
        fiat: deal.fiat,
      };
      const offer = offers.get(makeOfferKey(offerKey));
      if (offer) {
        offer.reserve =
          offer.reserve > deal.amount ? offer.reserve - deal.amount : 0n;
      }
    }
  }

  return {
    offers,
    offerIndex,
    deals,
    openDeals,
    recentDeals,
    makerInfo,
    affiliates,
    nicknames,
    nextDealId: maxId + 1n,
    txCounter: 1n,
  };
};

const removeId = (list: bigint[] | undefined, id: bigint) => {
  if (!list) return;
  const idx = list.findIndex((item) => item === id);
  if (idx !== -1) {
    list.splice(idx, 1);
  }
};

const addIdUnique = (list: bigint[] | undefined, id: bigint): bigint[] => {
  const target = list ?? [];
  if (!target.includes(id)) {
    target.push(id);
  }
  return target;
};

const addMakerIndex = (
  index: Map<string, Address[]>,
  key: OfferKey,
) => {
  const indexKey = makeIndexKey(key);
  const list = index.get(indexKey) ?? [];
  if (!list.includes(key.maker)) {
    list.push(key.maker);
  }
  index.set(indexKey, list);
};

const removeMakerIndex = (
  index: Map<string, Address[]>,
  key: OfferKey,
) => {
  const indexKey = makeIndexKey(key);
  const list = index.get(indexKey);
  if (!list) return;
  const idx = list.findIndex((maker) => maker === key.maker);
  if (idx !== -1) {
    list.splice(idx, 1);
  }
  if (list.length === 0) {
    index.delete(indexKey);
  } else {
    index.set(indexKey, list);
  }
};

export class Swap2pMockAdapter implements Swap2pAdapter {
  readonly mode = "mock" as const;
  readonly address = null;
  private readonly state: MockState;
  private readonly nextHash: () => Hash;

  constructor() {
    this.state = buildInitialState();
    this.nextHash = createHashGenerator();
  }

  private ensureMakerInfo(
    address: Address,
    initializeLastActivity = true,
  ): MakerProfile {
    const normalized = getAddress(address);
    const existing = this.state.makerInfo.get(normalized);
    if (existing) {
      return existing;
    }
    const profile = makeEmptyProfile();
    profile.lastActivity = initializeLastActivity ? now() : 0;
    this.state.makerInfo.set(normalized, profile);
    return profile;
  }

  private touchActivity(address: Address) {
    const profile = this.ensureMakerInfo(address);
    profile.lastActivity = now();
  }

  private encodePayload(message: string): string {
    if (!message) return "0x";
    if (isHex(message, { strict: false })) {
      return message;
    }
    return stringToHex(message);
  }

  private appendChat(
    deal: MockDealRecord,
    sender: Address,
    message: string | undefined,
    context: SwapDealState = SwapDealState.NONE,
  ) {
    if (!message || message.length === 0) return;
    const normalized = getAddress(sender);
    deal.chat.push({
      timestamp: now(),
      toMaker: normalized === deal.taker,
      state: context,
      payload: this.encodePayload(message),
    });
  }

  private getOfferRecord(key: OfferKey): Offer | null {
    const record = this.state.offers.get(makeOfferKey(key));
    return record ? cloneOffer(record) : null;
  }

  private getDealRecord(id: bigint): MockDealRecord | null {
    const record = this.state.deals.get(id);
    return record ?? null;
  }

  async getOfferCount(filter: OfferFilter) {
    const list = this.state.offerIndex.get(makeIndexKey(filter));
    return list ? list.length : 0;
  }

  async getOfferKeys(filter: OfferFilter & { offset?: number; limit?: number }) {
    const list = this.state.offerIndex.get(makeIndexKey(filter)) ?? [];
    const makers = paginate(list, filter.offset, filter.limit ?? 20);
    return makers.map<OfferKey>((maker) => ({
      token: filter.token,
      side: filter.side,
      fiat: filter.fiat,
      maker,
    }));
  }

  async getOffer(key: OfferKey) {
    return this.getOfferRecord(key);
  }

  async getOffers(filter: OfferFilter & { offset?: number; limit?: number }) {
    const keys = await this.getOfferKeys(filter);
    return keys
      .map((key) => {
        const offer = this.getOfferRecord(key);
        if (!offer) return null;
        return { key, offer } satisfies OfferWithKey;
      })
      .filter((item): item is OfferWithKey => item !== null);
  }

  async getDeal(id: bigint) {
    const record = this.getDealRecord(id);
    return record ? cloneDeal(record) : null;
  }

  async getOpenDeals(query: DealsQuery) {
    const list = this.state.openDeals.get(getAddress(query.user)) ?? [];
    const ids = paginate(list, query.offset, query.limit ?? 20);
    return ids
      .map((id) => this.getDealRecord(id))
      .filter((record): record is MockDealRecord => record !== null)
      .map(cloneDeal);
  }

  async getRecentDeals(query: DealsQuery) {
    const list = this.state.recentDeals.get(getAddress(query.user)) ?? [];
    const ids = paginate(list, query.offset, query.limit ?? 20);
    return ids
      .map((id) => this.getDealRecord(id))
      .filter((record): record is MockDealRecord => record !== null)
      .map(cloneDeal);
  }

  async getMakerProfile(address: Address) {
    const profile = this.state.makerInfo.get(getAddress(address));
    return profile ? { ...profile } : null;
  }

  async getMakerProfiles(addresses: Address[]) {
    return addresses.map((addr) => {
      const profile = this.state.makerInfo.get(getAddress(addr));
      return profile ? { ...profile } : makeEmptyProfile();
    });
  }

  async setOnline({ account, online }: SetOnlineArgs) {
    const normalized = getAddress(account);
    const profile = this.ensureMakerInfo(normalized, false);
    profile.online = online;
    this.touchActivity(normalized);
    return this.nextHash();
  }

  async setNickname({ account, nickname }: SetNicknameArgs) {
    const normalized = getAddress(account);
    const desired = nickname.trim();
    const profile = this.ensureMakerInfo(normalized);
    const current = profile.nickname;
    const currentKey = current.trim().toLowerCase();
    if (desired.length === 0) {
      if (currentKey.length !== 0) {
        this.state.nicknames.delete(currentKey);
        profile.nickname = "";
      }
      this.touchActivity(normalized);
      return this.nextHash();
    }
    const desiredKey = desired.toLowerCase();
    if (currentKey === desiredKey) {
      this.touchActivity(normalized);
      return this.nextHash();
    }
    const owner = this.state.nicknames.get(desiredKey);
    if (owner && owner !== normalized) {
      throw new MockSwap2pError("NicknameTaken");
    }
    if (currentKey.length !== 0) {
      this.state.nicknames.delete(currentKey);
    }
    this.state.nicknames.set(desiredKey, normalized);
    profile.nickname = desired;
    this.touchActivity(normalized);
    return this.nextHash();
  }

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
    const maker = getAddress(account);
    const key: OfferKey = { token, maker, side, fiat };
    const updated: Offer = {
      minAmount,
      maxAmount,
      reserve,
      priceFiatPerToken: price,
      fiat,
      side,
      token,
      paymentMethods,
      requirements: requirements ?? "",
      updatedAt: now(),
      maker,
    };
    this.state.offers.set(makeOfferKey(key), updated);
    addMakerIndex(this.state.offerIndex, key);
    this.touchActivity(maker);
    void comment;
    return this.nextHash();
  }

  async makerDeleteOffer(args: MakerDeleteOfferArgs) {
    const key: OfferKey = {
      token: getAddress(args.token),
      maker: getAddress(args.account),
      side: args.side,
      fiat: args.fiat,
    };
    this.state.offers.delete(makeOfferKey(key));
    removeMakerIndex(this.state.offerIndex, key);
    this.touchActivity(key.maker);
    return this.nextHash();
  }

  async takerRequestOffer(args: TakerRequestOfferArgs) {
    const account = getAddress(args.account);
    const maker = getAddress(args.maker);
    const offerKey: OfferKey = {
      token: getAddress(args.token),
      maker,
      side: args.side,
      fiat: args.fiat,
    };
    const offerRecord = this.state.offers.get(makeOfferKey(offerKey));
    if (!offerRecord) {
      throw new MockSwap2pError("OfferNotFound");
    }
    const makerProfile = this.state.makerInfo.get(maker);
    if (!makerProfile?.online) {
      throw new MockSwap2pError("MakerOffline");
    }
    const expected = BigInt(args.expectedPrice);
    const currentPrice = BigInt(offerRecord.priceFiatPerToken);
    if (
      (offerKey.side === SwapSide.BUY && currentPrice < expected) ||
      (offerKey.side === SwapSide.SELL && currentPrice > expected)
    ) {
      throw new MockSwap2pError("WorsePrice");
    }
    const amount = BigInt(args.amount);
    if (
      amount < BigInt(offerRecord.minAmount) ||
      amount > BigInt(offerRecord.maxAmount)
    ) {
      throw new MockSwap2pError("AmountOutOfBounds");
    }
    if (offerRecord.reserve < amount) {
      throw new MockSwap2pError("InsufficientReserve");
    }
    offerRecord.reserve -= amount;
    offerRecord.updatedAt = now();
    this.state.offers.set(makeOfferKey(offerKey), offerRecord);
    const id = this.state.nextDealId++;
    const timestamp = now();
    const deal: MockDealRecord = {
      id,
      amount,
      price: BigInt(offerRecord.priceFiatPerToken),
      state: SwapDealState.REQUESTED,
      side: offerKey.side,
      maker,
      taker: account,
      fiat: offerKey.fiat,
      requestedAt: timestamp,
      updatedAt: timestamp,
      token: offerKey.token,
      paymentMethod: args.paymentMethod ?? "",
      chat: [],
    };
    this.state.deals.set(id, deal);
    this.state.openDeals.set(
      maker,
      addIdUnique(this.state.openDeals.get(maker), id),
    );
    this.state.openDeals.set(
      account,
      addIdUnique(this.state.openDeals.get(account), id),
    );
    if (!this.state.affiliates.has(account) && args.partner) {
      const partner = getAddress(args.partner);
      if (partner !== ADDRESS_ZERO && partner !== account) {
        this.state.affiliates.set(account, partner);
      }
    }
    this.touchActivity(account);
    void args.details;
    return this.nextHash();
  }

  async makerAcceptRequest(args: MakerAcceptRequestArgs) {
    const account = getAddress(args.account);
    const deal = this.getDealRecord(args.id);
    if (!deal) {
      throw new MockSwap2pError("OfferNotFound");
    }
    if (deal.state !== SwapDealState.REQUESTED) {
      throw new MockSwap2pError("WrongState");
    }
    if (deal.maker !== account) {
      throw new MockSwap2pError("WrongCaller");
    }
    deal.state = SwapDealState.ACCEPTED;
    deal.updatedAt = now();
    this.appendChat(deal, account, args.message, SwapDealState.ACCEPTED);
    this.touchActivity(account);
    return this.nextHash();
  }

  async cancelRequest(args: CancelRequestArgs) {
    const account = getAddress(args.account);
    const deal = this.getDealRecord(args.id);
    if (!deal) {
      throw new MockSwap2pError("OfferNotFound");
    }
    if (deal.state !== SwapDealState.REQUESTED) {
      throw new MockSwap2pError("WrongState");
    }
    if (account !== deal.maker && account !== deal.taker) {
      throw new MockSwap2pError("WrongCaller");
    }
    this.appendChat(deal, account, args.reason, SwapDealState.CANCELED);
    this.appendChat(deal, account, args.reason, SwapDealState.CANCELED);
    deal.state = SwapDealState.CANCELED;
    deal.updatedAt = now();
    removeId(this.state.openDeals.get(deal.maker), deal.id);
    removeId(this.state.openDeals.get(deal.taker), deal.id);
    const makerRecent = this.state.recentDeals.get(deal.maker) ?? [];
    makerRecent.push(deal.id);
    this.state.recentDeals.set(deal.maker, makerRecent);
    const takerRecent = this.state.recentDeals.get(deal.taker) ?? [];
    takerRecent.push(deal.id);
    this.state.recentDeals.set(deal.taker, takerRecent);
    const offerKey: OfferKey = {
      token: deal.token,
      maker: deal.maker,
      side: deal.side,
      fiat: deal.fiat,
    };
    const offerRecord = this.state.offers.get(makeOfferKey(offerKey));
    if (offerRecord) {
      offerRecord.reserve += deal.amount;
      this.state.offers.set(makeOfferKey(offerKey), offerRecord);
    }
    const cancellerProfile = this.ensureMakerInfo(account, false);
    cancellerProfile.dealsCancelled += 1;
    this.touchActivity(account);
    return this.nextHash();
  }

  async cancelDeal(args: CancelDealArgs) {
    const account = getAddress(args.account);
    const deal = this.getDealRecord(args.id);
    if (!deal) {
      throw new MockSwap2pError("OfferNotFound");
    }
    if (deal.state !== SwapDealState.ACCEPTED) {
      throw new MockSwap2pError("WrongState");
    }
    if (account === deal.maker) {
      if (deal.side !== SwapSide.BUY) {
        throw new MockSwap2pError("WrongSide");
      }
    } else if (account === deal.taker) {
      if (deal.side !== SwapSide.SELL) {
        throw new MockSwap2pError("WrongSide");
      }
    } else {
      throw new MockSwap2pError("WrongCaller");
    }
    deal.state = SwapDealState.CANCELED;
    deal.updatedAt = now();
    removeId(this.state.openDeals.get(deal.maker), deal.id);
    removeId(this.state.openDeals.get(deal.taker), deal.id);
    this.state.recentDeals.set(
      deal.maker,
      addIdUnique(this.state.recentDeals.get(deal.maker), deal.id),
    );
    this.state.recentDeals.set(
      deal.taker,
      addIdUnique(this.state.recentDeals.get(deal.taker), deal.id),
    );
    const offerKey: OfferKey = {
      token: deal.token,
      maker: deal.maker,
      side: deal.side,
      fiat: deal.fiat,
    };
    const offerRecord = this.state.offers.get(makeOfferKey(offerKey));
    if (offerRecord) {
      offerRecord.reserve += deal.amount;
      this.state.offers.set(makeOfferKey(offerKey), offerRecord);
    }
    const cancellerProfile = this.ensureMakerInfo(account, false);
    cancellerProfile.dealsCancelled += 1;
    this.touchActivity(account);
    return this.nextHash();
  }

  async markFiatPaid(args: MarkFiatPaidArgs) {
    const account = getAddress(args.account);
    const deal = this.getDealRecord(args.id);
    if (!deal) {
      throw new MockSwap2pError("OfferNotFound");
    }
    if (deal.state !== SwapDealState.ACCEPTED) {
      throw new MockSwap2pError("WrongState");
    }
    if (
      (deal.side === SwapSide.BUY && deal.maker !== account) ||
      (deal.side === SwapSide.SELL && deal.taker !== account)
    ) {
      throw new MockSwap2pError("NotFiatPayer");
    }
    deal.state = SwapDealState.PAID;
    deal.updatedAt = now();
    this.appendChat(deal, account, args.message, SwapDealState.PAID);
    this.touchActivity(account);
    return this.nextHash();
  }

  async release(args: ReleaseDealArgs) {
    const account = getAddress(args.account);
    const deal = this.getDealRecord(args.id);
    if (!deal) {
      throw new MockSwap2pError("OfferNotFound");
    }
    if (deal.state !== SwapDealState.PAID) {
      throw new MockSwap2pError("WrongState");
    }
    if (
      (deal.side === SwapSide.BUY && account !== deal.taker) ||
      (deal.side === SwapSide.SELL && account !== deal.maker)
    ) {
      throw new MockSwap2pError("WrongCaller");
    }
    this.appendChat(deal, account, args.message, SwapDealState.RELEASED);
    deal.state = SwapDealState.RELEASED;
    deal.updatedAt = now();
    removeId(this.state.openDeals.get(deal.maker), deal.id);
    removeId(this.state.openDeals.get(deal.taker), deal.id);
    this.state.recentDeals.set(
      deal.maker,
      addIdUnique(this.state.recentDeals.get(deal.maker), deal.id),
    );
    this.state.recentDeals.set(
      deal.taker,
      addIdUnique(this.state.recentDeals.get(deal.taker), deal.id),
    );
    const makerProfile = this.ensureMakerInfo(deal.maker, false);
    const takerProfile = this.ensureMakerInfo(deal.taker, false);
    makerProfile.dealsCompleted += 1;
    takerProfile.dealsCompleted += 1;
    this.touchActivity(account);
    return this.nextHash();
  }

  async sendMessage(args: SendMessageArgs) {
    const account = getAddress(args.account);
    const deal = this.getDealRecord(args.id);
    if (!deal) {
      throw new MockSwap2pError("OfferNotFound");
    }
    if (account !== deal.maker && account !== deal.taker) {
      throw new MockSwap2pError("WrongCaller");
    }
    if (
      deal.state !== SwapDealState.REQUESTED &&
      deal.state !== SwapDealState.ACCEPTED &&
      deal.state !== SwapDealState.PAID
    ) {
      throw new MockSwap2pError("WrongState");
    }
    this.appendChat(deal, account, args.message, SwapDealState.NONE);
    this.touchActivity(account);
    return this.nextHash();
  }

  async cleanupDeals(args: CleanupDealsArgs) {
    if (args.minAgeHours < MIN_CLEANUP_AGE_HOURS) {
      throw new MockSwap2pError("WrongState");
    }
    const threshold = BigInt(args.minAgeHours) * BigInt(HOURS);
    const current = BigInt(now());
    for (const idBig of args.ids) {
      const id = BigInt(idBig);
      const deal = this.getDealRecord(id);
      if (!deal) continue;
      if (
        deal.state !== SwapDealState.RELEASED &&
        deal.state !== SwapDealState.CANCELED
      ) {
        continue;
      }
      const age = current - BigInt(deal.updatedAt);
      if (age < threshold) {
        continue;
      }
      this.state.deals.delete(id);
      removeId(this.state.recentDeals.get(deal.maker), id);
      removeId(this.state.recentDeals.get(deal.taker), id);
    }
    this.touchActivity(getAddress(args.account));
    return this.nextHash();
  }
}

export const createSwap2pMockAdapter = () => new Swap2pMockAdapter();
