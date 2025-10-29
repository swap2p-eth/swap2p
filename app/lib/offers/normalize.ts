import { formatUnits, getAddress } from "viem";

import type { TokenConfig } from "@/config";
import { decodeCountryCode, encodeCountryCode, getFiatInfoByCountry } from "@/lib/fiat";
import type { Offer } from "@/lib/swap2p/types";
import type { OfferRow } from "@/lib/types/market";
import { descaledPrice } from "@/lib/pricing";

export function mergeOfferWithOnchain(
  base: OfferRow,
  onchain: Offer,
  tokenDecimals: number
): OfferRow {
  const updatedAt =
    onchain.updatedAt && onchain.updatedAt > 0
      ? new Date(onchain.updatedAt * 1000).toISOString()
      : base.updatedAt;

  return {
    ...base,
    price: descaledPrice(onchain.priceFiatPerToken),
    minAmount: Number(formatUnits(onchain.minAmount, tokenDecimals)),
    maxAmount: Number(formatUnits(onchain.maxAmount, tokenDecimals)),
    paymentMethods: onchain.paymentMethods ?? "",
    requirements: onchain.requirements ?? "",
    updatedAt,
    contract: onchain
  };
}

export function deriveFiatMetadataFromCountry(countryCode: string) {
  const normalized = countryCode.toUpperCase();
  const info = getFiatInfoByCountry(normalized);
  const encoded = encodeCountryCode(normalized);
  return {
    countryCode: normalized,
    fiatLabel: info?.shortLabel ?? normalized,
    currencyCode: info?.currencyCode ?? normalized,
    encodedFiat: encoded
  };
}

export function deriveFiatMetadataFromEncoded(encoded: number) {
  const decoded = decodeCountryCode(encoded);
  if (!decoded) {
    return {
      countryCode: "",
      fiatLabel: "",
      currencyCode: "",
      encodedFiat: encoded
    };
  }
  return deriveFiatMetadataFromCountry(decoded);
}

export function resolveTokenMetadata(
  tokenConfigs: TokenConfig[],
  params: { symbol?: string; address?: string }
): { symbol: string; address?: `0x${string}`; decimals: number } {
  const address = params.address?.toLowerCase();
  const symbol = params.symbol;

  let match: TokenConfig | undefined;
  if (address) {
    match = tokenConfigs.find(token => token.address.toLowerCase() === address);
  }
  if (!match && symbol) {
    match = tokenConfigs.find(token => token.symbol === symbol);
  }

  if (match) {
    try {
      return {
        symbol: match.symbol,
        address: getAddress(match.address),
        decimals: match.decimals ?? 18
      };
    } catch {
      // fall through to fallback
    }
  }

  return {
    symbol: symbol ?? "",
    address: undefined,
    decimals: 18
  };
}
