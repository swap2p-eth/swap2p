"use client";

import { TokenIcon } from "@/components/token-icon";

interface TokenAmountCellProps {
  token: string;
  amountLabel: string;
  mutedToken?: boolean;
}

export function TokenAmountCell({ token, amountLabel, mutedToken = false }: TokenAmountCellProps) {
  return (
    <span className="flex items-center gap-2 text-sm font-medium text-foreground">
      <TokenIcon symbol={token} size={18} />
      <span className="flex items-center gap-2">
        {amountLabel}
        <span
          className={mutedToken ? "text-xs uppercase text-muted-foreground/80" : "text-xs uppercase"}
        >
          {token}
        </span>
      </span>
    </span>
  );
}
