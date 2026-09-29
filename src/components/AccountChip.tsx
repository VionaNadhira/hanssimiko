'use client';

import {useEffect, useRef, useState} from 'react';
import Image from 'next/image';
import {ChevronDown} from 'lucide-react';
import {useAccount, useBalance, useDisconnect, useSwitchChain} from 'wagmi';
import {useAppKit} from '@reown/appkit/react';

import {CopyButton} from '@/components/CopyButton';
import {ZERO_G_CHAIN_ID, ZERO_G_CHAIN_NAME, getAddressUrl} from '@/config/chain';
import {formatCompact, formatZeroG, formatZeroGFull, shortenHex} from '@/lib/format';

/**
 * Account control in the header.
 *
 * Desktop shows address and balance inline. Below `md` there is no room for
 * both, so only the status dot and a short address remain and the balance moves
 * into this dropdown — where there is a full row for it.
 */
export function AccountChip() {
  const {address, isConnected, chain} = useAccount();
  const {open} = useAppKit();

  if (!isConnected) {
    return (
      <button
        type="button"
        onClick={() => open()}
        className="tap-target inline-flex shrink-0 cursor-pointer items-center justify-center rounded-[var(--radius-control)] border border-[var(--color-primary)] bg-[var(--color-primary)] px-2.5 min-[480px]:px-4 text-[0.75rem] min-[480px]:text-[0.8125rem] font-semibold text-[var(--color-fg)] transition-colors hover:border-[var(--color-primary-1)] hover:bg-[var(--color-primary-1)]"
      >
        <span className="hidden min-[480px]:inline">Connect Wallet</span>
        <span className="min-[480px]:hidden">Connect</span>
      </button>
    );
  }

  return (
    <AccountMenu
      address={address}
      onOpen={open}
      chainOk={chain?.id === ZERO_G_CHAIN_ID}
    />
  );
}

/**
 * Network chip.
 *
 * Visible on md (>=768px). Under 1000px it shows dot + "0G", at >=1000px it shows dot + full name.
 * Under 768px it is hidden and network info is in the account dropdown.
 */
export function NetworkChip() {
  const {isConnected, chain} = useAccount();
  const chainOk = !isConnected || chain?.id === ZERO_G_CHAIN_ID;

  return (
    <div
      className="hidden md:inline-flex shrink-0 items-center gap-1.5 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-[0.8125rem]"
    >
      {/* Green while the wallet is on 0G Mainnet, red otherwise. */}
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${chainOk ? 'bg-success' : 'bg-error'}`}
      />
      <span className="hidden min-[1000px]:inline text-[var(--color-fg)]">
        {ZERO_G_CHAIN_NAME}
      </span>
      <span className="inline min-[1000px]:hidden text-[var(--color-fg)]">
        0G
      </span>
    </div>
  );
}

function AccountMenu({
  address,
  chainOk,
  onOpen,
}: {
  address: `0x${string}` | undefined;
  chainOk: boolean;
  onOpen: () => void;
}) {
  const [openMenu, setOpenMenu] = useState(false);
  const {data: balance, isFetching} = useBalance({address, chainId: ZERO_G_CHAIN_ID});
  const {disconnect} = useDisconnect();
  const {switchChain, isPending} = useSwitchChain();
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openMenu) return;
    function onPointerDown(event: MouseEvent | TouchEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpenMenu(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpenMenu(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [openMenu]);

  const wei = balance?.value ?? 0n;
  const short = shortenHex(address ?? '', 6, 4);

  return (
    <div ref={wrapRef} className="relative min-w-0">
      <button
        type="button"
        onClick={() => setOpenMenu((v) => !v)}
        aria-expanded={openMenu}
        aria-haspopup="menu"
        className="tap-target flex min-w-0 cursor-pointer items-center gap-1.5 min-[480px]:gap-2 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2 min-[480px]:px-3 transition-colors hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-hover)]"
      >
        <span
          aria-hidden="true"
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${chainOk ? 'bg-success' : 'bg-error'}`}
        />
        {/* Dark tile rather than the old white chip, so the 0G mark is not
            sitting on a bright block in a black UI. */}
        <Image
          src="/brand/0g-icon.png"
          alt=""
          width={18}
          height={18}
          className="shrink-0 rounded-[0.2rem] border border-[var(--color-border)]"
        />
        {/* Under 480px: short address hidden (dot/avatar only). At >= 480px: short address shown */}
        <span className="hidden min-[480px]:inline min-w-0 truncate font-mono text-[0.8125rem] text-[var(--color-fg)]">
          {short}
        </span>
        {/* Under 768px: balance hidden. At >= 768px (md): balance shown */}
        <span className="hidden md:inline truncate font-mono text-[0.8125rem] font-semibold text-[var(--color-primary-3)]">
          {isFetching && balance === undefined ? '…' : `${formatCompact(wei)} 0G`}
        </span>
        <ChevronDown size={14} className="shrink-0 text-[var(--color-text-muted)]" aria-hidden="true" />
      </button>

      {openMenu ? (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[#070707]"
        >
          <div className="flex min-w-0 items-center gap-2.5 border-b border-[var(--color-border)] px-4 py-3">
            <Image
              src="/brand/0g-icon.png"
              alt="0G"
              width={24}
              height={24}
              className="shrink-0 rounded-[0.25rem]"
            />
            <span
              title={address}
              className="min-w-0 flex-1 truncate font-mono text-[0.75rem] text-[var(--color-fg)]"
            >
              {short}
            </span>
            <CopyButton value={address ?? ''} label="Copy wallet address" />
          </div>

          <dl className="space-y-2.5 px-4 py-3">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-[0.75rem] uppercase tracking-wider text-[var(--color-text-muted)]">
                Balance
              </dt>
              <dd
                title={formatZeroGFull(wei)}
                className="min-w-0 truncate text-right font-mono text-[0.8125rem] text-[var(--color-fg)]"
              >
                {formatZeroG(wei, {maxDecimals: 4})} 0G
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-[0.75rem] uppercase tracking-wider text-[var(--color-text-muted)]">
                Network
              </dt>
              <dd className="min-w-0 truncate text-right font-mono text-[0.8125rem] text-[var(--color-fg)]">
                {ZERO_G_CHAIN_NAME}
              </dd>
            </div>
          </dl>

          {address ? (
            <a
              href={getAddressUrl(address)}
              target="_blank"
              rel="noopener noreferrer"
              className="block px-4 pb-3 text-[0.75rem] text-[var(--color-primary-1)] hover:underline"
            >
              View on ChainScan
            </a>
          ) : null}

          {!chainOk ? (
            <div className="border-t border-[var(--color-border)] px-4 py-3">
              <p className="mb-2 text-[0.75rem] text-[var(--color-text-secondary)]">
                This wallet is on the wrong network. Hanssimiko Bunker needs 0G Mainnet.
              </p>
              <button
                type="button"
                onClick={() => void switchChain({chainId: ZERO_G_CHAIN_ID})}
                disabled={isPending}
                className="tap-target w-full cursor-pointer rounded-[var(--radius-control)] border border-[var(--error-border)] bg-[var(--error-subtle)] px-3 py-2 text-[0.8125rem] font-medium text-[var(--color-fg)] disabled:opacity-60"
              >
                {isPending ? 'Switching…' : 'Switch to 0G Mainnet'}
              </button>
            </div>
          ) : null}

          <div className="flex gap-2 border-t border-[var(--color-border)] p-3">
            <button
              type="button"
              onClick={onOpen}
              className="tap-target flex-1 cursor-pointer rounded-[var(--radius-control)] border border-[var(--color-border)] px-3 py-2 text-[0.8125rem] text-[var(--color-fg)] transition-colors hover:bg-[var(--color-surface)]"
            >
              Wallet
            </button>
            <button
              type="button"
              onClick={() => {
                setOpenMenu(false);
                disconnect();
              }}
              className="tap-target inline-flex cursor-pointer items-center justify-center rounded-[var(--radius-control)] border border-[var(--color-border)] px-3 py-2 text-[0.8125rem] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--error-subtle)] hover:text-[var(--color-fg)]"
            >
              Disconnect
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
