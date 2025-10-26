import { hexToString, isHex, padHex, stringToHex, type Hex } from "viem";
import { debug } from "@/lib/logger";

export const ZERO = 0n;

export const ZERO_BYTES32 =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as Hex;

export const clampHexToBytes32 = (value: Hex): Hex => {
  if (value.length <= 66) return value;
  return (`0x${value.slice(2, 66)}`) as Hex;
};

export const encodeBytes32 = (value: string | Hex | null | undefined): Hex => {
  if (!value) return ZERO_BYTES32;
  if (typeof value === "string" && isHex(value, { strict: false })) {
    const hexValue = clampHexToBytes32(value as Hex);
    return padHex(hexValue, { size: 32, dir: "right" }) as Hex;
  }
  const encoded = stringToHex(String(value));
  const trimmed = clampHexToBytes32(encoded as Hex);
  return padHex(trimmed, { size: 32, dir: "right" }) as Hex;
};

export const decodeBytes32 = (value: unknown): string => {
  if (typeof value !== "string" || !isHex(value, { strict: false })) {
    return "";
  }
  const hexValue = padHex(clampHexToBytes32(value as Hex), {
    size: 32,
    dir: "right"
  }) as Hex;
  if (hexValue === ZERO_BYTES32) return "";
  const str = hexToString(hexValue);
  return str.replace(/\u0000+$/gu, "");
};

const LOG_MAX_DEPTH = 4;

export const sanitizeForLog = (value: unknown, depth = LOG_MAX_DEPTH): unknown => {
  if (depth <= 0) {
    if (typeof value === "object" && value !== null) {
      return "[Object]";
    }
    return value;
  }
  if (typeof value === "bigint") {
    return `${value}n`;
  }
  if (Array.isArray(value)) {
    return value.map(entry => sanitizeForLog(entry, depth - 1));
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    const plain: Record<string, unknown> = {};
    for (const [key, entry] of entries) {
      if (key === "__proto__") continue;
      plain[key] = sanitizeForLog(entry, depth - 1);
    }
    return plain;
  }
  return value;
};

export const debugLog = (scope: string, payload: unknown) => {
  debug(scope, sanitizeForLog(payload));
};

export const toNumber = (value: bigint | number) =>
  typeof value === "bigint" ? Number(value) : value;

export const toBigInt = (value: bigint | number | string | undefined | null): bigint => {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return ZERO;
    return BigInt(trimmed);
  }
  return ZERO;
};

export const toBytes32 = (value: unknown): Hex | null => {
  if (typeof value === "string") {
    if (value.length === 0) return null;
    if (value.startsWith("0x")) {
      const normalized = value.slice(2).padStart(64, "0");
      return (`0x${normalized}`) as Hex;
    }
    try {
      const fromDecimal = BigInt(value);
      return toBytes32(fromDecimal);
    } catch {
      return null;
    }
  }
  if (typeof value === "bigint") {
    return (`0x${value.toString(16).padStart(64, "0")}`) as Hex;
  }
  if (typeof value === "number") {
    return toBytes32(BigInt(value));
  }
  if (value && typeof value === "object" && "id" in (value as Record<string, unknown>)) {
    return toBytes32((value as { id?: unknown }).id);
  }
  return null;
};

export const requireDealId = (value: unknown, caller: string): Hex => {
  const id = toBytes32(value);
  if (!id) {
    throw new Error(`Swap2pViemAdapter: invalid deal id for ${caller}`);
  }
  return id;
};

export const asHex = (value?: string | Hex | null) => {
  if (!value) return undefined;
  if (isHex(value, { strict: false })) {
    return value as Hex;
  }
  return stringToHex(value);
};
