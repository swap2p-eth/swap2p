"use client";

import { useEffect, useMemo, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { RainbowKitProvider, lightTheme, midnightTheme } from "@rainbow-me/rainbowkit";
import { WagmiProvider, useAccount } from "wagmi";
import { getConfig } from "@mezo-org/passport/dist/src/config";
import {RPC_BY_NETWORK, mezoMainnet, mezoTestnet} from "@mezo-org/passport/dist/src/constants";
import { ThemeProvider } from "@/components/theme-provider";
import { UserProvider } from "@/context/user-context";
import { useTheme } from "next-themes";
import { http } from "viem";
import type { Chain } from "viem/chains";

import { hardhatChain, hardhatTransport } from "@/lib/chains";
import { APP_CONFIG, type NetworkKey, type NetworkConfig } from "@/config";

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

  const { config: wagmiConfig, initialChain } = useMemo(() => {
    const walletConnectProjectId =
      process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ??
      "51e609ac221c8fb9cbee39d15fb1458f";

    const networkEntries = Object.entries(APP_CONFIG.networks).filter(
      (entry): entry is [NetworkKey, NetworkConfig] => Boolean(entry[1]),
    );
    const networkKeys = networkEntries.map(([key]) => key);
    const chainRegistry: Partial<Record<NetworkKey, Chain>> = {
      hardhat: hardhatChain,
      testnet: mezoTestnet,
      mezo: mezoMainnet,
    };
    const transportRegistry: Partial<Record<NetworkKey, ReturnType<typeof http>>> = {
      hardhat: hardhatTransport,
      testnet: http(RPC_BY_NETWORK.testnet.http),
      mezo: http(RPC_BY_NETWORK.mainnet.http),
    };

    const chains = networkKeys
      .map(key => chainRegistry[key])
      .filter((chain): chain is Chain => Boolean(chain));

    const transports = networkKeys.reduce<Record<number, ReturnType<typeof http>>>((acc, key) => {
      const chain = chainRegistry[key];
      const transport = transportRegistry[key];
      if (chain && transport) {
        acc[chain.id] = transport;
      }
      return acc;
    }, {});

    const bitcoinWallets = typeof window === "undefined" ? [] : undefined;

    const config = createMezoConfig({
      appName: "Swap2p Console",
      walletConnectProjectId,
      mezoNetwork: "mainnet",
      autoConnect: true,
      bitcoinWallets,
      chains: chains as Parameters<typeof getConfig>[0]["chains"],
      transports: transports as NonNullable<Parameters<typeof getConfig>[0]["transports"]>,
    });

    const defaultChain =
      chainRegistry[APP_CONFIG.defaultNetwork] ?? chains[0] ?? hardhatChain;

    return { config, initialChain: defaultChain };
  }, []);

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <WagmiProvider config={wagmiConfig}>
        <WalletUserProvider>
          <QueryClientProvider client={queryClient}>
            <RainbowKitThemeProvider initialChain={initialChain}>
              {children}
              {process.env.NODE_ENV === "development" ? <ReactQueryDevtools initialIsOpen={false} /> : null}
            </RainbowKitThemeProvider>
          </QueryClientProvider>
        </WalletUserProvider>
      </WagmiProvider>
    </ThemeProvider>
  );
}

function RainbowKitThemeProvider({
  children,
  initialChain,
}: {
  children: React.ReactNode;
  initialChain: Chain;
}) {
  const { resolvedTheme } = useTheme();
  const [colorMode, setColorMode] = useState<"light" | "dark">("light");

  useEffect(() => {
    if (resolvedTheme === "dark") {
      setColorMode("dark");
    } else {
      setColorMode("light");
    }
  }, [resolvedTheme]);

  const theme = useMemo(() => {
    if (colorMode === "dark") {
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
  }, [colorMode]);

  return (
    <RainbowKitProvider initialChain={initialChain} modalSize="compact" theme={theme}>
      {children}
    </RainbowKitProvider>
  );
}

function WalletUserProvider({ children }: { children: React.ReactNode }) {
  const { address } = useAccount();
  return <UserProvider address={address ?? ""}>{children}</UserProvider>;
}
