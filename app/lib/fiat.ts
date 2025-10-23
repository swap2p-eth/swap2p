const ASCII_A = "A".charCodeAt(0);
const ASCII_Z = "Z".charCodeAt(0);
const MAX_FIAT_CODE = 0xffffff;

const normalizeCode = (code: string): string => code.trim().toUpperCase();

export function toFiatCode(code: string): number {
  const value = normalizeCode(code);
  if (value.length !== 3) {
    throw new Error(`Fiat code must contain exactly 3 characters, received "${code}"`);
  }
  const [c0, c1, c2] = value.split("").map(char => char.charCodeAt(0));
  if (
    c0 < ASCII_A ||
    c0 > ASCII_Z ||
    c1 < ASCII_A ||
    c1 > ASCII_Z ||
    c2 < ASCII_A ||
    c2 > ASCII_Z
  ) {
    throw new Error(`Fiat code must be A-Z letters (e.g. USD), received "${code}"`);
  }
  return c0 * 0x10000 + c1 * 0x100 + c2;
}

export function fiatCodeToString(value: number): string {
  if (!Number.isInteger(value) || value < 0 || value > MAX_FIAT_CODE) {
    throw new Error(`Fiat code value must be integer within 0..0xFFFFFF, received ${value}`);
  }
  const c0 = (value >> 16) & 0xff;
  const c1 = (value >> 8) & 0xff;
  const c2 = value & 0xff;
  return String.fromCharCode(c0, c1, c2);
}

export function safeFiatCodeToString(value: number): string {
  try {
    return fiatCodeToString(value);
  } catch {
    return value.toString();
  }
}
