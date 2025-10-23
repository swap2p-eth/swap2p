"use client";

import * as React from "react";

interface UserContextValue {
  address: string;
}

const UserContext = React.createContext<UserContextValue | null>(null);

export function UserProvider({
  children,
  address = ""
}: {
  children: React.ReactNode;
  address?: string;
}) {
  const value = React.useMemo(() => ({ address }), [address]);
  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const ctx = React.useContext(UserContext);
  if (!ctx) {
    throw new Error("useUser must be used within UserProvider");
  }
  return ctx;
}
