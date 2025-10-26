import currencyData from "currency-codes/data";
import countriesData from "flag-icons/country.json";

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

type CountryEntry = {
  code: string;
  name: string;
};

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

const buildFiatInfo = (fiat: {
  countryCode: string;
  countryName: string;
  currencyCode: string;
  currencyName: string;
  digits: number;
}, usage: Map<string, number>): FiatInfo => {
  const currencyUsageCount = usage.get(fiat.currencyCode) ?? 0;
  const isUnique = currencyUsageCount <= 1;
  const shortLabel = isUnique ? fiat.currencyCode : `${fiat.currencyCode}:${fiat.countryCode}`;
  const longLabel = `${fiat.currencyCode} - ${fiat.countryName}`;
  return {
    ...fiat,
    shortLabel,
    longLabel,
    isUniqueCurrency: isUnique
  };
};

let cachedFiatData:
  | {
      infos: FiatInfo[];
      byCountry: Map<string, FiatInfo>;
    }
  | null = null;

function computeFiatData() {
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

  const infos = rawFiats
    .map(fiat => buildFiatInfo(fiat, currencyUsage))
    .sort((a, b) => {
      const currencyCmp = a.currencyCode.localeCompare(b.currencyCode);
      if (currencyCmp !== 0) return currencyCmp;
      return a.countryName.localeCompare(b.countryName);
    });

  const byCountry = new Map<string, FiatInfo>(
    infos.map(info => [info.countryCode.toUpperCase(), info])
  );

  return { infos, byCountry };
}

export function getFiatData() {
  if (!cachedFiatData) {
    cachedFiatData = computeFiatData();
  }
  return cachedFiatData;
}
