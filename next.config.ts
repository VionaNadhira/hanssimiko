import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // wagmi and viem ship untranspiled ESM that Next must process itself.
  transpilePackages: ['viem', 'wagmi'],
  // The Coinbase SDK, reached through `wagmi/connectors`, declares the x402
  // payment packages as optional peers and imports them unconditionally. The
  // MetaMask SDK, reached the same way, imports a React Native storage module
  // that has no meaning in a web build. This app only uses the injected
  // connector, so none of these modules are ever executed; they are
  // externalised rather than installed.
  serverExternalPackages: [
    '@coinbase/cdp-sdk',
    '@base-org/account',
    '@x402/core',
    '@x402/evm',
    '@x402/svm',
    '@x402/extensions',
    'pino-pretty',
  ],
  webpack: (config) => {
    config.externals = [
      ...(config.externals ?? []),
      '@x402/core',
      '@x402/evm',
      '@x402/svm',
      '@x402/extensions',
      '@react-native-async-storage/async-storage',
      'pino-pretty',
    ];
    return config;
  },
  poweredByHeader: false,
  eslint: {
    // Linting is a separate, explicit step: `npm run lint`.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
