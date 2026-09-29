import {createPublicClient, http, defineChain} from 'viem';

import {
  EXPLORER_URL,
  ZERO_G_CHAIN_ID,
  ZERO_G_CHAIN_NAME,
  ZERO_G_NATIVE_CURRENCY,
  ZERO_G_RPC_URL,
} from '@/config/chain';

/**
 * Plain viem chain + read-only client.
 *
 * Deliberately separate from `lib/wagmi.ts`: that module pulls in the whole
 * AppKit bundle for the React tree, and log queries run outside React (inside a
 * React Query fetcher), where none of that is needed.
 *
 * The explorer URL comes from the shared chain config rather than being repeated
 * here, so there is a single literal in the codebase.
 */
export const zeroGMainnet = defineChain({
  id: ZERO_G_CHAIN_ID,
  name: ZERO_G_CHAIN_NAME,
  nativeCurrency: ZERO_G_NATIVE_CURRENCY,
  rpcUrls: {
    default: {http: [ZERO_G_RPC_URL]},
  },
  blockExplorers: {
    default: {name: '0G ChainScan', url: EXPLORER_URL},
  },
  testnet: false,
});

/**
 * Read-only transport. It can never sign: the app only ever reads with this
 * client and sends through the user's own wallet.
 */
export const zeroGClient = createPublicClient({
  chain: zeroGMainnet,
  transport: http(ZERO_G_RPC_URL, {batch: true}),
});
