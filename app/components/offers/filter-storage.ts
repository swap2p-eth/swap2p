export const OFFERS_FILTER_STORAGE_KEY = "swap2p:offers-filters";
export const ANY_FILTER_OPTION = "any";

export type StoredFilters = {
  side?: "BUY" | "SELL";
  token?: string;
  fiat?: string;
  paymentMethod?: string;
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
    return parsed;
  } catch (error) {
    console.warn("Failed to read offer filters from storage", error);
    return null;
  }
}
