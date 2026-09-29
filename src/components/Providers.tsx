'use client';

import {QueryClientProvider} from '@tanstack/react-query';
import {useEffect, useState, type ReactNode} from 'react';
import {WagmiProvider} from 'wagmi';

import {Toaster} from '@/components/Toaster';
import {assertLockerConfigured} from '@/config/contract';
import {makeQueryClient, wagmiConfig} from '@/lib/wagmi';

/**
 * Wallet, data and notification providers.
 *
 * A single `QueryClient` is created per browser session. The frontend talks to
 * 0G Mainnet exclusively, over the read-only transport, and signs only through
 * the user's own wallet. No private key ever reaches this bundle.
 */
export function Providers({children}: {children: ReactNode}) {
  const [queryClient] = useState(makeQueryClient);

  // Surface a missing or malformed contract address once, at startup, rather
  // than letting the first deposit fail silently.
  useEffect(() => {
    assertLockerConfigured();
  }, []);

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster />
      </QueryClientProvider>
    </WagmiProvider>
  );
}
