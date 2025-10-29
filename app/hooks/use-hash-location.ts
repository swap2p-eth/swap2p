"use client";

import * as React from "react";

const DEFAULT_FALLBACK = "offers";

const listeners = new Set<() => void>();
let currentHash = "";

function sanitizeHash(value: string) {
  return value.replace(/[^a-zA-Z0-9/_-]+/g, "").slice(0, 160);
}

function normalizeHash(value: string) {
  const stripped = value.replace(/^#/, "");
  return sanitizeHash(stripped);
}

function readHashFromWindow(fallback: string) {
  if (typeof window === "undefined") {
    return fallback;
  }
  const raw = normalizeHash(window.location.hash);
  return raw || fallback;
}

function ensureCurrentHash(fallback: string) {
  if (!currentHash) {
    currentHash = readHashFromWindow(fallback);
  }
  return currentHash || fallback;
}

function updateCurrentHash(next: string) {
  if (currentHash === next) {
    return;
  }
  currentHash = next;
  listeners.forEach(listener => listener());
}

function subscribeToHash(listener: () => void, fallback: string) {
  listeners.add(listener);
  ensureCurrentHash(fallback);

  if (typeof window !== "undefined") {
    const handleHashChange = () => {
      const next = readHashFromWindow(fallback);
      updateCurrentHash(next);
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("hashchange", handleHashChange);
    };
  }

  return () => {
    listeners.delete(listener);
  };
}

function getCurrentHash(fallback: string) {
  return ensureCurrentHash(fallback);
}

export function setHash(next: string, fallback = DEFAULT_FALLBACK) {
  const normalizedFallback = normalizeHash(fallback) || DEFAULT_FALLBACK;
  const normalized = normalizeHash(next) || normalizedFallback;
  updateCurrentHash(normalized);

  if (typeof window !== "undefined") {
    if (window.location.hash !== `#${normalized}`) {
      window.location.hash = normalized;
    }
  }
}

export function useHashLocation(defaultHash = DEFAULT_FALLBACK) {
  const fallback = React.useMemo(
    () => normalizeHash(defaultHash) || DEFAULT_FALLBACK,
    [defaultHash]
  );

  const subscribe = React.useCallback(
    (listener: () => void) => subscribeToHash(listener, fallback),
    [fallback]
  );
  const getSnapshot = React.useCallback(
    () => getCurrentHash(fallback),
    [fallback]
  );
  const getServerSnapshot = React.useCallback(() => fallback, [fallback]);

  const hash = React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setHashValue = React.useCallback(
    (next: string) => setHash(next, fallback),
    [fallback]
  );

  return {
    hash,
    setHash: setHashValue
  };
}
