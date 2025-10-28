"use client";

import * as React from "react";
import Jazzicon from "react-jazzicon";
import { useConnectModal } from "@rainbow-me/rainbowkit";

import { useUser } from "@/context/user-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { seedFromAddress } from "@/lib/utils";
import { ProfileCopyField } from "@/components/profile/profile-copy-field";

interface ProfileViewProps {
  address?: string;
}

export function ProfileView({ address }: ProfileViewProps) {
  const { address: currentAddress } = useUser();
  const explicitAddress = address?.trim() ?? "";
  const normalizedCurrent = currentAddress?.trim() ?? "";
  const targetAddress = explicitAddress || normalizedCurrent;
  const { openConnectModal } = useConnectModal();

  const isCurrentUser = React.useMemo(() => {
    if (!targetAddress || !normalizedCurrent) return !explicitAddress && !!targetAddress;
    return targetAddress.toLowerCase() === normalizedCurrent.toLowerCase();
  }, [explicitAddress, normalizedCurrent, targetAddress]);

  const [shareOrigin, setShareOrigin] = React.useState<string>(() => process.env.NEXT_PUBLIC_APP_URL ?? "");

  React.useEffect(() => {
    if (typeof window !== "undefined" && window.location?.origin) {
      setShareOrigin(window.location.origin);
    }
  }, []);

  const partnerLink = React.useMemo(() => {
    if (!targetAddress) return "";
    const origin = (shareOrigin ?? "").trim().replace(/\/$/, "");
    if (origin) {
      return `${origin}?p=${targetAddress}`;
    }
    return `?p=${targetAddress}`;
  }, [shareOrigin, targetAddress]);

  const seed = React.useMemo(() => seedFromAddress(targetAddress), [targetAddress]);

  if (!targetAddress) {
    return (
      <div className="mx-auto flex min-h-[60vh] w-full max-w-4xl flex-col items-center justify-center gap-6 px-4 text-center">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Profile</h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            Connect your wallet to review your profile.
          </p>
        </div>
        <Button
          type="button"
          size="lg"
          className="rounded-full px-8 py-3 text-base font-semibold"
          onClick={() => openConnectModal?.()}
        >
          Connect Wallet
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-8 sm:px-8">
      <section className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Profile</h1>
        <p className="text-sm text-muted-foreground sm:text-base">Review user profile</p>
      </section>

      <Card className="card-surface-soft">
        <CardContent className="flex flex-col items-center gap-6 py-8 text-center sm:pt-8">
          <div className="flex h-24 w-24 items-center justify-center rounded-full border border-border/60 bg-background/80 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.7)]">
            <Jazzicon diameter={80} seed={seed} />
          </div>
          <ProfileCopyField label="Wallet address" value={targetAddress} />
        </CardContent>
      </Card>

      {isCurrentUser ? (
        <Card className="card-surface-soft">
          <CardHeader className="gap-4">
            <div className="space-y-2">
              <CardTitle className="text-xl">Partner program</CardTitle>
              <CardDescription>
                Earn lifetime 0.15% from every maker trade and 0.1% from every taker trade completed by users who register with your link.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <ProfileCopyField
              label="Referral link"
              value={partnerLink}
              align="start"
              pillClassName="w-full"
              valueClassName="text-xs sm:text-sm"
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
