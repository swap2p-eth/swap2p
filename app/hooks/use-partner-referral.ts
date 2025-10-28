"use client";

import * as React from "react";

import { normalizePartnerAddress, PARTNER_STORAGE_KEY } from "@/lib/partner";

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
        console.info("[partner] stored referral address", normalized);
      } catch (error) {
        console.warn("[partner] failed to store referral address", error);
      }
    } else {
      console.info("[partner] invalid referral parameter, ignoring", rawPartner);
    }

    url.searchParams.delete("p");
    const nextSearch = url.searchParams.toString();
    const nextUrl = `${url.pathname}${nextSearch ? `?${nextSearch}` : ""}${url.hash}`;
    window.history.replaceState({}, "", nextUrl);
  }, []);
}
