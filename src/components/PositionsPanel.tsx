'use client';

import {useMemo, useState} from 'react';
import {ChevronRight} from 'lucide-react';
import {useAccount} from 'wagmi';

import {CopyButton} from '@/components/CopyButton';
import {CardListSkeleton} from '@/components/Skeleton';
import {TxButton, useTxPhaseEffects, useTxToasts} from '@/components/TxButton';
import {VaultDetailPanel} from '@/components/VaultDetailPanel';
import {Button, Notice, Panel, Status} from '@/components/ui';
import {useWorkspace} from '@/components/WorkspaceContext';
import {getAddressUrl} from '@/config/chain';
import {CONTRACT_ADDRESS, IS_LOCKER_CONFIGURED, locker} from '@/config/contract';
import {useCorrectNetwork, useVaultData, type Position} from '@/hooks/useVaultData';
import {useRefreshChainData} from '@/hooks/useRefreshChainData';
import {formatDate, formatDuration, formatZeroG, formatZeroGFull, shortenHex} from '@/lib/format';
import {useNowSeconds} from '@/lib/useNow';
import {useTxController} from '@/lib/useTxState';
import {useVaultSelection} from '@/lib/useVaultSelection';

type Filter = 'all' | 'locked' | 'unlocked' | 'withdrawn';

const FILTERS: readonly {id: Filter; label: string}[] = [
  {id: 'all', label: 'All'},
  {id: 'locked', label: 'Locked'},
  {id: 'unlocked', label: 'Unlocked'},
  {id: 'withdrawn', label: 'Withdrawn'},
];

export function PositionsPanel() {
  const {address} = useAccount();
  const {setTab} = useWorkspace();
  const onCorrectNetwork = useCorrectNetwork();
  const {positions, isLoading, isFetching, error, isEnabled} = useVaultData();
  const refresh = useRefreshChainData();
  const [filter, setFilter] = useState<Filter>('all');
  const {selectedId, select, close} = useVaultSelection();

  // One shared minute clock for every card, rather than an interval per card.
  const now = useNowSeconds(60_000);

  const counts = useMemo(
    () => ({
      all: positions.length,
      locked: positions.filter((p) => p.status === 'active').length,
      unlocked: positions.filter((p) => p.status === 'ready').length,
      withdrawn: positions.filter((p) => p.status === 'settled').length,
    }),
    [positions],
  );

  const filtered = useMemo(() => {
    if (filter === 'all') return positions;
    if (filter === 'locked') return positions.filter((p) => p.status === 'active');
    if (filter === 'unlocked') return positions.filter((p) => p.status === 'ready');
    return positions.filter((p) => p.status === 'settled');
  }, [filter, positions]);

  return (
    <div className="stack">
      <header className="flex flex-col gap-4 border-b border-[var(--color-border)] pb-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h2 className="t-headline-md text-[var(--color-fg)]">Your Vaults</h2>
          {address ? (
            <p className="t-mono-xs mt-1 flex flex-wrap items-center gap-1.5 text-[var(--color-text-muted)]">
              {/* Short in the layout, full on hover, one click to copy. */}
              <span title={address}>{shortenHex(address, 6, 4)}</span>
              <CopyButton value={address} label="Copy wallet address" />
            </p>
          ) : (
            <p className="t-mono-xs mt-1 text-[var(--color-text-muted)]">Connect a wallet</p>
          )}
        </div>

        {/* One tab per row, never wrapping: "All (3)" has to stay on one line.
            Below md the strip scrolls horizontally instead of breaking. */}
        <div
          role="tablist"
          aria-label="Filter locks by status"
          className="-mx-1 flex w-full snap-x gap-1 overflow-x-auto px-1 pb-1 md:mx-0 md:w-auto md:overflow-visible md:pb-0"
        >
          {FILTERS.map((f) => {
            const active = filter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(f.id)}
                className={`tap-target shrink-0 snap-start cursor-pointer whitespace-nowrap rounded-[var(--radius-control)] border px-3 py-2 t-mono-xs font-medium transition-colors ${
                  active
                    ? 'border-[var(--color-primary)] bg-[rgba(146,0,225,0.16)] text-[var(--color-primary-3)]'
                    : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-fg)]'
                }`}
              >
                {f.label} ({counts[f.id]})
              </button>
            );
          })}
        </div>
      </header>

      {!IS_LOCKER_CONFIGURED ? (
        <Notice tone="error" title="Locker address not configured">
          Set <span className="font-mono">NEXT_PUBLIC_ZERO_G_LOCKER_ADDRESS</span> and rebuild.
        </Notice>
      ) : !isEnabled ? (
        <Panel>
          <EmptyState
            title="No wallet connected"
            body="Locks belong to the address that opens them. Connect the wallet holding your 0G to see its vaults."
          />
        </Panel>
      ) : error ? (
        <Notice tone="error" title="Could not read your locks">
          The node did not answer. Try again in a moment.
        </Notice>
      ) : isLoading ? (
        <CardListSkeleton count={3} />
      ) : positions.length === 0 ? (
        <Panel>
          <EmptyState
            title="No vaults yet"
            body="You have no locks on this address. Create one to start a non-custodial timelock."
            action={
              <Button variant="primary" size="md" onClick={() => setTab('create-lock')}>
                Create Lock
              </Button>
            }
          />
        </Panel>
      ) : (
        <div className={isFetching ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
          {/* Phones: one card per lock. */}
          <ul className="flex flex-col gap-4 md:hidden">
            {filtered.map((position) => (
              <li key={position.lockId.toString()}>
                <LockCard position={position} now={now} onOpen={select} onWithdrawn={refresh} />
              </li>
            ))}
          </ul>

          {/* md and up: table. */}
          <Panel bodyClassName="p-0" className="hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <caption className="sr-only-focusable">Your 0G locks</caption>
                <thead>
                  <tr className="border-b border-[var(--color-border)]">
                    <Th>Vault</Th>
                    <Th>Amount</Th>
                    <Th>Term</Th>
                    <Th>Unlock Date</Th>
                    <Th>Remaining</Th>
                    <Th>Status</Th>
                    <Th>Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((position) => (
                    <TableRow key={position.lockId.toString()} position={position} now={now} onOpen={select} onWithdrawn={refresh} />
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      )}

      {IS_LOCKER_CONFIGURED ? (
        <p className="t-mono-xs break-anywhere text-[var(--color-text-muted)]">
          Vault contract{' '}
          <a
            href={getAddressUrl(CONTRACT_ADDRESS)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--color-primary-1)] hover:underline"
          >
            {shortenHex(CONTRACT_ADDRESS, 6, 4)}
          </a>
        </p>
      ) : null}

      <VaultDetailPanel
        lockId={selectedId}
        positions={positions}
        isLoadingPositions={isLoading}
        onClose={close}
        onSettled={refresh}
      />

      {/* Surfaces a wrong-network wallet in this view too; the header chip shows
          the same state, but the action lives here. */}
      {!onCorrectNetwork && isEnabled ? (
        <Notice tone="warning" title="Wrong network">
          Withdrawals need 0G Mainnet. Switch networks in the account menu.
        </Notice>
      ) : null}
    </div>
  );
}

/**
 * Mobile vault card.
 *
 * The card info section is a `<button>` that opens the detail drawer.
 * For UNLOCKED vaults, a separate withdraw button is rendered below the card,
 * so there is no illegal button-in-button nesting.
 */
function LockCard({position, now, onOpen, onWithdrawn}: {position: Position; now: bigint; onOpen: (id: bigint) => void; onWithdrawn: () => void}) {
  const tone = position.status === 'ready' ? 'ready' : position.status === 'settled' ? 'withdrawn' : 'warning';
  const label = position.status === 'ready' ? 'UNLOCKED' : position.status === 'settled' ? 'WITHDRAWN' : 'LOCKED';
  const remaining = position.unlockTime > now ? position.unlockTime - now : 0n;

  const tx = useTxController();
  useTxToasts(tx);
  useTxPhaseEffects(tx, {onSuccess: onWithdrawn});

  const withdrawParams = {
    address: locker.address,
    abi: locker.abi,
    functionName: 'withdraw' as const,
    args: [position.lockId] as const,
  };

  return (
    <div className="flex flex-col gap-0">
      <button
        type="button"
        onClick={() => onOpen(position.lockId)}
        aria-label={`Vault ${position.lockId.toString()}, ${label}. Open details.`}
        className={`group flex w-full cursor-pointer flex-col gap-3 rounded-[var(--radius-card)] border bg-[var(--color-surface)] p-4 text-left transition-colors hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary-1)] ${
          position.status === 'ready'
            ? 'border-[rgba(46,204,113,0.32)] rounded-b-none border-b-0'
            : position.status === 'settled'
              ? 'border-[var(--color-border)] opacity-70'
              : 'border-[var(--color-border)]'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <span className="t-mono-sm block text-[var(--color-fg)]">Vault #{position.lockId.toString()}</span>
            <span
              title={formatZeroGFull(position.amount)}
              className="t-numeric mt-1 block break-anywhere"
            >
              {formatZeroG(position.amount, {maxDecimals: 4})}{' '}
              <span className="text-[0.75rem] font-normal text-[var(--color-text-muted)]">0G</span>
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Status tone={tone}>{label}</Status>
            <ChevronRight
              size={18}
              className="text-[var(--color-text-muted)] transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
          <Cell label="Term" value={`${position.days} days`} mono />
          <Cell label="Unlock" value={formatDate(position.unlockTime)} mono />
          <Cell
            label="Remaining"
            value={
              position.status === 'settled' ? '—' : position.status === 'ready' ? 'Ready' : formatDuration(remaining)
            }
            mono
            tone={position.status === 'ready' ? 'success' : 'default'}
          />
          <Cell
            label="Status"
            value={position.status === 'ready' ? 'Ready to withdraw' : position.status === 'settled' ? 'Settled' : 'Locked in vault'}
            tone={position.status === 'ready' ? 'success' : 'default'}
          />
        </dl>
      </button>

      {/* Withdraw button sits flush below the card for UNLOCKED vaults — separate
          from the card button to avoid invalid nested button HTML. */}
      {position.status === 'ready' ? (
        <TxButton
          tx={tx}
          params={withdrawParams}
          idleLabel="Withdraw"
          successLabel="Withdrawn"
          variant="success"
          fullWidth
          minHeight="2.75rem"
          className="rounded-t-none rounded-b-[var(--radius-card)] border border-t-0 border-[rgba(46,204,113,0.32)]"
        />
      ) : null}
    </div>
  );
}

/**
 * Desktop table row. Each ready row owns its own tx controller so multiple
 * withdrawals can be queued independently without sharing state.
 */
function TableRow({position, now, onOpen, onWithdrawn}: {position: Position; now: bigint; onOpen: (id: bigint) => void; onWithdrawn: () => void}) {
  const tone = position.status === 'ready' ? 'ready' : position.status === 'settled' ? 'withdrawn' : 'warning';
  const label = position.status === 'ready' ? 'UNLOCKED' : position.status === 'settled' ? 'WITHDRAWN' : 'LOCKED';
  const remaining = position.unlockTime > now ? position.unlockTime - now : 0n;

  const tx = useTxController();
  useTxToasts(tx);
  useTxPhaseEffects(tx, {onSuccess: onWithdrawn});

  const withdrawParams = {
    address: locker.address,
    abi: locker.abi,
    functionName: 'withdraw' as const,
    args: [position.lockId] as const,
  };

  return (
    <tr className="border-b border-[var(--color-border)] last:border-b-0 hover:bg-[var(--color-surface-hover)]">
      <Td>
        <button
          type="button"
          onClick={() => onOpen(position.lockId)}
          aria-label={`Vault ${position.lockId.toString()}, ${label}. Open details.`}
          className="tap-target inline-flex cursor-pointer items-center gap-1 rounded-[var(--radius-control)] px-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary-1)]"
        >
          <span className="t-mono-sm text-[var(--color-fg)]">#{position.lockId.toString()}</span>
          <ChevronRight size={14} className="shrink-0 text-[var(--color-text-muted)]" aria-hidden="true" />
        </button>
      </Td>
      <Td>
        <span title={formatZeroGFull(position.amount)} className="t-mono-sm text-[var(--color-fg)]">
          {formatZeroG(position.amount, {maxDecimals: 4})}{' '}
          <span className="text-[0.75rem] text-[var(--color-text-muted)]">0G</span>
        </span>
      </Td>
      <Td mono>{position.days} days</Td>
      <Td mono>{formatDate(position.unlockTime)}</Td>
      <Td mono className={position.status === 'ready' ? 'text-success' : undefined}>
        {position.status === 'settled' ? '—' : position.status === 'ready' ? 'Ready' : formatDuration(remaining)}
      </Td>
      <Td>
        <Status tone={tone}>{label}</Status>
      </Td>
      <Td>
        {position.status === 'ready' ? (
          <TxButton
            tx={tx}
            params={withdrawParams}
            idleLabel="Withdraw"
            successLabel="Withdrawn"
            variant="success"
            minHeight="2rem"
            className="text-[0.8125rem]"
          />
        ) : position.status === 'settled' ? (
          <span className="t-mono-xs text-[var(--color-text-muted)]">Settled</span>
        ) : (
          <span className="t-mono-xs text-[var(--color-text-muted)]">Locked</span>
        )}
      </Td>
    </tr>
  );
}

function Cell({
  label,
  value,
  mono = false,
  tone = 'default',
}: {
  label: string;
  value: string;
  mono?: boolean;
  tone?: 'default' | 'success';
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-[0.75rem] text-[var(--color-text-muted)]">{label}</dt>
      <dd
        className={`truncate text-[0.8125rem] ${
          tone === 'success' ? 'text-success' : 'text-[var(--color-fg)]'
        } ${mono ? 't-mono-xs' : ''}`}
      >
        {value}
      </dd>
    </div>
  );
}

function EmptyState({title, body, action}: {title: string; body: string; action?: React.ReactNode}) {
  return (
    <div className="max-w-md py-1">
      <p className="t-headline-md text-[var(--color-fg)]">{title}</p>
      <p className="t-body-sm mt-1.5 text-[var(--color-text-secondary)]">{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
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

function Td({children, mono = false, className = ''}: {children: React.ReactNode; mono?: boolean; className?: string}) {
  return (
    <td className={`px-5 py-3 align-middle text-[0.8125rem] ${mono ? 't-mono-xs' : ''} ${className}`}>
      {children}
    </td>
  );
}
