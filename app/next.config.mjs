/** @type {import('next').NextConfig} */
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const isDev = process.env.NODE_ENV !== "production";

const connectSrc = [
  "'self'",
  "https://rpc.walletconnect.com",
  "https://*.walletconnect.com",
  "wss://rpc.walletconnect.com",
  "wss://*.walletconnect.com",
  "https://*.mezo.network",
  "https://*.mezo.page",
  "https://*.mezo.org"
];

if (isDev) {
  connectSrc.push("http://127.0.0.1:*", "http://localhost:*");
}

const cspDirectives = [
  "default-src 'self'",
  `script-src 'self'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob:",
  "font-src 'self' https://fonts.gstatic.com data:",
  `connect-src ${connectSrc.join(" ")}`,
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'"
];

const contentSecurityPolicy = cspDirectives.join("; ");

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: contentSecurityPolicy.replace(/\s{2,}/g, " ").trim()
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin"
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()"
  },
  {
    key: "X-Frame-Options",
    value: "DENY"
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff"
  }
];

if (!isDev) {
  securityHeaders.push({
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload"
  });
}

const nextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true,
  },
  outputFileTracingRoot: __dirname,
  transpilePackages: [
    "@rainbow-me/rainbowkit",
    "@mezo-org/passport",
    "@mezo-org/orangekit-contracts",
    "@mezo-org/orangekit-smart-account",
    "@mezo-org/orangekit"
  ],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      }
    ];
  },
  webpack: (config) => {
    config.resolve = config.resolve || {};
    config.resolve.fallback = {
      ...(config.resolve.fallback || {}),
      encoding: false,
      "pino-pretty": false,
      fs: false,
      child_process: false,
      net: false,
      tls: false
    };
    return config;
  }
};

export default nextConfig;
