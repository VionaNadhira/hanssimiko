'use client';

import {useEffect, useRef} from 'react';
import {AlertTriangle, CheckCircle2, ExternalLink, Loader2} from 'lucide-react';

import {toast} from 'sonner';

import {CopyButton} from '@/components/CopyButton';
import {getTxUrl} from '@/config/chain';
import {readableError} from '@/lib/errors';
import {shortenHex} from '@/lib/format';
import type {TxController, TxParams, TxPhase} from '@/lib/useTxState';

/**
 * Fires the caller's callbacks once per phase transition.
 *
 * Every on-chain action needs the same three reactions (refresh data on
 * success, clear the error on retry, tell the user they declined), so they live
 * here instead of being copy-pasted into each handler.
 */
export function useTxPhaseEffects(
  tx: TxController,
  handlers: {onSuccess?: () => void; onError?: () => void; onRejected?: () => void} = {},
) {
  const {onSuccess, onError, onRejected} = handlers;
  const last = useRef<TxPhase>('idle');

  useEffect(() => {
    const prev = last.current;
    if (prev === tx.phase) return;
    last.current = tx.phase;

    if (tx.phase === 'success') onSuccess?.();
    if (tx.phase === 'failed') onError?.();
    if (tx.phase === 'rejected') onRejected?.();
  }, [onSuccess, onError, onRejected, tx.phase]);
}

/**
 * One toast per transaction.
 *
 * The same toast id is reused, so the pending toast is replaced in place by the
 * success or error toast instead of stacking. Colours come from the existing
 * semantic tokens — never purple — so a failure cannot be mistaken for an action.
 */
export function useTxToasts(tx: TxController) {
  const {phase, hash} = tx;
  const last = useRef<TxPhase>('idle');

  useEffect(() => {
    if (phase === last.current) return;
    last.current = phase;

    if (phase === 'awaiting_signature') {
      toast('Signature requested', {id: 'tx', description: 'Confirm the transaction in your wallet.'});
    } else if (phase === 'pending' && hash) {
      toast.loading('Transaction sent', {
        id: 'tx',
        description: (
          <a
            href={getTxUrl(hash)}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            {shortenHex(hash, 8, 6)} on ChainScan
          </a>
        ),
      });
    } else if (phase === 'success') {
      toast.success('Transaction confirmed', {id: 'tx'});
    } else if (phase === 'failed') {
      toast.error('Transaction failed', {id: 'tx', description: readableError(tx.error)});
    } else if (phase === 'rejected') {
      toast.warning('Transaction rejected in wallet', {id: 'tx'});
    }
  }, [hash, phase, tx.error]);
}

/**
 * Reusable on-chain action button.
 *
 * All writes in the app go through this so the awaiting-signature / pending /
 * disabled behaviour is identical, and a double click can never broadcast twice.
 */
export function TxButton({
  tx,
  params,
  idleLabel,
  signingLabel = 'Confirm in wallet…',
  pendingLabel = 'Transaction pending…',
  successLabel = 'Completed',
  disabled = false,
  className = '',
  fullWidth = false,
  variant = 'primary',
  idleIcon,
  minHeight = '2.75rem',
}: {
  tx: TxController;
  /** Write calldata, or null while the action is not submittable. */
  params: TxParams | null;
  idleLabel: string;
  signingLabel?: string;
  pendingLabel?: string;
  successLabel?: string;
  disabled?: boolean;
  className?: string;
  fullWidth?: boolean;
  variant?: 'primary' | 'secondary' | 'success';
  idleIcon?: React.ReactNode;
  minHeight?: string;
}) {
  const {phase, send, isBusy} = tx;

  const label =
    phase === 'awaiting_signature'
      ? signingLabel
      : phase === 'pending'
        ? pendingLabel
        : phase === 'success'
          ? successLabel
          : idleLabel;

  const showSpinner = phase === 'awaiting_signature' || phase === 'pending';
  // Once the call has settled successfully the same action must not be
  // broadcast again: the request would revert on-chain and only burn gas.
  // Failed and rejected stay clickable so the user can retry.
  const settled = phase === 'success';

  const skin =
    variant === 'secondary'
      ? 'border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-fg)] hover:border-[var(--color-primary-1)] hover:bg-[var(--color-surface-hover)]'
      : variant === 'success'
        ? 'border-[var(--success)] bg-[var(--success)] text-[#000] hover:opacity-90'
        : 'border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-fg)] hover:border-[var(--color-primary-1)] hover:bg-[var(--color-primary-1)]';

  return (
    <button
      type="button"
      onClick={() => {
        if (!params) return;
        void send(params);
      }}
      disabled={disabled || isBusy || settled || !params}
      aria-busy={isBusy}
      className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-control)] border px-5 text-[0.875rem] font-semibold transition-colors disabled:cursor-not-allowed disabled:border-[var(--color-border)] disabled:bg-[var(--color-surface)] disabled:text-[var(--color-text-muted)] ${
        fullWidth ? 'w-full' : ''
      } ${skin} ${className}`}
      style={{minHeight}}
    >
      {showSpinner ? (
        <Loader2 size={16} className="spinner shrink-0" aria-hidden="true" />
      ) : idleIcon ? (
        <span aria-hidden="true" className="inline-flex shrink-0">
          {idleIcon}
        </span>
      ) : null}
      <span className="truncate">{label}</span>
      {phase === 'success' ? <CheckCircle2 size={16} className="shrink-0" aria-hidden="true" /> : null}
    </button>
  );
}

/**
 * Status panel shown beneath a form or card while a transaction is in flight or
 * has settled. Success and failure both expose the tx hash as a ChainScan link
 * with a copy button.
 */
export function TxStatusPanel({
  tx,
  successTitle = 'Transaction confirmed',
  successBody,
  errorTitle = 'Transaction failed',
  children,
  onRetry,
  className = '',
}: {
  tx: TxController;
  successTitle?: string;
  successBody?: React.ReactNode;
  errorTitle?: string;
  /** Extra success detail, e.g. amount, term and unlock date. */
  children?: React.ReactNode;
  onRetry?: () => void;
  className?: string;
}) {
  const {phase, hash, error} = tx;

  if (phase === 'idle') return null;

  if (phase === 'success') {
    return (
      <div
        role="status"
        className={`flex flex-col gap-3 rounded-[var(--radius-card)] border border-[var(--success-border)] bg-[var(--success-subtle)] p-5 ${className}`}
      >
        <div className="flex items-start gap-3">
          <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-success" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-[0.875rem] font-semibold text-[var(--color-fg)]">{successTitle}</p>
            {successBody ? (
              <div className="t-body-sm mt-1 text-[var(--color-text-secondary)]">{successBody}</div>
            ) : null}
            {children}
            {hash ? <TxHashRow hash={hash} /> : null}
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'failed') {
    return (
      <div
        role="alert"
        className={`flex flex-col gap-3 rounded-[var(--radius-card)] border border-[var(--error-border)] bg-[var(--error-subtle)] p-5 ${className}`}
      >
        <div className="flex items-start gap-3">
          <AlertTriangle size={20} className="mt-0.5 shrink-0 text-error" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-[0.875rem] font-semibold text-[var(--color-fg)]">{errorTitle}</p>
            <p className="t-body-sm mt-1 text-[var(--color-text-secondary)]">{readableError(error)}</p>
            {hash ? <TxHashRow hash={hash} /> : null}
            {onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                className="tap-target mt-3 inline-flex cursor-pointer items-center rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-4 text-[0.8125rem] font-medium text-[var(--color-fg)] transition-colors hover:bg-[var(--color-surface-hover)]"
              >
                Try Again
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'rejected') {
    return (
      <div
        role="status"
        className={`flex items-start gap-3 rounded-[var(--radius-card)] border border-[var(--warning-border)] bg-[var(--warning-subtle)] p-4 ${className}`}
      >
        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-warning" aria-hidden="true" />
        <p className="t-body-sm text-[var(--color-fg)]">
          Transaction rejected in wallet. Your input is unchanged — you can try again.
        </p>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-start gap-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 ${className}`}
    >
      <Loader2 size={18} className="spinner mt-0.5 shrink-0 text-[var(--color-primary-1)]" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="t-body-sm text-[var(--color-fg)]">
          {phase === 'awaiting_signature' ? 'Confirm in wallet…' : 'Transaction pending…'}
        </p>
        {hash ? <TxHashRow hash={hash} /> : null}
      </div>
    </div>
  );
}

function TxHashRow({hash}: {hash: string}) {
  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-2">
      <a
        href={getTxUrl(hash)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-6 items-center gap-1.5 break-anywhere font-mono text-[0.75rem] text-[var(--color-primary-1)] hover:underline"
      >
        <span className="truncate">{shortenHex(hash, 10, 8)}</span>
        <ExternalLink size={12} className="shrink-0" aria-hidden="true" />
      </a>
      <CopyButton value={hash} label="Copy transaction hash" />
    </div>
  );
}
