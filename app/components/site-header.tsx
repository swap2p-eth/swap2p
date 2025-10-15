"use client";

import Link from "next/link";

import { ThemeToggle } from "@/components/theme-toggle";
import { useHashLocation } from "@/hooks/use-hash-location";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { hash: "offers", label: "Offers" },
  { hash: "deals", label: "Deals" }
] as const;

function deriveActiveSection(hash: string) {
  if (hash.startsWith("deal/")) {
    return "deals";
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
          href="#offers"
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
        <ThemeToggle />
      </div>
    </header>
  );
}
