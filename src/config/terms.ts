/**
 * Lock terms.
 *
 * These must stay in lockstep with `ZeroGLocker._allowedDurations()` on chain.
 * The contract is the authority: it reverts on any other duration, so this
 * list is a convenience for the interface and not a security boundary.
 * `npm run contracts:test` asserts the two agree.
 */

export const SECONDS_PER_DAY = 86_400;

export type TermId = 15 | 30 | 60 | 90 | 180 | 365;

export interface Term {
  /** Duration in days, used as a stable display key. */
  readonly days: TermId;
  /** Duration in seconds, exactly as the contract expects. */
  readonly seconds: number;
  /** Short display label, e.g. `6M`. */
  readonly label: string;
}

export const LOCK_TERMS: readonly Term[] = [
  {days: 15, seconds: 15 * SECONDS_PER_DAY, label: '15D'},
  {days: 30, seconds: 30 * SECONDS_PER_DAY, label: '1M'},
  {days: 60, seconds: 60 * SECONDS_PER_DAY, label: '2M'},
  {days: 90, seconds: 90 * SECONDS_PER_DAY, label: '3M'},
  {days: 180, seconds: 180 * SECONDS_PER_DAY, label: '6M'},
  {days: 365, seconds: 365 * SECONDS_PER_DAY, label: '1Y'},
] as const;

export const DEFAULT_TERM_DAYS: TermId = 90;

/** Minimum deposit accepted by the contract: strictly greater than zero. */
export const MIN_DEPOSIT_WEI = 1n;

export function findTerm(days: number): Term | undefined {
  return LOCK_TERMS.find((term) => term.days === days);
}

export function isTermId(value: number): value is TermId {
  return findTerm(value) !== undefined;
}
