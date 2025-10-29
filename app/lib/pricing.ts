export const PRICE_SCALE = 1_000_000;
export const PRICE_SCALE_BI = BigInt(PRICE_SCALE);

export function scalePrice(value: number): bigint {
  return BigInt(Math.round(value * PRICE_SCALE));
}

export function descaledPrice(value: bigint | number): number {
  if (typeof value === "number") {
    return value / PRICE_SCALE;
  }
  return Number(value) / PRICE_SCALE;
}
