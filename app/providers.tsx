"use client";

import { useMemo, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { RainbowKitProvider, lightTheme, midnightTheme } from "@rainbow-me/rainbowkit";
import { WagmiProvider, useAccount } from "wagmi";
import { getConfig } from "@mezo-org/passport/dist/src/config";
import { CHAIN_ID, RPC_BY_NETWORK, mezoMainnet, mezoTestnet } from "@mezo-org/passport/dist/src/constants";
import { ThemeProvider } from "@/components/theme-provider";
import { UserProvider } from "@/context/user-context";
import { useTheme } from "next-themes";
import { http } from "viem";
import { Toaster } from "sonner";

import { hardhatChain, hardhatTransport } from "@/lib/chains";

type MezoConfigArgs = Parameters<typeof getConfig>[0] & {
  autoConnect?: boolean;
};

const createMezoConfig = (args: MezoConfigArgs) => getConfig(args);

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            staleTime: 1000 * 30
          }
        }
      })
  );

  const wagmiConfig = useMemo(() => {
    const walletConnectProjectId =
      process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ??
      "51e609ac221c8fb9cbee39d15fb1458f";
    const mezoNetwork = (process.env.NEXT_PUBLIC_MEZO_NETWORK ?? "testnet") as
      | "testnet"
      | "mainnet";
    const chains = [hardhatChain, mezoTestnet, mezoMainnet] as const;
    const transports: Record<number, ReturnType<typeof http>> = {
      [hardhatChain.id]: hardhatTransport,
      [CHAIN_ID.testnet]: http(RPC_BY_NETWORK.testnet.http),
      [CHAIN_ID.mainnet]: http(RPC_BY_NETWORK.mainnet.http),
    };
    const bitcoinWallets = typeof window === "undefined" ? [] : undefined;
    return createMezoConfig({
      appName: "Swap2p Console",
      walletConnectProjectId,
      mezoNetwork,
      autoConnect: true,
      bitcoinWallets,
      chains: [...chains] as Parameters<typeof getConfig>[0]["chains"],
      transports: transports as NonNullable<Parameters<typeof getConfig>[0]["transports"]>,
    });
  }, []);

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <WagmiProvider config={wagmiConfig}>
        <WalletUserProvider>
          <QueryClientProvider client={queryClient}>
            <RainbowKitThemeProvider>
              {children}
              {process.env.NODE_ENV === "development" ? <ReactQueryDevtools initialIsOpen={false} /> : null}
            </RainbowKitThemeProvider>
          </QueryClientProvider>
        </WalletUserProvider>
      </WagmiProvider>
    </ThemeProvider>
  );
}

function RainbowKitThemeProvider({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();
  const theme = useMemo(() => {
    if (resolvedTheme === "dark") {
      const base = midnightTheme({
        accentColor: "#4f46e5",
        accentColorForeground: "#f8fafc",
        borderRadius: "large",
        fontStack: "system"
      });
      return {
        ...base,
        fonts: {
          ...base.fonts,
          body: "Inter, 'Helvetica Neue', Arial, sans-serif"
        },
        colors: {
          ...base.colors,
          connectButtonText: "#f8fafc",
          connectButtonBackground: "rgba(79,70,229,0.18)",
          connectButtonInnerBackground: "rgba(15,23,42,0.9)",
          profileForeground: "rgba(15,23,42,0.92)",
          modalBackground: "rgba(15,23,42,0.96)",
          actionButtonSecondaryBackground: "rgba(148,163,184,0.16)",
          generalBorder: "rgba(148,163,184,0.24)",
          menuItemBackground: "rgba(59,130,246,0.12)"
        }
      };
    }
    const base = lightTheme({
      accentColor: "#2563eb",
      accentColorForeground: "#f8fafc",
      borderRadius: "large",
      fontStack: "system"
    });
    return {
      ...base,
      fonts: {
        ...base.fonts,
        body: "Inter, 'Helvetica Neue', Arial, sans-serif"
      },
      colors: {
        ...base.colors,
        connectButtonBackground: "rgba(37,99,235,0.12)",
        connectButtonInnerBackground: "#ffffff",
        connectButtonText: "#0f172a",
        profileForeground: "#f8fafc",
        modalBackground: "#f8fafc",
        actionButtonSecondaryBackground: "rgba(15,23,42,0.06)",
        generalBorder: "rgba(15,23,42,0.08)",
        menuItemBackground: "rgba(37,99,235,0.08)"
      }
    };
  }, [resolvedTheme]);

  return (
    <RainbowKitProvider initialChain={hardhatChain} modalSize="compact" theme={theme}>
      {children}
      <Toaster
        position="top-right"
        offset={{ top: "88px", right: "24px" }}
        closeButton
        richColors={false}
      />
    </RainbowKitProvider>
  );
}

function WalletUserProvider({ children }: { children: React.ReactNode }) {
  const { address } = useAccount();
  return <UserProvider address={address ?? ""}>{children}</UserProvider>;
}
