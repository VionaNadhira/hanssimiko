'use client';

import {useEffect, useMemo} from 'react';
import {ExternalLink} from 'lucide-react';

import {CopyButton} from '@/components/CopyButton';
import {Drawer} from '@/components/Drawer';
import {CardListSkeleton} from '@/components/Skeleton';
import {TxButton, TxStatusPanel, useTxPhaseEffects, useTxToasts} from '@/components/TxButton';
import {Status} from '@/components/ui';
import {getAddressUrl, getTxUrl} from '@/config/chain';
import {CONTRACT_ADDRESS, locker} from '@/config/contract';
import {useLedger, type LedgerRow} from '@/hooks/useLedger';
import type {Position} from '@/hooks/useVaultData';
import {formatDateTimeUtc, formatZeroG, formatZeroGFull, shortenHex} from '@/lib/format';
import {useTxController} from '@/lib/useTxState';
import {pad2, splitRemaining, useNowSeconds} from '@/lib/useNow';

/**
 * Detail view for a single vault.
 *
 * Everything shown here is chain state. The capital, the two timestamps and the
 * withdrawn flag come from `getLock`; the creation and withdrawal transactions
 * and the block numbers come from the same event log the History page reads, so
 * the two views can never disagree about which transaction opened a lock.
 *
 * Status is derived from the live clock rather than taken from a cached
 * classification, which is what lets a lock flip to UNLOCKED while the panel
 * sits open.
 */
export function VaultDetailPanel({
  lockId,
  positions,
  isLoadingPositions,
  onClose,
  onSettled,
}: {
  lockId: bigint | null;
  positions: readonly Position[];
  isLoadingPositions: boolean;
  onClose: () => void;
  onSettled: () => void;
}) {
  const now = useNowSeconds(1_000);
  const ledger = useLedger(lockId !== null);

  const rows = useMemo(() => {
    if (lockId === null) return [];
    return (ledger.data ?? []).filter((row) => row.lockId === lockId);
  }, [ledger.data, lockId]);

  const created = rows.find((row) => row.kind === 'LockCreated') ?? null;
  const withdrawn = rows.find((row) => row.kind === 'LockWithdrawn') ?? null;

  // The panel owns the withdrawal so there is one transaction in flight at a
  // time, no matter how many rows are rendered in the list behind it.
  const tx = useTxController();
  useTxToasts(tx);
  useTxPhaseEffects(tx, {onSuccess: onSettled});

  const withdrawParams = useMemo(
    () =>
      lockId === null
        ? null
        : {address: locker.address, abi: locker.abi, functionName: 'withdraw', args: [lockId]},
    [lockId],
  );

  return (
    <Drawer
      open={lockId !== null}
      onClose={onClose}
      title={lockId === null ? 'Vault' : `Vault #${lockId.toString()}`}
      labelledBy="vault-detail-title"
    >
      <VaultDetailBody
        lockId={lockId}
        positions={positions}
        isLoadingPositions={isLoadingPositions}
        now={now}
        created={created}
        withdrawn={withdrawn}
        ledgerLoading={ledger.isLoading}
        ledgerError={ledger.isError}
        onRetryLedger={() => void ledger.refetch()}
        onNotFound={onClose}
        tx={tx}
        withdrawParams={withdrawParams}
      />
    </Drawer>
  );
}

function VaultDetailBody({
  lockId,
  positions,
  isLoadingPositions,
  now,
  created,
  withdrawn,
  ledgerLoading,
  ledgerError,
  onRetryLedger,
  onNotFound,
  tx,
  withdrawParams,
}: {
  lockId: bigint | null;
  positions: readonly Position[];
  isLoadingPositions: boolean;
  now: bigint;
  created: LedgerRow | null;
  withdrawn: LedgerRow | null;
  ledgerLoading: boolean;
  ledgerError: boolean;
  onRetryLedger: () => void;
  onNotFound: () => void;
  tx: ReturnType<typeof useTxController>;
  withdrawParams: {address: `0x${string}`; abi: typeof locker.abi; functionName: string; args: readonly bigint[]} | null;
}) {
  if (lockId === null) return null;

  // The id can only be judged against a fully loaded list. While that list is
  // still in flight an id is neither valid nor invalid, so it would be wrong to
  // declare it missing.
  const position = positions.find((candidate) => candidate.lockId === lockId) ?? null;

  if (!position) {
    if (isLoadingPositions) {
      return (
        <div className="space-y-4">
          <CardListSkeleton count={2} />
        </div>
      );
    }
    return <VaultNotFound onClose={onNotFound} />;
  }

  // Live classification. `withdrawn` is the only terminal flag; everything else
  // is a comparison against the clock, so it changes on its own at maturity.
  const state: 'LOCKED' | 'UNLOCKED' | 'WITHDRAWN' = position.withdrawn
    ? 'WITHDRAWN'
    : position.unlockTime <= now
      ? 'UNLOCKED'
      : 'LOCKED';

  const remaining = splitRemaining(position.unlockTime - now);
  const tone = state === 'WITHDRAWN' ? 'withdrawn' : state === 'UNLOCKED' ? 'ready' : 'active';

  // Share of the term already served, clamped so a clock skew cannot push the
  // bar past its track.
  const span = position.unlockTime - position.startTime;
  const elapsed = now > position.startTime ? now - position.startTime : 0n;
  const progress = span > 0n ? Math.min(100, Math.max(0, (Number(elapsed) / Number(span)) * 100)) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Status tone={tone}>{state}</Status>
        {state === 'UNLOCKED' ? <ReadyHint /> : null}
      </div>

      {/* Capital */}
      <section>
        <SectionLabel>Locked capital</SectionLabel>
        <p
          title={formatZeroGFull(position.amount)}
          className="t-numeric mt-1.5 flex flex-wrap items-baseline gap-1.5 text-[var(--color-fg)]"
        >
          <span className="break-anywhere">{formatZeroG(position.amount, {maxDecimals: 4})}</span>
          <span className="text-[0.8125rem] font-normal text-[var(--color-text-muted)]">0G</span>
        </p>
      </section>

      {/* Elapsed time */}
      <section>
        <SectionLabel>Time elapsed</SectionLabel>
        <div
          role="progressbar"
          aria-valuenow={Math.round(progress)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Share of the lock term served"
          className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-border)]"
        >
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{width: `${progress}%`, background: 'var(--color-primary-1)'}}
          />
        </div>
        <p className="t-mono-xs mt-2 text-[var(--color-text-muted)]">{progress.toFixed(1)}% of term served</p>
      </section>

      {/* Countdown. Resolves without a reload: `now` ticks every second and the
          state above is recomputed from it. */}
      <section>
        <SectionLabel>{state === 'LOCKED' ? 'Unlocks in' : state === 'UNLOCKED' ? 'Unlocked' : 'Settled'}</SectionLabel>
        {state === 'LOCKED' ? (
          <div className="mt-2 grid grid-cols-4 gap-2">
            <CountdownUnit value={remaining.days} unit="days" />
            <CountdownUnit value={remaining.hours} unit="hours" />
            <CountdownUnit value={remaining.minutes} unit="minutes" />
            <CountdownUnit value={remaining.seconds} unit="seconds" live />
          </div>
        ) : (
          <p className="t-numeric mt-1.5 text-[var(--color-fg)]">
            {state === 'UNLOCKED' ? 'Ready to withdraw' : 'Withdrawn'}
          </p>
        )}
      </section>

      {/* Detail rows */}
      <section className="space-y-3 border-t border-[var(--color-border)] pt-5">
        <SectionLabel>Details</SectionLabel>
        <dl className="space-y-3.5">
          <DetailRow label="Duration" value={`${position.days} Days`} />

          <DetailRow
            label="Start date"
            value={formatDateTimeUtc(created?.timestamp ?? position.startTime)}
            title="Timestamp of the block that created this lock, in UTC."
          />

          <DetailRow
            label="Unlock date"
            value={formatDateTimeUtc(position.unlockTime)}
            title="Timestamp of the block that created this lock, in UTC."
          />

          <DetailRow
            label="Owner"
            value={
              position.owner ? (
                <MonoValue
                  text={position.owner}
                  href={getAddressUrl(position.owner)}
                  copyValue={position.owner}
                  copyLabel="Copy owner address"
                />
              ) : (
                '—'
              )
            }
          />

          <DetailRow
            label="Vault contract"
            value={
              <MonoValue
                text={CONTRACT_ADDRESS}
                href={getAddressUrl(CONTRACT_ADDRESS)}
                copyValue={CONTRACT_ADDRESS}
                copyLabel="Copy vault contract address"
              />
            }
          />

          {created ? (
            <DetailRow
              label="Creation transaction"
              value={
                <MonoValue
                  text={created.transactionHash}
                  href={getTxUrl(created.transactionHash)}
                  copyValue={created.transactionHash}
                  copyLabel="Copy creation transaction hash"
                />
              }
            />
          ) : null}

          <DetailRow
            label="Block number"
            value={created ? created.blockNumber.toString() : '—'}
            mono
          />

          {withdrawn ? (
            <DetailRow
              label="Withdraw transaction"
              value={
                <MonoValue
                  text={withdrawn.transactionHash}
                  href={getTxUrl(withdrawn.transactionHash)}
                  copyValue={withdrawn.transactionHash}
                  copyLabel="Copy withdrawal transaction hash"
                />
              }
            />
          ) : null}
        </dl>
      </section>

      {/* On-chain lookup, and its failure mode. */}
      {ledgerError ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] border border-[var(--error-border)] bg-[var(--error-subtle)] p-4">
          <p className="min-w-0 text-[0.8125rem] text-[var(--color-text-secondary)]">
            Transaction history for this vault could not be read from the node.
          </p>
          <button
            type="button"
            onClick={onRetryLedger}
            className="tap-target cursor-pointer rounded-[var(--radius-control)] border border-[var(--color-border-strong)] px-3 py-2 text-[0.8125rem] text-[var(--color-fg)] hover:bg-[var(--color-surface-hover)]"
          >
            Retry
          </button>
        </div>
      ) : ledgerLoading ? (
        <p className="t-mono-xs text-[var(--color-text-muted)]">Loading on-chain history…</p>
      ) : null}

      {/* Action. One primary control, and it exists in exactly one of three
          states, driven by the same classification as the badge. */}
      <section className="border-t border-[var(--color-border)] pt-5">
        {state === 'LOCKED' ? (
          <>
            <TxButton
              tx={tx}
              params={null}
              idleLabel={`Unlocks in ${formatRemainingPhrase(remaining)}`}
              disabled
              fullWidth
              minHeight="2.75rem"
            />
            <p className="mt-2 text-center text-[0.75rem] text-[var(--color-text-muted)]">
              Early withdrawal is not possible.
            </p>
          </>
        ) : state === 'UNLOCKED' ? (
          <TxButton
            tx={tx}
            params={withdrawParams}
            idleLabel="Withdraw"
            successLabel="Withdrawn"
            variant="success"
            fullWidth
            minHeight="2.75rem"
          />
        ) : (
          <p className="text-center text-[0.8125rem] text-[var(--color-text-secondary)]">
            Withdrawn{withdrawn ? ` in block ${withdrawn.blockNumber.toString()}` : ''}. This vault is closed.
          </p>
        )}

        {tx.phase !== 'idle' ? <TxStatusPanel tx={tx} className="mt-3" /> : null}
      </section>
    </div>
  );
}

function VaultNotFound({onClose}: {onClose: () => void}) {
  // The panel is being dismissed, so it is not worth leaving the message on
  // screen indefinitely.
  useEffect(() => {
    const id = window.setTimeout(onClose, 2_500);
    return () => window.clearTimeout(id);
  }, [onClose]);

  return (
    <div className="py-8 text-center">
      <p className="t-headline-md text-[var(--color-fg)]">Vault not found</p>
      <p className="t-body-sm mt-2 text-[var(--color-text-secondary)]">
        No vault with that id belongs to the connected address.
      </p>
      <button
        type="button"
        onClick={onClose}
        data-autofocus
        className="tap-target mt-5 cursor-pointer rounded-[var(--radius-control)] border border-[var(--color-border)] px-4 py-2 text-[0.8125rem] text-[var(--color-fg)] hover:bg-[var(--color-surface-hover)]"
      >
        Close
      </button>
    </div>
  );
}

function SectionLabel({children}: {children: React.ReactNode}) {
  return <p className="t-label text-[var(--color-text-muted)]">{children}</p>;
}

function ReadyHint() {
  return <span className="text-[0.75rem] text-success">Ready to withdraw</span>;
}

function CountdownUnit({value, unit, live = false}: {value: number; unit: string; live?: boolean}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-2.5">
      <span
        className="t-numeric text-[1.25rem] text-[var(--color-fg)]"
        // Announcing the seconds every tick would flood a screen reader, so the
        // live region covers only the coarse units.
        aria-live={live ? 'off' : 'polite'}
        aria-atomic="true"
      >
        {pad2(value)}
      </span>
      <span className="text-[0.6875rem] uppercase tracking-wider text-[var(--color-text-muted)]">{unit}</span>
    </div>
  );
}

function DetailRow({
  label,
  value,
  mono = false,
  title,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  title?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <dt className="shrink-0 text-[0.75rem] text-[var(--color-text-muted)]" title={title}>
        {label}
      </dt>
      <dd
        className={`min-w-0 break-anywhere text-[0.8125rem] text-[var(--color-fg)] ${
          mono ? 't-mono-xs' : ''
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

/**
 * An address or a hash.
 *
 * Always monospaced, always wrapped with `overflow-wrap: anywhere` — a 66-character
 * hash has no break opportunities, so without this it pushes the drawer wider than
 * the viewport. The full value is available on hover, by copy, and as a link.
 */
function MonoValue({
  text,
  href,
  copyValue,
  copyLabel,
}: {
  text: string;
  href: string;
  copyValue: string;
  copyLabel: string;
}) {
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-1.5">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        title={text}
        className="t-mono-xs inline-flex min-w-0 items-center gap-1 text-[var(--color-primary-1)] hover:underline"
      >
        <span className="break-anywhere">{shortenHex(text, 8, 6)}</span>
        <ExternalLink size={11} className="shrink-0" aria-hidden="true" />
        <span className="sr-only-focusable">View on ChainScan</span>
      </a>
      <CopyButton value={copyValue} label={copyLabel} />
    </span>
  );
}

function formatRemainingPhrase(remaining: {days: number; hours: number; minutes: number}): string {
  if (remaining.days > 0) return `${remaining.days}d ${pad2(remaining.hours)}h`;
  if (remaining.hours > 0) return `${remaining.hours}h ${pad2(remaining.minutes)}m`;
  return `${remaining.minutes}m`;
}
