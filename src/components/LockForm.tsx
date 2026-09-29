'use client';

import {useCallback, useMemo, useState} from 'react';
import {encodeFunctionData} from 'viem';
import {useAccount, useBalance, useEstimateGas} from 'wagmi';

import {TxButton, TxStatusPanel, useTxPhaseEffects, useTxToasts} from '@/components/TxButton';
import {Button, Field, Input, Notice} from '@/components/ui';
import {ZERO_G_CHAIN_ID, ZERO_G_CHAIN_NAME} from '@/config/chain';
import {IS_LOCKER_CONFIGURED, locker} from '@/config/contract';
import {DEFAULT_TERM_DAYS, LOCK_TERMS, MIN_DEPOSIT_WEI, type TermId} from '@/config/terms';
import {useCorrectNetwork} from '@/hooks/useVaultData';
import {useRefreshChainData} from '@/hooks/useRefreshChainData';
import {useWorkspace} from '@/components/WorkspaceContext';
import {formatDate, formatZeroG, parseZeroG} from '@/lib/format';
import {useTxController, type TxParams} from '@/lib/useTxState';

const GAS_BUFFER = 115n;

export function LockForm({onLockCreated}: {onLockCreated?: () => void}) {
  const onCorrectNetwork = useCorrectNetwork();
  const {setTab} = useWorkspace();
  const {address} = useAccount();
  // `useBalance` enables its query only when an `address` is passed
  // (wagmi: `Boolean(address && ...)`), so omitting it left the read permanently
  // pending: the balance rendered as "…" and the amount was validated against
  // zero, which disabled the submit button forever. The address is required.
  const {data: balance, isPending: balancePending, isError: balanceError} = useBalance({
    address,
    chainId: ZERO_G_CHAIN_ID,
    query: {enabled: Boolean(address)},
  });

  const [termDays, setTermDays] = useState<TermId>(DEFAULT_TERM_DAYS);
  const [amountInput, setAmountInput] = useState('100');
  const [touched, setTouched] = useState(false);

  const term = useMemo(() => LOCK_TERMS.find((t) => t.days === termDays) ?? LOCK_TERMS[0]!, [termDays]);
  const amountWei = useMemo(() => parseZeroG(amountInput), [amountInput]);
  const balanceWei = balance?.value ?? 0n;
  // Until the balance resolves, treat it as unknown rather than zero, so a slow
  // read cannot masquerade as an empty wallet and block a valid amount.
  const balanceKnown = !balancePending && !balanceError;

  const ready = onCorrectNetwork && IS_LOCKER_CONFIGURED;

  const amountError = useMemo(() => {
    if (!touched || amountInput.trim() === '') return null;
    if (amountWei === null) return 'Enter a valid numeric amount';
    if (amountWei < MIN_DEPOSIT_WEI) return 'Amount must be greater than zero';
    if (balanceError) return 'Could not read your balance. Check the network and try again.';
    if (balanceKnown && amountWei > balanceWei) return 'Insufficient balance for this amount';
    return null;
  }, [touched, amountInput, amountWei, balanceWei, balanceKnown, balanceError]);

  const amountValid =
    amountWei !== null &&
    amountWei >= MIN_DEPOSIT_WEI &&
    // Never validate against a balance that has not arrived yet.
    (balanceKnown ? amountWei <= balanceWei : true);

  const tx = useTxController();
  const {phase, isBusy, reset, send} = tx;
  // A confirmed lock must not be submittable again from this form; the user
  // gets an explicit "Create Another Lock" action instead.
  const settled = phase === 'success';

  // One toast per transaction, and a single data refresh when it confirms.
  useTxToasts(tx);
  const refreshChainData = useRefreshChainData();
  useTxPhaseEffects(tx, {
    onSuccess: () => {
      // Balance, total locked, lock counts, My Locks and History all move
      // together; nothing needs a reload.
      void refreshChainData();
      onLockCreated?.();
    },
  });

  const createLockCalldata = useMemo(
    () =>
      encodeFunctionData({
        abi: locker.abi,
        functionName: 'createLock',
        args: [BigInt(term.seconds)],
      }),
    [term.seconds],
  );

  const {
    data: gasEstimate,
    isError: gasError,
  } = useEstimateGas({
    to: locker.address,
    value: amountWei ?? undefined,
    data: createLockCalldata,
    query: {enabled: ready && amountValid && !isBusy},
  });

  // While a transaction is in flight every input is frozen: changing the amount
  // or the term mid-flight would make the success panel describe a lock that
  // was never opened.
  const inputsLocked = isBusy;

  const params = useMemo<TxParams | null>(() => {
    // `isBusy` stops a second click mid-flight; `settled` stops a *second
    // deposit* after the first one has been confirmed. Without it the button
    // comes back to life labelled "Completed" and would happily lock the same
    // amount again, which is a much worse bug than a stale-looking label.
    if (!ready || !amountValid || amountWei === null || isBusy || settled) return null;
    return {
      address: locker.address,
      abi: locker.abi,
      functionName: 'createLock',
      args: [BigInt(term.seconds)],
      value: amountWei,
      ...(gasEstimate ? {gas: (gasEstimate * GAS_BUFFER) / 100n} : {}),
    } as TxParams;
  }, [ready, amountValid, amountWei, isBusy, settled, term.seconds, gasEstimate]);

  const setFraction = useCallback(
    (fraction: number) => {
      if (!balanceKnown || balanceWei <= 0n || inputsLocked) return;
      const targetWei = (balanceWei * BigInt(Math.floor(fraction * 100))) / 100n;
      setAmountInput(formatZeroG(targetWei, {maxDecimals: 4}));
      setTouched(true);
    },
    [balanceWei, balanceKnown, inputsLocked],
  );

  const submit = useCallback(() => {
    if (!params) return;
    void send(params);
  }, [params, send]);

  const startDate = useMemo(() => new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC', []);
  const unlockDate = useMemo(
    () => new Date(Date.now() + term.seconds * 1000).toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
    [term.seconds],
  );

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-section)]">
      <div className="stack">
        {/* Balance strip */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <span className="t-label text-[var(--color-text-secondary)]">Available Native Balance</span>
          <div className="flex items-center gap-2.5">
            <span
              title={balanceWei.toString()}
              className="t-mono-md min-w-0 truncate font-semibold text-[var(--color-fg)]"
            >
              {balancePending
                ? '…'
                : balanceError
                  ? 'Unavailable'
                  : address === undefined
                    ? 'Connect wallet'
                    : `${formatZeroG(balanceWei, {maxDecimals: 4})} 0G`}
            </span>
            <button
              type="button"
              onClick={() => setFraction(1)}
              disabled={!ready || !balanceKnown || balanceWei === 0n || inputsLocked}
              className="tap-target shrink-0 cursor-pointer rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface-hover)] px-2.5 text-[0.75rem] font-semibold uppercase tracking-wider text-[var(--color-fg)] transition-colors hover:border-[var(--color-border-strong)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Max
            </button>
          </div>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            setTouched(true);
            submit();
          }}
          noValidate
          className="stack"
        >
          {/* Amount */}
          <div>
            <Field label="Lock Capital Amount" htmlFor="input-amount">
              <Input
                id="input-amount"
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                suffix={<span className="t-mono-sm text-[var(--color-text-secondary)]">0G</span>}
                value={amountInput}
                onChange={(e) => {
                  setAmountInput(e.target.value);
                  if (phase === 'rejected' || phase === 'failed') reset();
                }}
                onBlur={() => setTouched(true)}
                error={amountError ?? undefined}
                disabled={!ready || inputsLocked}
              />
            </Field>

            <div className="grid grid-cols-4 gap-2.5 pt-3">
              {[0.25, 0.5, 0.75, 1.0].map((fraction) => (
                <button
                  key={fraction}
                  type="button"
                  onClick={() => setFraction(fraction)}
                  disabled={!ready || !balanceKnown || balanceWei === 0n || inputsLocked}
                  className="tap-target cursor-pointer rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[0.8125rem] font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-fg)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {Math.round(fraction * 100)}%
                </button>
              ))}
            </div>
          </div>

          {/* Term */}
          <div>
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <span className="t-label text-[var(--color-text-secondary)]">Fixed Vault Duration</span>
              <span className="t-mono-xs text-[var(--color-text-muted)]">Protocol rule</span>
            </div>
            <div className="grid grid-cols-2 gap-2.5 min-[480px]:grid-cols-3">
              {LOCK_TERMS.map((t) => {
                const selected = t.days === termDays;
                return (
                  <button
                    key={t.days}
                    type="button"
                    onClick={() => setTermDays(t.days)}
                    disabled={!ready || inputsLocked}
                    aria-pressed={selected}
                    className={`tap-target flex cursor-pointer items-center justify-between gap-2 rounded-[var(--radius-control)] border px-3.5 text-[0.875rem] transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                      selected
                        ? 'border-[var(--color-primary-1)] bg-[rgba(146,0,225,0.16)] font-semibold text-[var(--color-primary-3)]'
                        : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-fg)]'
                    }`}
                  >
                    <span className="truncate">{t.days} Days</span>
                    <span className="t-mono-xs shrink-0 text-[var(--color-text-muted)]">{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Summary */}
          <dl className="space-y-2.5 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-black/60 p-5 t-mono-xs">
            <SummaryRow label="Start Date" value={startDate} />
            <SummaryRow label="Estimated Unlock Date" value={unlockDate} tone="warning" />
            <SummaryRow
              label="Estimated Gas Fee"
              value={gasEstimate ? `${formatZeroG(gasEstimate, {maxDecimals: 6})} 0G` : '—'}
            />
            <div className="flex items-baseline justify-between gap-3 border-t border-[var(--color-border)] pt-2.5">
              <dt className="shrink-0 text-[var(--color-text-secondary)]">Contract Call</dt>
              <dd className="min-w-0 break-anywhere text-right text-[var(--color-fg)]">
                ZeroGLocker.createLock({term.seconds})
              </dd>
            </div>
          </dl>

          {gasError && !params ? (
            <Notice tone="warning" title="Network fee unavailable">
              The node could not estimate this transaction. It will still be submitted, or try again shortly.
            </Notice>
          ) : null}

          {/* Status + actions. On phones the submit bar sticks just above the
              bottom nav so it is always reachable one-handed. */}
          <div className="sticky bottom-[calc(var(--bottom-nav-height)+var(--safe-bottom))] z-20 -mx-4 border-t border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-bg)_92%,transparent)] px-4 py-3 backdrop-blur-md md:static md:mx-0 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
            <TxStatusPanel
              tx={tx}
              successTitle="Vault created"
              successBody={
                <span>
                  {formatZeroG(amountWei ?? 0n, {maxDecimals: 4})} 0G locked for {term.days} days on {ZERO_G_CHAIN_NAME}. Unlocks{' '}
                  {formatDate(BigInt(Math.floor(Date.now() / 1000) + term.seconds))}.
                </span>
              }
              onRetry={reset}
            >
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Button variant="primary" size="md" fullWidth onClick={() => setTab('my-locks')}>
                  View My Locks
                </Button>
                <Button
                  variant="secondary"
                  size="md"
                  fullWidth
                  onClick={() => {
                    setAmountInput('100');
                    setTouched(false);
                    reset();
                  }}
                >
                  Create Another Lock
                </Button>
              </div>
            </TxStatusPanel>

            <div className="flex flex-col gap-2 [&>*]:w-full sm:flex-row [&>*]:w-auto">
              <TxButton
                tx={tx}
                params={params}
                idleLabel="SIGN & LOCK NATIVE 0G"
                fullWidth
                minHeight="3.125rem"
                disabled={!ready || !amountValid}
              />
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function SummaryRow({label, value, tone}: {label: string; value: string; tone?: 'warning'}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-[var(--color-text-secondary)]">{label}</dt>
      <dd
        className={`min-w-0 truncate text-right ${
          tone === 'warning' ? 'font-semibold text-warning' : 'text-[var(--color-fg)]'
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
