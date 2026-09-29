/**
 * Number and date formatting for a financial interface.
 *
 * Two rules hold everywhere in this app:
 *   1. Amounts are shown in 0G, never in wei, and never rounded up.
 *   2. Anything machine-readable (addresses, hashes, ids, timestamps) is
 *      rendered in the mono stack with tabular figures.
 */

const ZERO_G = '0G';

/**
 * Formatters are constructed once and reused.
 *
 * `Intl.NumberFormat` is comparatively expensive to build; calling it inside a
 * render that runs for every card on the page is a measurable cost, and a shared
 * instance is also what makes grouping consistent across the whole interface.
 */
/**
 * Integer part only. Grouping is delegated to `Intl` rather than a hand-rolled
 * regex: `Intl` is locale-aware and will never emit a separator inside the
 * fractional part, which is the bug that produced values like `0.6,937`.
 */
const integerFormat = new Intl.NumberFormat('en-US', {maximumFractionDigits: 0});

/**
 * Full-precision amounts, rounded to at most 4 decimals.
 *
 * Used where an approximate figure is acceptable (headline balances, compact
 * chips). `formatZeroG` is the one to use for anything that must never appear
 * larger than the amount actually held.
 */
const fourDecimalsFormat = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 4,
});

/**
 * Formats a wei amount as a 0G string.
 *
 * Truncates rather than rounds, so a displayed amount is never larger than the
 * amount actually held. `minDecimals` pads the fractional part for values that
 * are whole, e.g. `2.5` renders as `2.5000` at `minDecimals: 4`.
 *
 * The fractional part is never thousands-grouped — see the note at the grouping
 * call below.
 */
export function formatZeroG(wei: bigint, options: {maxDecimals?: number; minDecimals?: number} = {}): string {
  const {maxDecimals = 6, minDecimals = 0} = options;

  const negative = wei < 0n;
  const value = negative ? -wei : wei;

  const whole = value / 10n ** 18n;
  const fraction = value % 10n ** 18n;

  let decimals = '';
  if (maxDecimals > 0) {
    decimals = fraction.toString().padStart(18, '0').slice(0, maxDecimals).replace(/0+$/, '');
  }
  if (decimals.length < minDecimals) {
    decimals = fraction.toString().padStart(18, '0').slice(0, Math.max(minDecimals, 0));
  }

  // Thousands separators belong to the integer part only. Grouping the
  // fractional digits produced values like "0.6,937", which is not a number
  // anyone can read or parse.
  return `${negative ? '-' : ''}${groupThousands(whole.toString())}${decimals.length > 0 ? `.${decimals}` : ''}`;
}

/**
 * Full-precision display string for a wei amount.
 *
 * Used for tooltips and CSV export: up to 4 decimals, thousands-separated,
 * with no trailing zeros.
 */
export function formatZeroGFull(wei: bigint): string {
  return formatZeroG(wei, {maxDecimals: 4});
}

/**
 * Compact display for figures that must never wrap, e.g. large balances.
 * Caps at 4 decimals and switches to a `k`/`M` suffix past 1e6.
 */
export function formatCompact(wei: bigint): string {
  const whole = (wei < 0n ? -wei : wei) / 10n ** 18n;
  if (whole >= 1_000_000n) {
    return `${(Number(whole) / 1_000_000).toLocaleString('en-US', {maximumFractionDigits: 2})}M`;
  }
  if (whole >= 10_000n) {
    return `${(Number(whole) / 1_000).toLocaleString('en-US', {maximumFractionDigits: 1})}k`;
  }
  return formatZeroG(wei, {maxDecimals: 4});
}

/** Formats a wei amount with the native currency symbol appended. */
export function formatZeroGWithSymbol(wei: bigint, options?: {maxDecimals?: number}): string {
  return `${formatZeroG(wei, options)} ${ZERO_G}`;
}

/** Groups digits in threes: `1234567` -> `1,234,567`. */
export function groupThousands(digits: string): string {
  return integerFormat.format(Number(digits));
}

/** Rounds a plain 0G amount to at most 4 decimals, thousands-separated. */
export function formatAmount(value: number | string): string {
  return fourDecimalsFormat.format(Number(value));
}


/** Shortens an address or hash for dense layouts: `0x1234…cdef`. */
export function shortenHex(value: string, lead = 6, tail = 4): string {
  if (value.length <= lead + tail + 2) return value;
  return `${value.slice(0, lead)}…${value.slice(-tail)}`;
}

/** Absolute UTC timestamp, precise to the second. */
export function formatTimestamp(seconds: bigint): string {
  return new Date(Number(seconds) * 1000).toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
}

/** Calendar date in UTC, for unlock deadlines. */
export function formatDate(seconds: bigint): string {
  return new Date(Number(seconds) * 1000).toISOString().slice(0, 10);
}

/** Clock time in UTC, for countdowns. */
export function formatClock(seconds: bigint): string {
  return new Date(Number(seconds) * 1000).toISOString().slice(11, 19);
}

/**
 * Compact remaining-time string, e.g. `89d 04h`, `3h 12m`, `00m 41s`.
 * Deliberately coarse: a financial interface shows the deadline, not a
 * millisecond-precision animation.
 */
export function formatDuration(totalSeconds: bigint): string {
  if (totalSeconds <= 0n) return 'now';

  const seconds = Number(totalSeconds);
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const secs = seconds % 60;

  if (days > 0) return `${days}d ${String(hours).padStart(2, '0')}h`;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  if (minutes > 0) return `${minutes}m ${String(secs).padStart(2, '0')}s`;
  return `${secs}s`;
}

/** Parses a user-entered 0G amount into wei. Returns null when unparseable. */
export function parseZeroG(input: string): bigint | null {
  const trimmed = input.trim().replace(/,/g, '');
  if (trimmed === '') return null;
  if (!/^\d*\.?\d*$/.test(trimmed) || trimmed === '.') return null;

  const [wholePart = '0', fractionPart = ''] = trimmed.split('.');
  if (fractionPart.length > 18) return null;

  const whole = wholePart === '' ? 0n : BigInt(wholePart);
  const fraction = fractionPart === '' ? 0n : BigInt(fractionPart.padEnd(18, '0'));

  return whole * 10n ** 18n + fraction;
}

/**
 * Full timestamp in UTC, e.g. `2026-01-14 09:31:07 UTC`.
 *
 * Deliberately not localised: a lock's start and unlock moments are chain data,
 * and showing them in the viewer's local zone would make two users read the same
 * event as two different deadlines. The trailing `UTC` is the timezone marker.
 */
export function formatDateTimeUtc(seconds: bigint): string {
  const iso = new Date(Number(seconds) * 1000).toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 19)} UTC`;
}

/** Locale-aware UTC rendering, for display where the exact zone matters. */
export function formatDateTimeUtcLocale(seconds: bigint): string {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(Number(seconds) * 1000));
}
