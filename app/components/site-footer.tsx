"use client";

import * as React from "react";
import Link from "next/link";

const CURRENT_YEAR = new Date().getUTCFullYear();

export function SiteFooter() {
  const handleNavigate = (target: string) => (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    const normalized = target.replace(/^#/, "");
    if (typeof window === "undefined") return;
    if (window.location.hash === `#${normalized}`) {
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    } else {
      window.location.hash = normalized;
    }
  };

  return (
    <footer className="border-t border-border/60 bg-background/70">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <span>&copy; {CURRENT_YEAR} Swap2p. All rights reserved.</span>
        <div className="flex items-center gap-4">
          <Link
            href="/#terms"
            className="font-medium text-muted-foreground transition hover:text-foreground hover:underline"
            prefetch={false}
            onClick={handleNavigate("terms")}
          >
            Terms
          </Link>
          <Link
            href="/#policy"
            className="font-medium text-muted-foreground transition hover:text-foreground hover:underline"
            prefetch={false}
            onClick={handleNavigate("policy")}
          >
            Privacy Policy
          </Link>
        </div>
      </div>
    </footer>
  );
}
