'use client';

import {CardListSkeleton, TableRowSkeleton} from '@/components/Skeleton';
import {Panel, Status} from '@/components/ui';
import {SECONDS_PER_DAY} from '@/config/terms';
import type {Position} from '@/hooks/useVaultData';
import {formatDate, formatZeroG} from '@/lib/format';

/**
 * Schedule of the locks that are still running.
 *
 * Reads the same `useVaultData` result as My Locks, so the dashboard can never
 * disagree with the list it links to. Below `md` the table becomes a stack of
 * cards; no horizontal scrolling is involved at any width.
 */
export function ActiveLocksPanel({
  positions,
  isLoading,
  isFetching,
  now,
}: {
  positions: Position[];
  isLoading: boolean;
  isFetching: boolean;
  now: bigint;
}) {
  const active = positions
    .filter((p) => p.status === 'active' || p.status === 'ready')
    .sort((a, b) => (a.unlockTime < b.unlockTime ? -1 : 1));

  const showSkeleton = isLoading && active.length === 0;

  return (
    <Panel
      title="Active Locks"
      description={active.length > 0 ? `${active.length} running` : undefined}
      bodyClassName="p-0"
    >
      {showSkeleton ? (
        <>
          {/* Mobile stack */}
          <div className="p-[var(--space-section)] md:hidden">
            <CardListSkeleton count={2} />
          </div>
          {/* Table */}
          <div className="hidden md:block">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <Th>Amount</Th>
                  <Th>Term</Th>
                  <Th>Unlock Date</Th>
                  <Th>Remaining</Th>
                  <Th className="w-[22%]">Progress</Th>
                </tr>
              </thead>
              <tbody>
                <TableRowSkeleton columns={5} />
                <TableRowSkeleton columns={5} />
              </tbody>
            </table>
          </div>
        </>
      ) : active.length === 0 ? (
        <p className="p-[var(--space-section)] t-body-sm text-[var(--color-text-muted)]">
          No active locks. Create one to start a timelock.
        </p>
      ) : (
        <div className={isFetching ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
          {/* Mobile: one card per lock */}
          <ul className="flex flex-col gap-3 p-[var(--space-section)] md:hidden">
            {active.map((p) => (
              <li
                key={p.lockId.toString()}
                className="flex flex-col gap-2.5 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="t-numeric min-w-0 break-anywhere text-[var(--color-fg)]">
                    {formatZeroG(p.amount, {maxDecimals: 4})}{' '}
                    <span className="text-[0.75rem] font-normal text-[var(--color-text-muted)]">0G</span>
                  </span>
                  <Status tone={p.status === 'ready' ? 'ready' : 'warning'}>
                    {p.status === 'ready' ? 'UNLOCKED' : 'LOCKED'}
                  </Status>
                </div>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                  <Field label="Term" value={`${p.days} days`} />
                  <Field label="Unlock" value={formatDate(p.unlockTime)} />
                  <Field
                    label="Remaining"
                    value={p.status === 'ready' ? 'Ready' : `${p.unlockTime - now} s`}
                    mono
                  />
                  <Field label="Vault" value={`#${p.lockId.toString()}`} />
                </dl>
                <ProgressBar position={p} now={now} />
              </li>
            ))}
          </ul>

          {/* Desktop: table */}
          <div className="hidden md:block">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <Th>Amount</Th>
                  <Th>Term</Th>
                  <Th>Unlock Date</Th>
                  <Th>Remaining</Th>
                  <Th className="w-[22%]">Progress</Th>
                </tr>
              </thead>
              <tbody>
                {active.map((p) => (
                  <tr
                    key={p.lockId.toString()}
                    className="border-b border-[var(--color-border)] last:border-b-0"
                  >
                    <Td>
                      <span className="t-mono-sm text-[var(--color-fg)]">
                        {formatZeroG(p.amount, {maxDecimals: 4})}{' '}
                        <span className="text-[0.75rem] text-[var(--color-text-muted)]">0G</span>
                      </span>
                    </Td>
                    <Td mono>{p.days} days</Td>
                    <Td mono>{formatDate(p.unlockTime)}</Td>
                    <Td mono className={p.status === 'ready' ? 'text-success' : undefined}>
                      {p.status === 'ready' ? 'Ready' : formatRemaining(p.unlockTime - now)}
                    </Td>
                    <Td>
                      <ProgressBar position={p} now={now} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Panel>
  );
}

function ProgressBar({position, now}: {position: Position; now: bigint}) {
  const total = BigInt(Math.max(1, position.days) * SECONDS_PER_DAY);
  const elapsed = position.unlockTime > now ? total - (position.unlockTime - now) : total;
  const pct = Math.min(100, Math.max(0, Number((elapsed * 10000n) / total) / 100));

  return (
    <div
      className="h-1 w-full overflow-hidden rounded-full bg-[var(--color-border)]"
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Vault #${position.lockId.toString()} progress`}
    >
      <div className="h-full rounded-full bg-[var(--color-primary-1)]" style={{width: `${pct}%`}} />
    </div>
  );
}

function Th({children, className = ''}: {children: React.ReactNode; className?: string}) {
  return (
    <th scope="col" className={`t-label px-5 py-2.5 text-[var(--color-text-muted)] ${className}`}>
      {children}
    </th>
  );
}

function Td({
  children,
  mono = false,
  className = '',
}: {
  children: React.ReactNode;
  mono?: boolean;
  className?: string;
}) {
  return (
    <td className={`px-5 py-3 text-[0.8125rem] ${mono ? 't-mono-xs' : ''} ${className || 'text-[var(--color-text-secondary)]'}`}>
      {children}
    </td>
  );
}

function Field({label, value, mono = false}: {label: string; value: string; mono?: boolean}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-[0.75rem] text-[var(--color-text-muted)]">{label}</dt>
      <dd
        className={`truncate text-[0.8125rem] text-[var(--color-fg)] ${mono ? 't-mono-xs' : ''}`}
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}

/** Days/hours countdown, e.g. `42d 06h`. */
function formatRemaining(seconds: bigint): string {
  if (seconds <= 0n) return 'Ready';
  const total = Number(seconds);
  const days = Math.floor(total / 86_400);
  const hours = Math.floor((total % 86_400) / 3_600);
  return days > 0 ? `${days}d ${String(hours).padStart(2, '0')}h` : `${hours}h`;
}
