'use client';

import {useMemo, useState} from 'react';
import {ChevronDown, ExternalLink} from 'lucide-react';
import {useReadContract} from 'wagmi';

import {ActiveLocksPanel} from '@/components/OverviewActiveLocks';
import {StatCardSkeleton} from '@/components/Skeleton';
import {Button, Notice, Panel} from '@/components/ui';
import {useWorkspace} from '@/components/WorkspaceContext';
import {getAddressUrl} from '@/config/chain';
import {locker} from '@/config/contract';
import {useVaultData} from '@/hooks/useVaultData';
import {formatDate, formatDuration, formatZeroG} from '@/lib/format';

export function OverviewView() {
  const {setTab} = useWorkspace();

  const {positions, isLoading, isFetching, now} = useVaultData();

  const {data: totalLocked} = useReadContract({...locker, functionName: 'getTotalLocked'});

  const activeCount = positions.filter((p) => p.status === 'active').length;
  const totalPositions = positions.length;

  /** The soonest maturity among locks that have not been settled. */
  const nextUnlock = useMemo(() => {
    const upcoming = positions
      .filter((p) => p.status === 'active' || p.status === 'ready')
      .sort((a, b) => (a.unlockTime < b.unlockTime ? -1 : 1));
    return upcoming[0] ?? null;
  }, [positions]);

  return (
    <div className="stack">
      {/* Statistic row. */}
      <div className="grid grid-cols-1 gap-[var(--space-section)] sm:grid-cols-2 lg:grid-cols-4">
        {isLoading && positions.length === 0 && totalLocked === undefined ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard
              label="Total Locked"
              value={formatZeroG(totalLocked ?? 0n, {maxDecimals: 4})}
              unit="0G"
              footerLabel="Solvency"
              footerValue="100%"
            />
            <StatCard
              label="Active Locks"
              value={isLoading ? '—' : String(activeCount)}
              unit=""
              footerLabel="Your position"
              footerValue={activeCount > 0 ? 'Protected' : 'None yet'}
            />
            <StatCard
              label="Next Unlock"
              value={nextUnlock ? formatDate(nextUnlock.unlockTime) : '—'}
              unit=""
              footerLabel="Remaining"
              footerValue={
                nextUnlock
                  ? nextUnlock.status === 'ready'
                    ? 'Ready now'
                    : formatDuration(nextUnlock.unlockTime - now)
                  : 'No schedule'
              }
            />
            <StatCard
              label="Total Positions"
              value={isLoading ? '—' : String(totalPositions)}
              unit=""
              footerLabel="Including settled"
              footerValue={totalPositions > 0 ? 'On-chain' : 'Empty'}
            />
          </>
        )}
      </div>

      {/* Active locks: the schedule of what is currently held. */}
      <ActiveLocksPanel positions={positions} isLoading={isLoading} isFetching={isFetching} now={now} />

      {/* Security notice. The left border carries the accent; an icon here would
          only repeat what the border already says. */}
      <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] border-l-[3px] border-l-[var(--color-primary-1)] bg-[var(--color-surface)] p-[var(--space-section)]">
        <p className="t-body-sm min-w-0 text-[var(--color-text-secondary)]">
          <span className="font-semibold text-[var(--color-fg)]">Institutional Security Protocol:</span> native 0G is held
          custody-free by the <span className="font-mono text-[var(--color-primary-3)]">ZeroGLocker</span> contract, with no
          yield, no APR and no administrative backdoor. Unlocking is dictated by on-chain timestamps.
        </p>
      </div>

      {/* Information + actions. On a phone the Operation Center comes first:
          actions are what a returning user came for, and the protocol text is
          reference material. On desktop they sit side by side, protocol left. */}
      <div className="grid grid-cols-1 gap-[var(--space-section)] lg:grid-cols-2">
        <div className="order-2 lg:order-1">
          <ProtocolPanel totalLocked={totalLocked} />
        </div>

        <div className="order-1 lg:order-2">
          <Panel title="Operation Center" description="Deploy a vault or review existing positions." className="flex h-full flex-col">
            <div className="flex flex-col gap-4">
              <Notice tone="info" title="No Approval Required">
                This vault holds native 0G. You never call <span className="font-mono">approve</span>; the deposit goes out
                with the lock transaction itself.
              </Notice>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Button variant="primary" size="lg" className="h-20" onClick={() => setTab('create-lock')}>
                  DEPLOY VAULT
                </Button>
                <Button variant="secondary" size="lg" className="h-20" onClick={() => setTab('my-locks')}>
                  MY POSITIONS
                </Button>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  unit,
  footerLabel,
  footerValue,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  unit: string;
  footerLabel: string;
  footerValue: string;
  tone?: 'neutral' | 'success';
}) {
  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-section)]">
      <span className="t-label min-w-0 truncate text-[var(--color-text-muted)]">{label}</span>
      <div className="t-numeric min-w-0 text-[var(--color-fg)]">
        <span className="break-anywhere">{value}</span>
        {unit ? <span className="ml-1 text-[0.8125rem] font-normal text-[var(--color-text-muted)]">{unit}</span> : null}
      </div>
      <div className="h-px w-full bg-[var(--color-border)]" />
      <div className="flex h-4 items-center justify-between gap-2">
        <span className="truncate text-[0.75rem] text-[var(--color-text-muted)]">{footerLabel}</span>
        <span
          className={`shrink-0 truncate text-[0.75rem] ${
            tone === 'success' ? 'text-success' : 'text-[var(--color-text-secondary)]'
          }`}
        >
          {footerValue}
        </span>
      </div>
    </div>
  );
}

function ProtocolPanel({totalLocked}: {totalLocked: bigint | undefined}) {
  const [open, setOpen] = useState(false);

  return (
    <Panel
      title="Protocol Information"
      description="Immutable system parameters and audit status."
      actions={
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="tap-target inline-flex cursor-pointer items-center gap-1.5 rounded-[var(--radius-control)] border border-[var(--color-border)] px-3 text-[0.75rem] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-fg)]"
        >
          {open ? 'Hide' : 'Show'}
          <ChevronDown
            size={14}
            className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>
      }
    >
      {open ? (
        <div className="t-body-sm space-y-3 text-[var(--color-text-secondary)]">
          <p>
            Hanssimiko Bunker is open-source infrastructure for the 0G ecosystem. There is no operator and no upgrade path:
            the deployed bytecode is the whole system.
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Fixed terms: 15, 30, 60, 90, 180 and 365 days</li>
            <li>Verified bytecode, no sweep or admin functions</li>
            <li>Native 0G only, no ERC-20 approvals</li>
          </ul>
          {totalLocked !== undefined ? (
            <p className="break-anywhere font-mono text-[0.75rem] text-[var(--color-text-muted)]">
              Contract balance: {formatZeroG(totalLocked, {maxDecimals: 4})} 0G
            </p>
          ) : null}
          <a
            href={getAddressUrl(locker.address)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[0.75rem] text-[var(--color-primary-1)] hover:underline"
          >
            Inspect on ChainScan
            <ExternalLink size={12} aria-hidden="true" />
          </a>
        </div>
      ) : (
        <p className="t-body-sm text-[var(--color-text-muted)]">
          Immutable system parameters, verified bytecode and fixed terms. Expand to review.
        </p>
      )}
    </Panel>
  );
}
