"use client";

import { getAddress, isAddress, type Address } from "viem";

import { DEFAULT_PARTNER_ADDRESS } from "@/config";
import { warn as logWarn } from "@/lib/logger";

export const PARTNER_STORAGE_KEY = "partner";

export function normalizePartnerAddress(value?: string | null): Address | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    if (!isAddress(trimmed)) return null;
    return getAddress(trimmed);
  } catch {
    return null;
  }
}

export function writePartnerToStorage(value: string): Address | null {
  if (typeof window === "undefined") return null;
  const normalized = normalizePartnerAddress(value);
  try {
    if (normalized) {
      window.localStorage.setItem(PARTNER_STORAGE_KEY, normalized);
      return normalized;
    }
    window.localStorage.removeItem(PARTNER_STORAGE_KEY);
  } catch (error) {
    logWarn("partner", "failed to persist referral", error);
  }
  return null;
}

export function readPartnerFromStorage(): Address | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(PARTNER_STORAGE_KEY);
    return normalizePartnerAddress(stored);
  } catch (error) {
    logWarn("partner", "failed to read referral from storage", error);
    return null;
  }
}

export function resolvePartnerAddress(): Address {
  return readPartnerFromStorage() ?? DEFAULT_PARTNER_ADDRESS;
}
