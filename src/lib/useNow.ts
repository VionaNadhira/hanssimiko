'use client';

import {useEffect, useRef, useState} from 'react';

/**
 * A single shared clock.
 *
 * Countdowns appear in the vault list, the detail panel and the overview. Giving
 * each one its own `setInterval` means a page with twenty locks runs twenty
 * timers that all fire in the same millisecond, which is both wasteful and a
 * reliable way to make scrolling stutter on a phone.
 *
 * So there is exactly one timer in the module, started by the first subscriber
 * and stopped by the last. Each subscriber then throttles to the resolution it
 * actually needs: the list only shows days and hours, so it takes a tick a
 * minute, while the open panel shows seconds and takes every tick.
 */
const TICK_MS = 1_000;

type Subscriber = (nowMs: number) => void;

const subscribers = new Set<Subscriber>();
let timer: ReturnType<typeof setInterval> | null = null;

function startTimer() {
  if (timer !== null) return;
  timer = setInterval(() => {
    const now = Date.now();
    // Snapshot first: a subscriber may unsubscribe from inside its own callback.
    for (const notify of [...subscribers]) notify(now);
  }, TICK_MS);
}

function stopTimer() {
  if (timer === null) return;
  clearInterval(timer);
  timer = null;
}

/**
 * Returns the current time in milliseconds, refreshed at most every
 * `intervalMs`. The first render is always correct on the client and is
 * deterministic on the server, because the initial value is only ever read during
 * render — the interval is installed in an effect.
 */
export function useNow(intervalMs: number = TICK_MS): number {
  const [now, setNow] = useState(() => Date.now());
  // Read inside the interval callback, which must not be re-created on every
  // render just because the caller passed a new number.
  const intervalRef = useRef(intervalMs);
  intervalRef.current = intervalMs;
  const lastEmitRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    const notify: Subscriber = (nowMs) => {
      if (cancelled) return;
      if (nowMs - lastEmitRef.current < intervalRef.current) return;
      lastEmitRef.current = nowMs;
      setNow(nowMs);
    };

    // Catch up immediately on mount so a panel opened between ticks is not
    // showing a stale second.
    lastEmitRef.current = 0;
    notify(Date.now());

    subscribers.add(notify);
    startTimer();

    return () => {
      cancelled = true;
      subscribers.delete(notify);
      if (subscribers.size === 0) stopTimer();
    };
  }, []);

  return now;
}

/** Whole seconds since the epoch, the unit every contract timestamp uses. */
export function useNowSeconds(intervalMs: number = TICK_MS): bigint {
  return BigInt(Math.floor(useNow(intervalMs) / 1000));
}

/**
 * Splits a remaining duration into the units the UI shows.
 *
 * `total` is a bigint of seconds. Returns zeroed units for anything elapsed so
 * callers never have to guard against negative values.
 */
export interface Remaining {
  total: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  elapsed: boolean;
}

export function splitRemaining(total: bigint): Remaining {
  const seconds = total > 0n ? Number(total) : 0;
  return {
    total: seconds,
    days: Math.floor(seconds / 86_400),
    hours: Math.floor((seconds % 86_400) / 3_600),
    minutes: Math.floor((seconds % 3_600) / 60),
    seconds: seconds % 60,
    elapsed: total <= 0n,
  };
}

/** Pads a unit to two digits, e.g. 7 -> "07". */
export function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}
