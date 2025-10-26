import hardhatDeployment from "@/networks/hardhat.json";
import { hardhatChain } from "@/lib/chains";
import currencyData from "currency-codes/data";
import countriesData from "flag-icons/country.json";

export type NetworkKey = "hardhat" | "ethereum" | "optimism";

export interface TokenConfig {
  symbol: string;
  address: `0x${string}`;
  decimals: number;
}

export interface FiatInfo {
  countryCode: string;
  countryName: string;
  currencyCode: string;
  currencyName: string;
  digits: number;
  shortLabel: string;
  longLabel: string;
  isUniqueCurrency: boolean;
}

export interface NetworkConfig {
  chainId: number;
  name: string;
  swap2pAddress: `0x${string}`;
  tokens: TokenConfig[];
  paymentMethods: Record<string, string[]>;
}

export interface AppConfigShape {
  defaultNetwork: NetworkKey;
  networks: Record<NetworkKey, NetworkConfig>;
}

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

const asAddress = (value?: string): `0x${string}` => {
  if (typeof value === "string" && value.startsWith("0x")) {
    return value as `0x${string}`;
  }
  return ZERO_ADDRESS;
};

const normalizeName = (name: string): string =>
  name
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2019\u2018]/g, "'")
    .replace(/[()]/g, " ")
    .replace(/[,']/g, "")
    .replace(/\s+/g, " ")
    .trim();

const COUNTRY_OVERRIDES: Record<string, string> = {
  "UNITED ARAB EMIRATES THE": "AE",
  "SINT MAARTEN DUTCH PART": "SX",
  "COCOS KEELING ISLANDS THE": "CC",
  "BOLIVIA PLURINATIONAL STATE OF": "BO",
  "BAHAMAS THE": "BS",
  "CONGO THE DEMOCRATIC REPUBLIC OF THE": "CD",
  "CZECHIA": "CZ",
  "FAROE ISLANDS THE": "FO",
  "DOMINICAN REPUBLIC THE": "DO",
  "EUROPEAN UNION": "EU",
  "FRENCH SOUTHERN TERRITORIES THE": "TF",
  "HOLY SEE THE": "VA",
  "NETHERLANDS THE": "NL",
  "SAINT MARTIN FRENCH PART": "MF",
  "FALKLAND ISLANDS THE [MALVINAS]": "FK",
  "UNITED KINGDOM OF GREAT BRITAIN AND NORTHERN IRELAND THE": "GB",
  "GAMBIA THE": "GM",
  "IRAN ISLAMIC REPUBLIC OF": "IR",
  "COMOROS THE": "KM",
  "KOREA THE DEMOCRATIC PEOPLES REPUBLIC OF": "KP",
  "KOREA THE REPUBLIC OF": "KR",
  "CAYMAN ISLANDS THE": "KY",
  "LAO PEOPLES DEMOCRATIC REPUBLIC THE": "LA",
  "MOLDOVA THE REPUBLIC OF": "MD",
  "MACAO": "MO",
  "COOK ISLANDS THE": "CK",
  "PHILIPPINES THE": "PH",
  "RUSSIAN FEDERATION THE": "RU",
  "SUDAN THE": "SD",
  "SYRIAN ARAB REPUBLIC": "SY",
  "TAIWAN PROVINCE OF CHINA": "TW",
  "TANZANIA UNITED REPUBLIC OF": "TZ",
  "BRITISH INDIAN OCEAN TERRITORY THE": "IO",
  "MARSHALL ISLANDS THE": "MH",
  "MICRONESIA FEDERATED STATES OF": "FM",
  "NORTHERN MARIANA ISLANDS THE": "MP",
  "TURKS AND CAICOS ISLANDS THE": "TC",
  "UNITED STATES MINOR OUTLYING ISLANDS THE": "UM",
  "UNITED STATES OF AMERICA THE": "US",
  "VENEZUELA BOLIVARIAN REPUBLIC OF": "VE",
  "VIET NAM": "VN",
  "CENTRAL AFRICAN REPUBLIC THE": "CF",
  "CONGO THE": "CG",
  "NIGER THE": "NE",
};

const SKIP_NORMALIZED = new Set<string>([
  'SISTEMA UNITARIO DE COMPENSACION REGIONAL DE PAGOS "SUCRE"',
  "MEMBER COUNTRIES OF THE AFRICAN DEVELOPMENT BANK GROUP",
]);

type CountryEntry = {
  code: string;
  name: string;
};

const COUNTRY_BY_CODE = new Map<string, string>();
const COUNTRY_LOOKUP = new Map<string, CountryEntry>();

for (const entry of countriesData as Array<{ code: string; name: string }>) {
  const code = entry.code.toUpperCase();
  const name = entry.name;
  COUNTRY_BY_CODE.set(code, name);
  const normalized = normalizeName(name);
  if (!COUNTRY_LOOKUP.has(normalized)) {
    COUNTRY_LOOKUP.set(normalized, { code, name });
  }
  const trimmed = normalized.replace(/ THE$/, "");
  if (trimmed && !COUNTRY_LOOKUP.has(trimmed)) {
    COUNTRY_LOOKUP.set(trimmed, { code, name });
  }
}

const rawFiats: Array<{
  countryCode: string;
  countryName: string;
  currencyCode: string;
  currencyName: string;
  digits: number;
}> = [];

const seenCountries = new Set<string>();

for (const entry of currencyData as Array<{ code?: string; currency?: string; digits?: number; countries?: string[] }>) {
  if (!entry?.code || !Array.isArray(entry.countries) || entry.countries.length === 0) {
    continue;
  }
  const currencyCode = entry.code.toUpperCase();
  for (const rawCountry of entry.countries) {
    const normalized = normalizeName(rawCountry);
    if (SKIP_NORMALIZED.has(normalized)) continue;
    const overrideCode = COUNTRY_OVERRIDES[normalized];
    const lookup = overrideCode
      ? { code: overrideCode, name: COUNTRY_BY_CODE.get(overrideCode) ?? rawCountry }
      : COUNTRY_LOOKUP.get(normalized);
    if (!lookup) continue;
    if (seenCountries.has(lookup.code)) continue;
    seenCountries.add(lookup.code);
    rawFiats.push({
      countryCode: lookup.code,
      countryName: lookup.name,
      currencyCode,
      currencyName: entry.currency ?? entry.code,
      digits: typeof entry.digits === "number" ? entry.digits : 2,
    });
  }
}

const currencyUsage = new Map<string, number>();
for (const fiat of rawFiats) {
  currencyUsage.set(fiat.currencyCode, (currencyUsage.get(fiat.currencyCode) ?? 0) + 1);
}

const buildFiatInfo = (fiat: typeof rawFiats[number]): FiatInfo => {
  const usage = currencyUsage.get(fiat.currencyCode) ?? 0;
  const isUnique = usage <= 1;
  const shortLabel = isUnique ? fiat.currencyCode : `${fiat.currencyCode}:${fiat.countryCode}`;
  const longLabel = `${fiat.currencyCode} - ${fiat.countryName}`;
  return {
    ...fiat,
    shortLabel,
    longLabel,
    isUniqueCurrency: isUnique,
  };
};

export const FIAT_INFOS: FiatInfo[] = rawFiats
  .map(buildFiatInfo)
  .sort((a, b) => {
    const currencyCmp = a.currencyCode.localeCompare(b.currencyCode);
    if (currencyCmp !== 0) return currencyCmp;
    return a.countryName.localeCompare(b.countryName);
  });

export const FIAT_BY_COUNTRY = new Map<string, FiatInfo>(FIAT_INFOS.map(info => [info.countryCode, info]));

const HARDHAT_TOKEN_DECIMALS: Record<string, number> = {
  WBTC: 8,
  USDT: 6,
  DAI: 18,
  WETH: 18,
};

export const APP_CONFIG: AppConfigShape = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      chainId: hardhatChain.id,
      name: "Hardhat (local)",
      swap2pAddress:
        typeof hardhatDeployment.swap2p === "string"
          ? asAddress(hardhatDeployment.swap2p)
          : ZERO_ADDRESS,
      tokens: Object.entries(hardhatDeployment.tokens ?? {}).map(
        ([symbol, address]) =>
          ({
            symbol,
            address: asAddress(address),
            decimals: HARDHAT_TOKEN_DECIMALS[symbol] ?? 18,
          }) satisfies TokenConfig,
      ),
      paymentMethods: {
        USD: ["Wire (Fedwire)", "ACH", "Zelle"],
        EUR: ["SEPA", "SEPA Instant", "Revolut Business"],
        BRL: ["PIX", "TED", "Itau Transfer"],
        GBP: ["Faster Payments", "SWIFT GBP", "Revolut"],
      },
    },
    ethereum: {
      chainId: 1,
      name: "Ethereum Mainnet",
      swap2pAddress: "0x111111111111111111111111111111111111aAaA" as `0x${string}`,
      tokens: [
        {
          symbol: "USDC",
          address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as `0x${string}`,
          decimals: 6,
        },
        {
          symbol: "USDT",
          address: "0xdAC17F958D2ee523a2206206994597C13D831ec7" as `0x${string}`,
          decimals: 6,
        },
        {
          symbol: "DAI",
          address: "0x6B175474E89094C44Da98b954EedeAC495271d0F" as `0x${string}`,
          decimals: 18,
        },
        {
          symbol: "WETH",
          address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" as `0x${string}`,
          decimals: 18,
        },
      ] satisfies TokenConfig[],
      paymentMethods: {
        USD: ["Wire", "Silvergate SEN", "Signet"],
        EUR: ["SEPA", "SEPA Instant", "SWIFT EUR"],
        GBP: ["Faster Payments", "SWIFT GBP"],
        JPY: ["Domestic Transfer", "SWIFT JPY"],
      },
    },
    optimism: {
      chainId: 10,
      name: "Optimism",
      swap2pAddress: "0x222222222222222222222222222222222222aAaA" as `0x${string}`,
      tokens: [
        {
          symbol: "USDC.e",
          address: "0x7F5c764cBc14f9669B88837ca1490cCa17c31607" as `0x${string}`,
          decimals: 6,
        },
        {
          symbol: "USDT",
          address: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58" as `0x${string}`,
          decimals: 6,
        },
        {
          symbol: "DAI",
          address: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1" as `0x${string}`,
          decimals: 18,
        },
        {
          symbol: "OP",
          address: "0x4200000000000000000000000000000000000042" as `0x${string}`,
          decimals: 18,
        },
      ] satisfies TokenConfig[],
      paymentMethods: {
        USD: ["ACH", "Wire", "Zelle"],
        MXN: ["SPEI", "Banorte Transfer"],
        CLP: ["WebPay", "BancoEstado"],
      },
    },
  },
};

export function getNetworkConfig(key?: NetworkKey): NetworkConfig {
  const target = key ?? APP_CONFIG.defaultNetwork;
  return APP_CONFIG.networks[target];
}

export function getNetworkConfigForChain(chainId?: number): NetworkConfig {
  if (typeof chainId === "number") {
    const match = Object.values(APP_CONFIG.networks).find(cfg => cfg.chainId === chainId);
    if (match) return match;
  }
  const fallback = getNetworkConfig(APP_CONFIG.defaultNetwork);
  return {
    ...fallback,
    chainId: typeof chainId === "number" ? chainId : fallback.chainId,
    swap2pAddress: ZERO_ADDRESS,
    tokens: [],
    paymentMethods: {},
  };
}
