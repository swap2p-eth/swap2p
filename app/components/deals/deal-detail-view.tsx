"use client";

import * as React from "react";
import { useChainId, usePublicClient, useWalletClient } from "wagmi";
import { erc20Abi, getAddress, maxUint256, parseUnits, type Address } from "viem";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DealChatCard, DealHeader, DealStatusPanel, DealSummaryCard, ParticipantPill } from "@/components/deals";
import { useDeals } from "./deals-provider";
import { RelativeTime } from "@/components/relative-time";
import { buildDealMetaItems } from "@/hooks/use-deal-meta";
import { PriceMetaValue } from "@/components/deals/price-meta-value";
import { useDealPerspective } from "@/hooks/use-deal-perspective";
import { useUser } from "@/context/user-context";
import { formatFiatAmount, formatPrice, formatTokenAmount } from "@/lib/number-format";
import { getDealSideCopy } from "@/lib/deal-copy";
import type { ApprovalMode } from "./token-approval-button";
import { useNetworkConfig } from "@/hooks/use-network-config";
import { isUserRejectedError } from "@/lib/errors";
import { error as logError, warn as logWarn } from "@/lib/logger";

export interface DealDetailViewProps {
  dealId: string;
  onBack?: () => void;
}

export function DealDetailView({ dealId, onBack }: DealDetailViewProps) {
  const {
    deals,
    isLoading,
    acceptDeal,
    cancelDeal,
    markDealPaid,
    releaseDeal,
    sendMessage
  } = useDeals();
  const chainId = useChainId();
  const publicClient = usePublicClient({ chainId });
  const { data: walletClient } = useWalletClient({ chainId });
  const { network } = useNetworkConfig(chainId);
  const ownerAddress = React.useMemo(() => {
    const account = walletClient?.account;
    if (!account) return null;
    if (typeof account === "string") {
      try {
        return getAddress(account);
      } catch {
        return null;
      }
    }
    if (typeof account === "object" && "address" in account && account.address) {
      try {
        return getAddress(account.address as string);
      } catch {
        return null;
      }
    }
    return null;
  }, [walletClient]);
  const deal = deals.find(item => item.id === dealId);
  const { address } = useUser();
  const perspective = useDealPerspective(deal ?? null, address);
  const [actionBusy, setActionBusy] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [approvalBusy, setApprovalBusy] = React.useState(false);
  const [allowanceLoading, setAllowanceLoading] = React.useState(false);
  const [allowanceNonce, setAllowanceNonce] = React.useState(0);
  const [tokenAllowance, setTokenAllowance] = React.useState<bigint | null>(null);
  const role = perspective.role ?? "MAKER";
  const tokenDecimals = deal?.tokenDecimals ?? 18;
  const displayTokenDecimals = Math.min(tokenDecimals, 8);
  const needsAllowanceCheck = Boolean(deal && role === "MAKER" && deal.state === "REQUESTED" && deal.contract?.token);
  const baseTokenUnits = React.useMemo(() => {
    if (!needsAllowanceCheck || !deal) return null;
    try {
      const amountString = deal.amount.toLocaleString("en-US", {
        useGrouping: false,
        maximumFractionDigits: Math.min(tokenDecimals, 18)
      });
      return parseUnits(amountString, tokenDecimals);
    } catch {
      return null;
    }
  }, [needsAllowanceCheck, deal, tokenDecimals]);
  const makerDepositMultiplier = deal?.side === "BUY" ? 1n : 2n;
  const requiredAllowance = needsAllowanceCheck && baseTokenUnits !== null ? baseTokenUnits * makerDepositMultiplier : null;
  const contractToken = deal?.contract?.token;

  const withAction = React.useCallback(async (task: () => Promise<void>) => {
    setActionBusy(true);
    setActionError(null);
    try {
      await task();
    } catch (error) {
      const log = isUserRejectedError(error) ? logWarn : logError;
      log("deal-detail", "action failed", error);
      const fullMessage =
        error instanceof Error ? error.message : typeof error === "string" ? error : "Operation failed.";
      const shortMessage = fullMessage.split(".")[0] ?? "Operation failed";
      setActionError(shortMessage.trim());
    } finally {
      setActionBusy(false);
    }
  }, []);

  React.useEffect(() => {
    if (!needsAllowanceCheck) {
      setTokenAllowance(null);
      setAllowanceLoading(false);
      return;
    }
    if (!contractToken || !ownerAddress || !publicClient) {
      setTokenAllowance(null);
      setAllowanceLoading(false);
      return;
    }
    let cancelled = false;
    const loadAllowance = async () => {
      setAllowanceLoading(true);
      try {
        const value = await publicClient.readContract({
          abi: erc20Abi,
          address: contractToken as Address,
          functionName: "allowance",
          args: [ownerAddress, network.swap2pAddress as Address]
        });
        if (!cancelled) {
          setTokenAllowance(value as bigint);
        }
      } catch (error) {
        logError("deal-detail", "allowance read failed", error);
        if (!cancelled) {
          setTokenAllowance(null);
        }
      } finally {
        if (!cancelled) {
          setAllowanceLoading(false);
        }
      }
    };
    void loadAllowance();
    return () => {
      cancelled = true;
    };
  }, [needsAllowanceCheck, contractToken, ownerAddress, publicClient, network.swap2pAddress, allowanceNonce]);

  const hasSufficientAllowance =
    requiredAllowance !== null && tokenAllowance !== null && tokenAllowance >= requiredAllowance;
  const approvalButtonVisible = Boolean(needsAllowanceCheck && requiredAllowance !== null && ownerAddress);
  const approvalApproved = approvalButtonVisible && hasSufficientAllowance;
  const primaryDisabled = Boolean(
    !ownerAddress ||
      (needsAllowanceCheck && requiredAllowance !== null && !hasSufficientAllowance) ||
      allowanceLoading ||
      approvalBusy,
  );
  const primaryDisabledHint = (() => {
    if (!ownerAddress) {
      return "Connect your wallet to continue.";
    }
    if (!needsAllowanceCheck) return undefined;
    if (allowanceLoading) {
      return "Checking allowance…";
    }
    if (requiredAllowance !== null && !hasSufficientAllowance) {
      return "Approve the token allowance before continuing.";
    }
    return undefined;
  })();

  if (isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-8">
        <Skeleton className="h-10 w-40 rounded-full" />
        <div className="space-y-6">
          <Skeleton className="h-12 w-2/3 rounded-full" />
          <Skeleton className="h-40 w-full rounded-3xl" />
        </div>
        <Skeleton className="h-[360px] w-full rounded-3xl" />
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-12 text-center sm:px-8">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Deal not found</h1>
        <p className="text-sm text-muted-foreground">
          The requested deal is not part of the dataset yet. Try returning to the deals overview.
        </p>
        <Button type="button" className="mx-auto rounded-full px-6" onClick={onBack}>
          Back to deals
        </Button>
      </div>
    );
  }

  const summary = getDealSideCopy(deal.side);
  const isMaker = perspective.isMaker;
  const userSide = (perspective.userSide ?? deal.side).toUpperCase();
  const userAction = userSide === "SELL" ? "sell" : "buy";
  const pricePerToken = typeof deal.price === "number" ? deal.price : null;
  const fiatAmount =
    typeof deal.fiatAmount === "number"
      ? deal.fiatAmount
      : pricePerToken !== null
        ? pricePerToken * deal.amount
        : null;
  const priceValue = pricePerToken !== null ? formatPrice(pricePerToken) : null;

  const tokenAmountValue = formatTokenAmount(deal.amount, displayTokenDecimals);
  const fiatAmountFormatted = fiatAmount ? formatFiatAmount(fiatAmount) : null;
  const metaFiatLabel = fiatAmountFormatted ? `${fiatAmountFormatted}` : "—";

  const counterpartyLabel = isMaker ? "Client" : "Merchant";
  const counterpartyAddress = isMaker ? deal.taker : deal.maker;

  const handleApproveTokens = async (mode: ApprovalMode) => {
    if (!needsAllowanceCheck || !deal?.contract?.token) {
      setActionError("Deal data unavailable for approval.");
      return;
    }
    if (!publicClient || !walletClient || !ownerAddress) {
      setActionError("Connect your wallet to approve tokens.");
      return;
    }
    if (!requiredAllowance) {
      setActionError("Unable to determine required allowance.");
      return;
    }

    const tokenAddress = deal.contract.token as Address;
    const spender = network.swap2pAddress as Address;
    const allowanceTarget = mode === "max" ? maxUint256 : requiredAllowance;

    setApprovalBusy(true);
    setActionError(null);
    try {
      const { request } = await publicClient.simulateContract({
        abi: erc20Abi,
        address: tokenAddress,
        functionName: "approve",
        args: [spender, allowanceTarget],
        account: ownerAddress
      });
      const txHash = await walletClient.writeContract(request);
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      setAllowanceNonce(value => value + 1);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Token approval failed.";
      logError("deal-detail", "approval failed", error);
      setActionError(message);
    } finally {
      setApprovalBusy(false);
    }
  };

  const handleAccept = (message: string) => {
    if (!deal) return;
    void withAction(() => acceptDeal(deal.id, message));
  };

  const handleCancel = (message: string) => {
    if (!deal) return;
    void withAction(() => cancelDeal(deal.id, role, message));
  };

  const handleMarkPaid = (message: string) => {
    if (!deal) return;
    void withAction(() => markDealPaid(deal.id, role, message));
  };

  const handleRelease = (message: string) => {
    if (!deal) return;
    void withAction(() => releaseDeal(deal.id, role, message));
  };

  const handleSendMessage = (message: string) => {
    if (!deal) return Promise.resolve();
    return sendMessage(deal.id, message);
  };

  const metaItems = buildDealMetaItems({
    userSide,
    userActionDescription: `You ${userAction} crypto`,
    tokenSymbol: deal.token,
    tokenAmountLabel: tokenAmountValue,
    countryCode: deal.countryCode,
    fiatLabel: deal.fiat,
    fiatSymbol: deal.currencyCode,
    fiatAmountLabel: metaFiatLabel,
    priceValue: priceValue ? (
      <PriceMetaValue priceLabel={priceValue} fiatSymbol={deal.currencyCode} tokenSymbol={deal.token} />
    ) : undefined
  });

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-8">
      <DealHeader
        title="Deal"
        subtitle={summary.headline}
        badge={deal.state}
        backLabel="Back to deals"
        onBack={onBack}
      />

      <DealSummaryCard
        title="Deal overview"
        description={<span className="text-sm text-muted-foreground">{summary.tone}</span>}
        pills={[
          {
            id: "counterparty",
            className:
              "bg-transparent px-0 py-0 shadow-none text-secondary-foreground flex flex-col items-end gap-1 text-right",
            content: <ParticipantPill label={counterpartyLabel} address={counterpartyAddress} />
          }
        ]}
        metaItems={metaItems}
        extraContent={
          <div className="flex flex-col gap-2">
            <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground/70">Last update</span>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <span>
                {new Date(deal.updatedAt).toLocaleString()} (
                <RelativeTime value={deal.updatedAt} className="text-sm text-muted-foreground" />)
              </span>
            </div>
          </div>
        }
      />

      <DealStatusPanel
        state={deal.state}
        side={deal.side}
        role={role}
        onAccept={isMaker ? handleAccept : undefined}
        onCancel={handleCancel}
        onMarkPaid={handleMarkPaid}
        onRelease={handleRelease}
        onApproveTokens={handleApproveTokens}
        busy={actionBusy}
        approvalBusy={approvalBusy || allowanceLoading}
        approvalModeStorageKey={`swap2p:approval:deal:${deal.id}`}
        approvalVisible={approvalButtonVisible}
        primaryDisabled={primaryDisabled}
        primaryDisabledHint={primaryDisabledHint}
        approvalApproved={approvalApproved}
        approvalApprovedLabel="Approved"
      />

      {actionError ? (
        <div className="rounded-2xl bg-red-500/10 p-4 text-sm text-red-600">
          {actionError}
        </div>
      ) : null}

      <DealChatCard
        dealState={deal.state}
        chat={deal.contract?.chat}
        currentAccount={address}
        maker={deal.maker}
        taker={deal.taker}
        onSendMessage={handleSendMessage}
      />
    </div>
  );
}
