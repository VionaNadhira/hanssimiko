import { createAppKit } from '@reown/appkit/react';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { defineChain } from 'viem';
import { QueryClient } from '@tanstack/react-query';

import {
  EXPLORER_URL,
  ZERO_G_CHAIN_ID,
  ZERO_G_CHAIN_NAME,
  ZERO_G_NATIVE_CURRENCY,
  ZERO_G_RPC_URL,
} from '@/config/chain';

/**
 * viem chain object for the wallet stack.
 *
 * Mirrors `lib/viemClient.ts` because wagmi and the log querier need separate
 * instances, but both read the same shared config so the two cannot drift. In
 * particular the explorer URL is a single literal in the codebase.
 */
export const zeroGMainnet = defineChain({
  id: ZERO_G_CHAIN_ID,
  name: ZERO_G_CHAIN_NAME,
  nativeCurrency: ZERO_G_NATIVE_CURRENCY,
  rpcUrls: {
    default: { http: [ZERO_G_RPC_URL] },
  },
  blockExplorers: {
    default: { name: '0G ChainScan', url: EXPLORER_URL },
  },
  testnet: false,
});

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim() ?? '';

/**
 * The canonical URL of this deployment.
 *
 * WalletConnect Verify API checks that `metadata.url` exactly matches the
 * origin the wallet sees. An incorrect or mismatched URL triggers the
 * "phishing" warning shown by MetaMask, Rainbow, etc.
 *
 * Set NEXT_PUBLIC_APP_URL to the Railway (or custom) domain BEFORE building,
 * e.g. https://hanssimiko.up.railway.app  — no trailing slash.
 * During local development it falls back to localhost:3000.
 */
const appUrl =
  process.env.NEXT_PUBLIC_APP_URL?.trim() ||
  (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');

const metadata = {
  name: 'Hanssimiko Bunker',
  description: 'Non-custodial timelock vault for native 0G on 0G Chain',
  url: appUrl,
  icons: ['https://0g.ai/assets/68c94090bf5d17500549f947_0G-500x500.png'],
};

export const wagmiAdapter = new WagmiAdapter({
  networks: [zeroGMainnet],
  projectId,
  ssr: true,
});

export const wagmiConfig = wagmiAdapter.wagmiConfig;

export const modal = createAppKit({
  adapters: [wagmiAdapter],
  networks: [zeroGMainnet],
  projectId,
  metadata,
  themeMode: 'dark',
  themeVariables: {
    '--w3m-accent': '#9200e1',
  },
  chainImages: {
    [ZERO_G_CHAIN_ID]: 'https://0g.ai/assets/68c94090bf5d17500549f947_0G-500x500.png',
  },
  features: {
    analytics: false,
    email: false,
    socials: false,
  },
});

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 3_000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });
}

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig;
  }
}
