/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true
  },
  transpilePackages: [
    "@rainbow-me/rainbowkit",
    "@mezo-org/passport",
    "@mezo-org/orangekit-contracts",
    "@mezo-org/orangekit-smart-account",
    "@mezo-org/orangekit"
  ],
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
