"use client";

import * as React from "react";

import { normalizePartnerAddress, PARTNER_STORAGE_KEY } from "@/lib/partner";
import { info as logInfo, warn as logWarn } from "@/lib/logger";

export function usePartnerReferralCapture() {
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const rawPartner = url.searchParams.get("p");
    if (!rawPartner) return;

    const normalized = normalizePartnerAddress(rawPartner);
    if (normalized) {
      try {
        window.localStorage.setItem(PARTNER_STORAGE_KEY, normalized);
        logInfo("partner", "stored referral address", normalized);
      } catch (error) {
        logWarn("partner", "failed to store referral address", error);
      }
    } else {
      logInfo("partner", "invalid referral parameter, ignoring", rawPartner);
    }

    url.searchParams.delete("p");
    const nextSearch = url.searchParams.toString();
    const nextUrl = `${url.pathname}${nextSearch ? `?${nextSearch}` : ""}${url.hash}`;
    window.history.replaceState({}, "", nextUrl);
  }, []);
}
