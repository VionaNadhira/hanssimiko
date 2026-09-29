'use client';

import {useQuery} from '@tanstack/react-query';
import type {Address} from 'viem';
import {useAccount} from 'wagmi';

import {IS_LOCKER_CONFIGURED, LOG_CHUNK_SIZE, ZERO_G_DEPLOY_BLOCK, CONTRACT_ADDRESS} from '@/config/contract';
import {zeroGClient as client} from '@/lib/viemClient';

/**
 * The audit ledger, read from the chain rather than from a read-model.
 *
 * Every row is anchored to a block number and a log index, which is what makes
 * the tx link verifiable. A read-model would silently lose history the moment a
 * node pruned its state.
 *
 * Only the two events a user can produce are declared here; the field order and
 * types mirror `ZeroGLocker.sol` and are asserted against the generated ABI by
 * the contract tests.
 */
const LEDGER_ABI = [
  {
    type: 'event',
    name: 'LockCreated',
    inputs: [
      {indexed: true, name: 'lockId', type: 'uint256'},
      {indexed: true, name: 'owner', type: 'address'},
      {indexed: false, name: 'amount', type: 'uint256'},
      {indexed: false, name: 'startTime', type: 'uint256'},
      {indexed: false, name: 'unlockTime', type: 'uint256'},
      {indexed: false, name: 'duration', type: 'uint256'},
    ],
  },
  {
    type: 'event',
    name: 'LockWithdrawn',
    inputs: [
      {indexed: true, name: 'lockId', type: 'uint256'},
      {indexed: true, name: 'owner', type: 'address'},
      {indexed: false, name: 'amount', type: 'uint256'},
      {indexed: false, name: 'unlockTime', type: 'uint256'},
      {indexed: false, name: 'withdrawnAt', type: 'uint256'},
    ],
  },
] as const;

export type LedgerEventKind = 'LockCreated' | 'LockWithdrawn';

export interface LedgerRow {
  /** De-duplication key: a transaction can emit several logs. */
  key: string;
  kind: LedgerEventKind;
  transactionHash: `0x${string}`;
  blockNumber: bigint;
  logIndex: number;
  lockId: bigint;
  amount: bigint;
  unlockTime: bigint;
  /** Block timestamp in seconds, resolved per block and cached. */
  timestamp: bigint | null;
}

/** Recent window used only when the deployment block is not configured. */
const FALLBACK_WINDOW = 50_000n;

function resolveFromBlock(latest: bigint): bigint {
  if (ZERO_G_DEPLOY_BLOCK > 0n) return ZERO_G_DEPLOY_BLOCK;
  return latest > FALLBACK_WINDOW ? latest - FALLBACK_WINDOW : 0n;
}

/**
 * Walks the range in chunks.
 *
 * Public RPCs cap the block span of a single `eth_getLogs`; asking for the whole
 * chain returns an error, not an empty page.
 */
async function fetchOwnerEvents(
  owner: Address,
  fromBlock: bigint,
  toBlock: bigint,
  eventName: LedgerEventKind,
) {
  const rows: LedgerRow[] = [];
  const span = toBlock - fromBlock + 1n;
  const steps = span <= 0n ? 0n : (span + LOG_CHUNK_SIZE - 1n) / LOG_CHUNK_SIZE;

  for (let i = 0n; i < steps; i += 1n) {
    const chunkFrom = fromBlock + i * LOG_CHUNK_SIZE;
    const candidate = chunkFrom + LOG_CHUNK_SIZE - 1n;
    const chunkTo = candidate > toBlock ? toBlock : candidate;

    // `owner` is indexed on both events, so the node filters for us instead of
    // us pulling every event in the chain and discarding most of them.
    const logs = await client.getContractEvents({
      address: CONTRACT_ADDRESS as Address,
      abi: LEDGER_ABI,
      eventName,
      args: {owner},
      fromBlock: chunkFrom,
      toBlock: chunkTo,
    });

    for (const log of logs) {
      // Every field is non-null in practice, but the decoded log type marks them
      // optional; an incomplete log is skipped rather than rendered half-empty.
      if (!log.transactionHash || log.blockNumber === undefined) continue;
      if (log.args.lockId === undefined || log.args.amount === undefined || log.args.unlockTime === undefined) {
        continue;
      }
      rows.push({
        key: `${log.transactionHash}-${log.logIndex ?? 0}`,
        kind: eventName,
        transactionHash: log.transactionHash,
        blockNumber: log.blockNumber,
        logIndex: log.logIndex ?? 0,
        lockId: log.args.lockId,
        amount: log.args.amount,
        unlockTime: log.args.unlockTime,
        timestamp: null,
      });
    }
  }

  return rows;
}

/** Block timestamps are fetched once per block and reused across rows. */
const blockCache = new Map<bigint, bigint>();

async function resolveTimestamp(blockNumber: bigint): Promise<bigint> {
  const cached = blockCache.get(blockNumber);
  if (cached !== undefined) return cached;
  const block = await client.getBlock({blockNumber});
  const seconds = BigInt(block.timestamp);
  blockCache.set(blockNumber, seconds);
  return seconds;
}

export async function fetchLedger(owner: Address): Promise<LedgerRow[]> {
  const latest = BigInt(await client.getBlockNumber());
  const fromBlock = resolveFromBlock(latest);
  if (fromBlock > latest) return [];

  const [created, withdrawn] = await Promise.all([
    fetchOwnerEvents(owner, fromBlock, latest, 'LockCreated'),
    fetchOwnerEvents(owner, fromBlock, latest, 'LockWithdrawn'),
  ]);

  // Newest first. De-duplicated on (txHash, logIndex) so a chunk boundary that
  // returns a log twice cannot produce two rows for one event.
  const seen = new Set<string>();
  const rows = [...created, ...withdrawn]
    .filter((row) => {
      if (seen.has(row.key)) return false;
      seen.add(row.key);
      return true;
    })
    .sort((a, b) => {
      if (a.blockNumber === b.blockNumber) return b.logIndex - a.logIndex;
      return a.blockNumber > b.blockNumber ? -1 : 1;
    });

  const stamps = await Promise.all(
    rows.map(async (row): Promise<bigint | null> => {
      try {
        return await resolveTimestamp(row.blockNumber);
      } catch {
        return null;
      }
    }),
  );
  rows.forEach((row, index) => {
    row.timestamp = stamps[index] ?? null;
  });

  return rows;
}

/**
 * React Query wrapper. The invalidation that runs after a confirmed lock hits
 * this key too, so a new row appears without a page reload.
 */
export function useLedger(enabled: boolean) {
  const {address} = useAccount();

  return useQuery({
    queryKey: ['zero-g-ledger', address ?? 'none'],
    queryFn: () => fetchLedger(address as Address),
    enabled: enabled && IS_LOCKER_CONFIGURED && Boolean(address),
    staleTime: 15_000,
    retry: 1,
  });
}
