'use client';

import {useCallback} from 'react';
import {useQueryClient} from '@tanstack/react-query';

/**
 * Refreshes every read that depends on contract state.
 *
 * The dashboard, My Locks, History and the account balance are separate queries
 * over the same contract. Invalidating all of them after a confirmed receipt is
 * what lets a new lock appear without a page reload; `refetchType: 'active'`
 * keeps the ones already on screen updating instead of remounting.
 */
export function useRefreshChainData() {
  const queryClient = useQueryClient();

  return useCallback(async () => {
    await queryClient.invalidateQueries({refetchType: 'active'});
  }, [queryClient]);
}
