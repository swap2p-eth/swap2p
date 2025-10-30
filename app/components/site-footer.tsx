"use client";

import Link from "next/link";

import { setHash } from "@/hooks/use-hash-location";

const CURRENT_YEAR = new Date().getUTCFullYear();

export function SiteFooter() {
  return (
    <footer>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <span>&copy; {CURRENT_YEAR} Swap2p. All rights reserved.</span>
        <div className="flex items-center gap-4">
          <Link
            href="/#terms"
            className="font-medium text-muted-foreground transition hover:text-foreground hover:underline"
            prefetch={false}
            onClick={event => {
              event.preventDefault();
              setHash("terms");
            }}
          >
            Terms
          </Link>
          <Link
            href="/#policy"
            className="font-medium text-muted-foreground transition hover:text-foreground hover:underline"
            prefetch={false}
            onClick={event => {
              event.preventDefault();
              setHash("policy");
            }}
          >
            Privacy Policy
          </Link>
          <Link
            href="https://github.com/swap2p-eth"
            className="font-medium text-muted-foreground transition hover:text-foreground hover:underline"
            target="_blank"
            rel="noreferrer noopener"
            prefetch={false}
          >
            GitHub
          </Link>
        </div>
      </div>
    </footer>
  );
}
