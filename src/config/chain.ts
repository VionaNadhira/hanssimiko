/**
 * Centralised 0G Chain network configuration.
 *
 * Source of truth: official 0G documentation, Mainnet Overview
 * https://docs.0g.ai/developer-hub/mainnet/mainnet-overview
 *   Network name  : 0G Mainnet (Aristotle)
 *   Chain ID      : 16661
 *   Token symbol  : 0G
 *   Decimals      : 18
 *   RPC URL       : https://evmrpc.0g.ai
 *   Block explorer: https://chainscan.0g.ai
 *
 * Every value below can be overridden through a `NEXT_PUBLIC_*` environment
 * variable so that a production deployment can point at a dedicated RPC
 * provider without touching source. The chain id is deliberately not
 * overridable in the browser: the app only ever speaks to 0G Mainnet.
 */

/** The only chain id this application supports. */
export const ZERO_G_CHAIN_ID = 16_661;

/** 0G Mainnet chain name as published by 0G Labs. */
export const ZERO_G_CHAIN_NAME = '0G Mainnet';

/** Native currency of the chain. 0G has 18 decimals, like ether. */
export const ZERO_G_NATIVE_CURRENCY = {
  name: '0G',
  symbol: '0G',
  decimals: 18,
} as const;

/** 0G Mainnet block explorer. */
export const ZERO_G_EXPLORER_URL = 'https://chainscan.0g.ai';

/**
 * Base URL for every explorer link in the app.
 *
 * Components must call `getAddressUrl` / `getTxUrl` rather than concatenating a
 * URL by hand, so there is exactly one place that knows the shape of a 0G
 * ChainScan path. `EXPLORER_URL` is the only literal in the codebase.
 */
export const EXPLORER_URL = ZERO_G_EXPLORER_URL;

/** 0G faucet, used to obtain test funds before mainnet deployment. */
export const ZERO_G_FAUCET_URL = 'https://faucet.0g.ai';

/** Official 0G developer hub. */
export const ZERO_G_DOCS_URL = 'https://docs.0g.ai/developer-hub/mainnet/mainnet-overview';

/** Smallest unit of native 0G, i.e. one wei of 0G. */
export const ZERO_G_UNIT = 'wei';

/** Public 0G Mainnet RPC endpoint. Intended for development; use a provider for production. */
export const ZERO_G_DEFAULT_RPC_URL = 'https://evmrpc.0g.ai';

function readPublicEnv(key: string): string | undefined {
  // `process.env.NEXT_PUBLIC_*` is inlined at build time by Next.js, so the
  // property access must be static rather than computed.
  const table: Record<string, string | undefined> = {
    NEXT_PUBLIC_ZERO_G_RPC_URL: process.env.NEXT_PUBLIC_ZERO_G_RPC_URL,
  };
  const raw = table[key];
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** RPC endpoint used by the read-only transport. */
export const ZERO_G_RPC_URL = readPublicEnv('NEXT_PUBLIC_ZERO_G_RPC_URL') ?? ZERO_G_DEFAULT_RPC_URL;

/** True when the app is using the public endpoint rather than a dedicated provider. */
export const ZERO_G_USES_PUBLIC_RPC = ZERO_G_RPC_URL === ZERO_G_DEFAULT_RPC_URL;

/** Explorer link for an address. */
export function getAddressUrl(address: string): string {
  return `${EXPLORER_URL}/address/${address}`;
}

/** Explorer link for a transaction. */
export function getTxUrl(hash: string): string {
  return `${EXPLORER_URL}/tx/${hash}`;
}

/** Explorer link for a block. */
export function getBlockUrl(blockNumber: number | bigint): string {
  return `${EXPLORER_URL}/block/${blockNumber.toString()}`;
}
