"use client";

import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";

import { ThemeToggle } from "@/components/theme-toggle";
import { useHashLocation } from "@/hooks/use-hash-location";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { hash: "offers", label: "Offers" },
  { hash: "dashboard", label: "Dashboard" }
] as const;

function deriveActiveSection(hash: string) {
  if (hash.startsWith("deal/") || hash === "dashboard" || hash === "new-offer" || hash === "deals") {
    return "dashboard";
  }
  return hash || "offers";
}

export function SiteHeader() {
  const { hash, setHash } = useHashLocation("offers");
  const active = deriveActiveSection(hash);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/70 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-8">
        <Link
          href="/#offers"
          onClick={event => {
            event.preventDefault();
            setHash("offers");
          }}
          className="text-sm font-semibold uppercase tracking-[0.24em] text-muted-foreground"
        >
          Swap2p
        </Link>
        <nav className="flex items-center gap-1 rounded-full bg-card/70 p-1 shadow-[0_12px_32px_-24px_rgba(15,23,42,0.55)]">
          {NAV_ITEMS.map(item => {
            const isActive = active === item.hash;
            return (
              <a
                key={item.hash}
                href={`#${item.hash}`}
                onClick={event => {
                  event.preventDefault();
                  setHash(item.hash);
                }}
                className={cn(
                  "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                  isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/50"
                )}
              >
                {item.label}
              </a>
            );
          })}
        </nav>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <ConnectWalletPill />
        </div>
      </div>
    </header>
  );
}

function ConnectWalletPill() {
  return (
    <ConnectButton.Custom>
      {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted: buttonMounted }) => {
        if (!buttonMounted) {
          return <div className="h-9 w-36 animate-pulse rounded-full bg-muted/60" />;
        }

        const connected = buttonMounted && account && chain;

        if (!connected) {
          return (
            <button
              type="button"
              onClick={openConnectModal}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[0_10px_24px_-18px_rgba(37,99,235,0.9)] transition hover:brightness-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              Connect Wallet
            </button>
          );
        }

        return (
          <div className="flex items-center gap-2 rounded-full border border-border/60 bg-card/80 px-3 py-1.5 text-sm text-foreground shadow-[0_12px_32px_-28px_rgba(15,23,42,0.7)]">
            <button
              type="button"
              onClick={openChainModal}
              className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium uppercase text-primary transition hover:bg-primary/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              {chain.hasIcon && chain.iconUrl ? (
                <span
                  className="h-3.5 w-3.5 rounded-full bg-white/80"
                  style={{ backgroundImage: `url(${chain.iconUrl})`, backgroundSize: "cover" }}
                />
              ) : null}
              {chain.name}
            </button>
            <button
              type="button"
              onClick={openAccountModal}
              className="inline-flex items-center gap-2 rounded-full bg-muted/60 px-3 py-1 text-xs font-semibold text-muted-foreground transition hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              {account.displayName}
            </button>
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
