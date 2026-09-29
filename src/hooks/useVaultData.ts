'use client';

import {useAccount, useBlockNumber, useReadContract, useReadContracts} from 'wagmi';

import {ZERO_G_CHAIN_ID} from '@/config/chain';
import {IS_LOCKER_CONFIGURED, locker} from '@/config/contract';
import {SECONDS_PER_DAY} from '@/config/terms';
import {useNowSeconds} from '@/lib/useNow';

type LockRecord = {
  owner: `0x${string}`;
  amount: bigint;
  startTime: bigint;
  unlockTime: bigint;
  withdrawn: boolean;
};

export type LockStatus = 'active' | 'ready' | 'settled';

export interface Position {
  lockId: bigint;
  /** Address that opened the lock. Null only while the batched record is in
   *  flight; the contract always stores a non-zero owner. */
  owner: `0x${string}` | null;
  amount: bigint;
  startTime: bigint;
  unlockTime: bigint;
  withdrawn: boolean;
  days: number;
  status: LockStatus;
}

export interface VaultData {
  positions: Position[];
  ids: readonly bigint[];
  isLoading: boolean;
  isFetching: boolean;
  error: unknown;
  isEnabled: boolean;
  refetch: () => void;
  now: bigint;
}

/**
 * A user's locks, resolved from the contract in two round trips.
 *
 * `getUserLockIds` returns the ids, then `getLock` is batched per id. Every
 * consumer (Overview, My Locks, History refresh) reads from here so the counts on
 * the dashboard can never disagree with the list behind them.
 */
export function useVaultData(): VaultData {
  const {address, isConnected} = useAccount();
  // A new block re-renders the tree anyway, which is what kept this fresh before
  // the shared clock existed; the clock is now the single source of time.
  useBlockNumber({watch: true});
  const now = useNowSeconds(1_000);

  const enabled = IS_LOCKER_CONFIGURED && isConnected && Boolean(address);

  const {
    data: lockIds,
    isLoading: isLoadingIds,
    isFetching: isFetchingIds,
    error: idsError,
    refetch: refetchIds,
  } = useReadContract({
    ...locker,
    functionName: 'getUserLockIds',
    args: address ? [address] : undefined,
    query: {enabled},
  });

  const ids = lockIds ?? [];

  const {
    data: batched,
    isLoading: isLoadingRecords,
    isFetching: isFetchingRecords,
    error: recordsError,
    refetch: refetchRecords,
  } = useReadContracts({
    contracts: ids.map((lockId) => ({...locker, functionName: 'getLock', args: [lockId] as const})),
    query: {enabled: enabled && ids.length > 0},
  });

  const positions: Position[] = ids.map((lockId, index) => {
    const record = batched?.[index]?.result as LockRecord | undefined;
    const startTime = record?.startTime ?? 0n;
    const unlockTime = record?.unlockTime ?? 0n;
    const withdrawn = record?.withdrawn ?? false;
    const status: LockStatus = withdrawn ? 'settled' : unlockTime > 0n && unlockTime <= now ? 'ready' : 'active';
    const days = record ? Number((unlockTime - startTime) / BigInt(SECONDS_PER_DAY)) : 0;
    return {
      lockId,
      owner: record?.owner ?? null,
      amount: record?.amount ?? 0n,
      startTime,
      unlockTime,
      withdrawn,
      days,
      status,
    };
  });

  return {
    positions,
    ids,
    isLoading: isLoadingIds || (ids.length > 0 && isLoadingRecords),
    isFetching: isFetchingIds || isFetchingRecords,
    error: idsError ?? recordsError,
    isEnabled: enabled,
    refetch: () => {
      void refetchIds();
      if (ids.length > 0) void refetchRecords();
    },
    now,
  };
}

/** True when the wallet is on the only chain this app supports. */
export function useCorrectNetwork(): boolean {
  const {chain, isConnected} = useAccount();
  return isConnected && chain?.id === ZERO_G_CHAIN_ID;
}
