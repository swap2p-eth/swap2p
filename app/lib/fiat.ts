import { FIAT_BY_COUNTRY, type FiatInfo } from "@/config";

const ASCII_A = "A".charCodeAt(0);
const ASCII_Z = "Z".charCodeAt(0);
const MAX_COUNTRY_CODE = 0xffff;

const normalizeCountry = (code: string): string => code.trim().toUpperCase();

// All FiatCode values are ISO 3166-1 alpha-2 country codes
export function encodeCountryCode(code: string): number {
  const normalized = normalizeCountry(code);
  if (normalized.length !== 2) {
    throw new Error(`Country code must contain exactly 2 characters, received "${code}"`);
  }
  const c0 = normalized.charCodeAt(0);
  const c1 = normalized.charCodeAt(1);
  if (c0 < ASCII_A || c0 > ASCII_Z || c1 < ASCII_A || c1 > ASCII_Z) {
    throw new Error(`Country code must be A-Z letters (e.g. US), received "${code}"`);
  }
  return (c0 << 8) | c1;
}

export function decodeCountryCode(value: number): string {
  if (!Number.isInteger(value) || value < 0 || value > MAX_COUNTRY_CODE) {
    throw new Error(`Country code value must be integer within 0..0xFFFF, received ${value}`);
  }
  const c0 = (value >> 8) & 0xff;
  const c1 = value & 0xff;
  if (c0 === 0 && c1 === 0) {
    return "";
  }
  return String.fromCharCode(c0, c1);
}

export function safeDecodeCountryCode(value: number): string {
  try {
    return decodeCountryCode(value);
  } catch {
    return value.toString();
  }
}

export function getFiatInfoByCountry(code: string | undefined): FiatInfo | undefined {
  if (!code) return undefined;
  return FIAT_BY_COUNTRY.get(code.toUpperCase());
}
