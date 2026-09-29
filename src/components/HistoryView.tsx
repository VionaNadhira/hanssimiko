'use client';

import {useMemo} from 'react';
import {Download, ExternalLink} from 'lucide-react';
import {useAccount} from 'wagmi';

import {CopyButton} from '@/components/CopyButton';
import {CardListSkeleton, TableRowSkeleton} from '@/components/Skeleton';
import {Button, Notice, Panel, Status} from '@/components/ui';
import {useWorkspace} from '@/components/WorkspaceContext';
import {ZERO_G_CHAIN_NAME, getTxUrl} from '@/config/chain';
import {downloadCsv, ledgerFileName, ledgerToCsv} from '@/lib/csv';
import {useLedger, type LedgerRow} from '@/hooks/useLedger';
import {formatDate, formatZeroG, formatZeroGFull, shortenHex} from '@/lib/format';

export function HistoryView() {
  const {setTab} = useWorkspace();
  const {address} = useAccount();
  // The ledger is a React Query, so the invalidation that runs after a confirmed
  // lock refetches it too and a new row appears without a reload.
  const {data, isLoading, isFetching, error, refetch} = useLedger(true);

  const rows = useMemo(() => data ?? [], [data]);

  function exportCsv() {
    downloadCsv(ledgerFileName(address), ledgerToCsv(rows));
  }

  // Write the selection into the URL before switching tabs, so My Locks picks the
  // vault up on mount and the deep link survives a reload or a share.
  function openVault(lockId: bigint) {
    const url = new URL(window.location.href);
    url.searchParams.set('vault', lockId.toString());
    window.history.pushState(window.history.state, '', `${url.pathname}${url.search}`);
    setTab('my-locks');
  }

  const showSkeleton = isLoading && rows.length === 0;

  return (
    <div className="stack">
      <header className="flex flex-col gap-4 border-b border-[var(--color-border)] pb-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h2 className="t-headline-md text-[var(--color-fg)]">Verifiable Audit Ledger</h2>
          <p className="t-mono-xs mt-1 text-[var(--color-text-muted)]">
            Event log emitted by the locker contract on {ZERO_G_CHAIN_NAME}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          icon={<Download size={14} />}
          onClick={exportCsv}
          disabled={rows.length === 0}
          className="shrink-0"
        >
          EXPORT CSV
        </Button>
      </header>

      <Panel bodyClassName="p-0">
        {error ? (
          <div className="p-[var(--space-section)]">
            <Notice
              tone="error"
              title="Could not read the event log"
              action={
                <Button variant="outline" size="sm" onClick={() => void refetch()}>
                  Retry
                </Button>
              }
            >
              The 0G node did not return logs for this range. This is usually a rate limit; retrying is safe.
            </Notice>
          </div>
        ) : showSkeleton ? (
          <>
            <div className="p-[var(--space-section)] md:hidden">
              <CardListSkeleton count={3} />
            </div>
            <div className="hidden md:block">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-[var(--color-border)]">
                    <Th>Event Type</Th>
                    <Th>Date</Th>
                    <Th>Vault Ref</Th>
                    <Th className="text-right">Amount (0G)</Th>
                    <Th>Unlock Date</Th>
                    <Th>TX HASH</Th>
                  </tr>
                </thead>
                <tbody>
                  <TableRowSkeleton columns={6} />
                  <TableRowSkeleton columns={6} />
                  <TableRowSkeleton columns={6} />
                </tbody>
              </table>
            </div>
          </>
        ) : rows.length === 0 ? (
          <div className="p-[var(--space-section)]">
            <p className="t-headline-md text-[var(--color-fg)]">No events yet</p>
            <p className="t-body-sm mt-1.5 text-[var(--color-text-secondary)]">
              This address has never opened or settled a lock.
            </p>
            <Button variant="primary" size="md" className="mt-4" onClick={() => setTab('create-lock')}>
              Create your first lock
            </Button>
          </div>
        ) : (
          <div className={isFetching ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
            {/* Phones: one card per event. */}
            <ul className="flex flex-col gap-3 p-[var(--space-section)] md:hidden">
              {rows.map((row) => (
                <li
                  key={row.key}
                  className="flex flex-col gap-2.5 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span title={formatZeroGFull(row.amount)} className="t-numeric min-w-0 break-anywhere">
                      {formatZeroG(row.amount, {maxDecimals: 4})}{' '}
                      <span className="text-[0.75rem] font-normal text-[var(--color-text-muted)]">0G</span>
                    </span>
                    <EventBadge kind={row.kind} />
                  </div>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <dt className="text-[0.75rem] text-[var(--color-text-muted)]">Vault</dt>
                      <dd className="min-w-0">
                        <button
                          type="button"
                          onClick={() => setTab('my-locks')}
                          title={`Open vault #${row.lockId.toString()} in My Locks`}
                          className="tap-target cursor-pointer break-anywhere text-left font-mono text-[0.8125rem] text-[var(--color-fg)] hover:text-[var(--color-primary-3)] hover:underline"
                        >
                          #{row.lockId.toString()}
                        </button>
                      </dd>
                    </div>
                    <Cell label="Date" value={row.timestamp === null ? '—' : formatDate(row.timestamp)} />
                    <Cell label="Block" value={row.blockNumber.toString()} />
                    <Cell label="Unlock" value={formatDate(row.unlockTime)} />
                  </dl>
                  <TxHashCell hash={row.transactionHash} />
                </li>
              ))}
            </ul>

            {/* md and up: table. */}
            <div className="hidden md:block">
              <table className="w-full border-collapse text-left">
                <caption className="sr-only-focusable">Locker event log</caption>
                <thead>
                  <tr className="border-b border-[var(--color-border)]">
                    <Th>Event Type</Th>
                    <Th>Date</Th>
                    <Th>Vault Ref</Th>
                    <Th className="text-right">Amount (0G)</Th>
                    <Th>Unlock Date</Th>
                    <Th>TX HASH</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.key} className="border-b border-[var(--color-border)] last:border-b-0">
                      <td className="px-5 py-3 align-middle">
                        <EventBadge kind={row.kind} />
                      </td>
                      <td className="px-5 py-3 align-middle t-mono-xs text-[var(--color-text-secondary)]">
                        {row.timestamp === null ? '—' : formatDate(row.timestamp)}
                      </td>
                      <td className="px-5 py-3 align-middle t-mono-sm text-[var(--color-fg)]">
                        <button
                          type="button"
                          onClick={() => openVault(row.lockId)}
                          title={`Open vault #${row.lockId.toString()} in My Locks`}
                          className="tap-target cursor-pointer hover:text-[var(--color-primary-3)] hover:underline"
                        >
                          Vault #{row.lockId.toString()}
                        </button>
                      </td>
                      <td className="px-5 py-3 text-right align-middle t-mono-sm text-[var(--color-fg)]">
                        <span title={formatZeroGFull(row.amount)}>
                          {formatZeroG(row.amount, {maxDecimals: 4})}
                        </span>
                      </td>
                      <td className="px-5 py-3 align-middle t-mono-xs text-[var(--color-text-secondary)]">
                        {formatDate(row.unlockTime)}
                      </td>
                      <td className="px-5 py-3 align-middle">
                        <TxHashCell hash={row.transactionHash} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}

/**
 * The verifiable part of the ledger: a short hash that links to the exact
 * transaction, plus a copy control. The full hash lives in the tooltip and in
 * the href, so the visible cell stays narrow at any viewport.
 */
function TxHashCell({hash}: {hash: string}) {
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <a
        href={getTxUrl(hash)}
        target="_blank"
        rel="noopener noreferrer"
        title={hash}
        className="inline-flex min-h-11 min-w-0 items-center gap-1.5 break-anywhere font-mono text-[0.75rem] text-[var(--color-primary-1)] hover:underline md:min-h-6"
      >
        <span className="truncate">{shortenHex(hash, 6, 4)}</span>
        <ExternalLink size={11} className="shrink-0" aria-hidden="true" />
      </a>
      <CopyButton value={hash} label="Copy transaction hash" className="shrink-0" />
    </div>
  );
}

/** Badge follows the event: LOCKED is amber, a settled lock is green. */
function EventBadge({kind}: {kind: LedgerRow['kind']}) {
  return kind === 'LockCreated' ? <Status tone="warning">LOCKED</Status> : <Status tone="ready">WITHDRAWN</Status>;
}

function Cell({label, value}: {label: string; value: string}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-[0.75rem] text-[var(--color-text-muted)]">{label}</dt>
      <dd className="truncate t-mono-xs text-[var(--color-fg)]">{value}</dd>
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
