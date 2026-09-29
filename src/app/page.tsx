'use client';

import {useAppKit} from '@reown/appkit/react';
import {useAccount} from 'wagmi';
import {Wallet} from 'lucide-react';

import {HistoryView} from '@/components/HistoryView';
import {LockForm} from '@/components/LockForm';
import {OverviewView} from '@/components/OverviewView';
import {PositionsPanel} from '@/components/PositionsPanel';
import {Button} from '@/components/ui';
import {useWorkspace} from '@/components/WorkspaceContext';
import {useRefreshChainData} from '@/hooks/useRefreshChainData';

export default function Page() {
  const {tab} = useWorkspace();
  const {isConnected} = useAccount();
  const refresh = useRefreshChainData();

  // Nothing wallet-scoped is rendered until a wallet is connected: no balances,
  // no positions, no Create Lock form, no send button.
  if (!isConnected) return <DisconnectedGate />;

  return (
    <div className="stack">
      {tab === 'overview' ? <OverviewView /> : null}
      {tab === 'my-locks' ? <PositionsPanel /> : null}
      {tab === 'create-lock' ? <CreateLockView onLockCreated={refresh} /> : null}
      {tab === 'history' ? <HistoryView /> : null}
    </div>
  );
}

function CreateLockView({onLockCreated}: {onLockCreated: () => void}) {
  return (
    <div className="mx-auto w-full max-w-[46rem]">
      <header className="mb-6 border-b border-[var(--color-border)] pb-4">
        <h2 className="t-headline-lg text-[var(--color-fg)]">Deploy Native 0G Timelock Vault</h2>
        <p className="t-mono-xs mt-1.5 text-[var(--color-text-secondary)]">
          A cryptographically enforced native payable lock. No ERC-20 approval required.
        </p>
      </header>
      <LockForm onLockCreated={onLockCreated} />
    </div>
  );
}

function DisconnectedGate() {
  const {open} = useAppKit();

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-primary-1)]">
        <Wallet size={26} aria-hidden="true" />
      </div>
      <h2 className="t-headline-lg text-[var(--color-fg)]">Connect your wallet</h2>
      <p className="t-body-lg mb-6 mt-2 max-w-md text-[var(--color-text-secondary)]">
        Connect to inspect your 0G vaults, watch maturations count down, or deploy a new timelock on 0G Mainnet.
      </p>
      <Button variant="primary" size="lg" onClick={() => open()}>
        Connect Wallet
      </Button>
    </div>
  );
}
