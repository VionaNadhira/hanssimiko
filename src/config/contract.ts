import {isAddress, type Address} from 'viem';

import {ZERO_G_LOCKER_ABI} from '@/abi/ZeroGLocker';

/**
 * Deployed ZeroGLocker contract address.
 *
 * Single source of truth for the whole app: set
 * `NEXT_PUBLIC_ZERO_G_LOCKER_ADDRESS` in `.env.local` after deploying with
 * `forge script script/DeployZeroGLocker.s.sol`. The value is read once at build
 * time, so a redeploy requires a rebuild. No component may hardcode an address.
 *
 * The address is intentionally not defaulted to a placeholder: shipping a build
 * that talks to the zero address would be worse than failing loudly, which is
 * what `assertLockerConfigured` does.
 */
export const CONTRACT_ADDRESS = (
  process.env.NEXT_PUBLIC_ZERO_G_LOCKER_ADDRESS ?? ''
).trim() as Address;

/** True when the build has a syntactically valid locker address configured. */
export const IS_LOCKER_CONFIGURED =
  CONTRACT_ADDRESS.length > 0 && isAddress(CONTRACT_ADDRESS, {strict: false});

/**
 * Fails loudly on a misconfigured build.
 *
 * Without this the app renders normally and every transaction either no-ops or,
 * worse, points at whatever address happens to be in the env file. Called once at
 * startup so the problem surfaces in the console before a user tries to deposit.
 * `IS_LOCKER_CONFIGURED` separately gates the transaction controls in the UI.
 */
export function assertLockerConfigured(): void {
  if (IS_LOCKER_CONFIGURED) return;

  const raw = CONTRACT_ADDRESS;
  if (raw.length === 0) {
    console.error(
      '[config] NEXT_PUBLIC_ZERO_G_LOCKER_ADDRESS is not set. ' +
        'Deploy the contract and add the address to .env.local, then rebuild. ' +
        'Transaction controls are disabled.',
    );
    return;
  }

  console.error(
    `[config] NEXT_PUBLIC_ZERO_G_LOCKER_ADDRESS is not a valid address: ${raw}. ` +
      'Expected a 20-byte hex value such as 0x followed by 40 hex characters. ' +
      'Transaction controls are disabled.',
  );
}

/**
 * Block the locker was deployed in.
 *
 * History queries start here instead of `earliest`: a mainnet node will refuse
 * a log filter spanning tens of millions of blocks, and every block before
 * deployment is provably irrelevant. Override with
 * `NEXT_PUBLIC_ZERO_G_DEPLOY_BLOCK` after a redeploy.
 */
export const ZERO_G_DEPLOY_BLOCK: bigint = (() => {
  const raw = (process.env.NEXT_PUBLIC_ZERO_G_DEPLOY_BLOCK ?? '').trim();
  if (!/^\d+$/.test(raw)) return 0n;
  try {
    return BigInt(raw);
  } catch {
    return 0n;
  }
})();

/** Largest log range a public RPC endpoint will accept in one request. */
export const LOG_CHUNK_SIZE = 20_000n;

/** Convenience bundle so components never re-import the ABI. */
export const locker = {
  address: CONTRACT_ADDRESS,
  abi: ZERO_G_LOCKER_ABI,
} as const;
