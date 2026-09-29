'use client';

import {useCallback, useMemo, useRef, useState} from 'react';
import {
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi';

/**
 * Write calldata, described loosely.
 *
 * wagmi's own parameter type is a union over every function in the ABI, and a
 * discriminated member cannot be produced here because the caller assembles
 * `gas` and `value` conditionally. This shape is what a payable write actually
 * needs; it is narrowed once, inside `send`.
 */
export interface TxParams {
  address: `0x${string}`;
  abi: unknown;
  functionName: string;
  args?: readonly unknown[];
  value?: bigint;
  gas?: bigint;
  account?: `0x${string}` | undefined;
  chainId?: number | undefined;
}

/**
 * Explicit transaction state machine.
 *
 * wagmi exposes several overlapping signals (`isPending`, `isConfirming`,
 * `isSuccess`, `isError`, `hash`) plus a rejection branch it never reports as
 * `isError`. Mapping them by hand at each call site is how UIs end up stuck on
 * "pending", or let a double click broadcast two transactions. This hook derives
 * one unambiguous phase and guards re-entry.
 */
export type TxPhase =
  | 'idle'
  /** Wallet modal is open, waiting for the user to sign. */
  | 'awaiting_signature'
  /** Signed and broadcast; waiting for a receipt. */
  | 'pending'
  | 'success'
  /** Mined but reverted, or a non-rejection RPC/wallet failure. */
  | 'failed'
  /** The user actively declined in the wallet. The form keeps its input. */
  | 'rejected';

export interface TxController {
  phase: TxPhase;
  hash: `0x${string}` | undefined;
  /** Raw error. Log this, never render it verbatim. */
  error: unknown;
  /** True while the user must act (signature prompt, or mining). */
  isBusy: boolean;
  isConfirming: boolean;
  isSuccess: boolean;
  /** Broadcasts a write. Safe to call from a click handler. */
  send: (params: TxParams) => Promise<`0x${string}` | undefined>;
  /** Returns the form to `idle`. */
  reset: () => void;
}

function isRejection(error: unknown): boolean {
  if (!error) return false;
  const e = error as {name?: string; shortMessage?: string; message?: string; details?: string};
  if (e.name === 'UserRejectedRequestError') return true;
  const haystack = `${e.name ?? ''} ${e.shortMessage ?? ''} ${e.message ?? ''} ${e.details ?? ''}`;
  return /user rejected|user denied|request rejected|rejected the request|denied transaction signature|cancell?ed by user/i.test(
    haystack,
  );
}

export function useTxController(): TxController {
  const {
    data: hash,
    writeContractAsync,
    isPending: isSigning,
    reset: resetWrite,
  } = useWriteContract();
  const {
    data: receipt,
    isLoading: isConfirming,
    isSuccess,
    isError: isReceiptError,
    error: receiptError,
  } = useWaitForTransactionReceipt({hash});

  // Rejections never reach wagmi's `error`, so they are tracked here.
  const [rejected, setRejected] = useState(false);
  const [localError, setLocalError] = useState<unknown>(null);

  // Synchronous re-entry guard. A state flag cannot do this job: two clicks in
  // the same tick both read the pre-update value, and both would broadcast. A
  // ref is written before the first `await` and therefore visible to the second
  // call immediately.
  const inFlightRef = useRef(false);

  const reset = useCallback(() => {
    inFlightRef.current = false;
    setRejected(false);
    setLocalError(null);
    resetWrite();
  }, [resetWrite]);

  const send = useCallback(
    async (params: TxParams): Promise<`0x${string}` | undefined> => {
      // A second click while the first is still awaiting the wallet must not
      // broadcast a duplicate deposit.
      if (inFlightRef.current) return undefined;
      inFlightRef.current = true;

      // Re-attempting after a rejection or a failure starts from a clean slate.
      if (rejected || localError) reset();
      setRejected(false);
      setLocalError(null);

      try {
        const sent = (await writeContractAsync(
          params as unknown as Parameters<typeof writeContractAsync>[0],
        )) as `0x${string}` | undefined;
        return sent;
      } catch (error) {
        console.error('[tx] broadcast failed', error);
        if (isRejection(error)) {
          setRejected(true);
        } else {
          setLocalError(error);
        }
        return undefined;
      } finally {
        // Released once the wallet has answered. From here the button is
        // disabled by `isBusy` because a hash exists.
        inFlightRef.current = false;
      }
    },
    [localError, rejected, reset, writeContractAsync],
  );

  // A mined transaction that reverted is a failure, not a success. wagmi sets
  // `isSuccess` as soon as a receipt exists, regardless of its status, so the
  // status field has to be consulted explicitly or a reverted deposit would be
  // reported as confirmed.
  const reverted = receipt?.status === 'reverted';

  // A revert raises no query error, so without this the failure branch would
  // have nothing to render and the user would see "failed" with no explanation.
  const revertError = reverted
    ? Object.assign(new Error('The transaction was mined but reverted on chain.'), {
        name: 'TransactionRevertedError',
      })
    : null;

  const error = localError ?? receiptError ?? revertError ?? undefined;

  const phase = useMemo<TxPhase>(() => {
    if (rejected) return 'rejected';
    if (reverted) return 'failed';
    if (isSuccess) return 'success';
    if (error) return 'failed';
    if (isReceiptError) return 'failed';
    if (hash) return 'pending';
    if (isSigning) return 'awaiting_signature';
    return 'idle';
  }, [error, hash, isReceiptError, isSigning, isSuccess, rejected, reverted]);

  return {
    phase,
    hash,
    error,
    isBusy: phase === 'pending' || phase === 'awaiting_signature',
    isConfirming,
    isSuccess: isSuccess && !reverted,
    send,
    reset,
  };
}

export {isRejection};
