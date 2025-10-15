"use client";

import * as React from "react";

function normalizeHash(value: string) {
  return value.replace(/^#/, "");
}

function readHash(fallback: string) {
  if (typeof window === "undefined") {
    return fallback;
  }
  const raw = normalizeHash(window.location.hash);
  return raw || fallback;
}

export function useHashLocation(defaultHash = "offers") {
  const [hash, setHashValue] = React.useState(defaultHash);

  React.useEffect(() => {
    const handleHashChange = () => {
      setHashValue(readHash(defaultHash));
    };
    if (typeof window !== "undefined") {
      window.addEventListener("hashchange", handleHashChange);
      // Ensure initial sync if hash existed before hydration.
      handleHashChange();
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("hashchange", handleHashChange);
      }
    };
  }, [defaultHash]);

  const setHash = React.useCallback(
    (next: string) => {
      const normalized = normalizeHash(next) || defaultHash;
      setHashValue(normalized);
      if (typeof window !== "undefined") {
        if (window.location.hash === `#${normalized}`) {
          // Force a hashchange-style update if value is the same.
          window.dispatchEvent(new HashChangeEvent("hashchange"));
        } else {
          window.location.hash = normalized;
        }
      }
    },
    [defaultHash]
  );

  return {
    hash,
    setHash
  };
}
