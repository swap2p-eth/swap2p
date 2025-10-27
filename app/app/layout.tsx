import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "@rainbow-me/rainbowkit/styles.css";
import { Providers } from "@/providers";
import { SiteHeader } from "@/components/site-header";
import { DealsProvider } from "@/components/deals/deals-provider";
import {Toaster} from "sonner";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Swap2p",
  description: "Peer to peer crypto / fiat exchange market",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" }
    ],
    apple: "/apple-touch-icon.png",
    shortcut: "/favicon.ico"
  },
  manifest: "/site.webmanifest"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>
          <DealsProvider>
            <div className="flex min-h-screen flex-col">
              <SiteHeader />
              <Toaster
                  position="top-right"
                  offset={{ top: "88px", right: "24px" }}
                  closeButton
                  richColors={false}
              />
              <main className="flex-1 bg-transparent">
                {children}
              </main>
            </div>
          </DealsProvider>
        </Providers>
      </body>
    </html>
  );
}
