import { warn as logWarn } from "@/lib/logger";
import { sanitizeCountryCode, sanitizePaymentMethod, sanitizeTokenSymbol } from "@/lib/validation";

export const OFFERS_FILTER_STORAGE_KEY = "swap2p:offers-filters";
export const ANY_FILTER_OPTION = "any";

export type StoredFilters = {
  side?: "BUY" | "SELL";
  token?: string;
  fiat?: string;
  paymentMethod?: string;
};

const isAnyOption = (value: string | undefined) => value === ANY_FILTER_OPTION;

const sanitizeTokenFilter = (value?: string) => {
  if (typeof value !== "string" || !value.trim()) return undefined;
  if (isAnyOption(value)) return ANY_FILTER_OPTION;
  const sanitized = sanitizeTokenSymbol(value);
  return sanitized || undefined;
};

const sanitizeFiatFilter = (value?: string) => {
  if (typeof value !== "string" || !value.trim()) return undefined;
  if (isAnyOption(value)) return ANY_FILTER_OPTION;
  const sanitized = sanitizeCountryCode(value);
  return sanitized || undefined;
};

const sanitizePaymentMethodFilter = (value?: string) => {
  if (typeof value !== "string" || !value.trim()) return undefined;
  if (isAnyOption(value)) return ANY_FILTER_OPTION;
  const sanitized = sanitizePaymentMethod(value);
  return sanitized || undefined;
};

const sanitizeFilters = (filters: StoredFilters): StoredFilters => {
  const result: StoredFilters = {};
  if (filters.side === "BUY" || filters.side === "SELL") {
    result.side = filters.side;
  }
  const token = sanitizeTokenFilter(filters.token);
  if (token) {
    result.token = token;
  }
  const fiat = sanitizeFiatFilter(filters.fiat);
  if (fiat) {
    result.fiat = fiat;
  }
  const paymentMethod = sanitizePaymentMethodFilter(filters.paymentMethod);
  if (paymentMethod) {
    result.paymentMethod = paymentMethod;
  }
  return result;
};

export function readStoredFilters(): StoredFilters | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(OFFERS_FILTER_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as StoredFilters;
    if (typeof parsed !== "object" || parsed === null) {
      return null;
    }
    const sanitized = sanitizeFilters(parsed);
    return Object.keys(sanitized).length > 0 ? sanitized : null;
  } catch (error) {
    logWarn("offers-filter-storage", "failed to read filters from storage", error);
    return null;
  }
}

export function writeStoredFilters(filters: StoredFilters): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const sanitized = sanitizeFilters(filters);
    if (Object.keys(sanitized).length === 0) {
      window.localStorage.removeItem(OFFERS_FILTER_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(OFFERS_FILTER_STORAGE_KEY, JSON.stringify(sanitized));
  } catch (error) {
    logWarn("offers-filter-storage", "failed to persist filters", error);
  }
}
