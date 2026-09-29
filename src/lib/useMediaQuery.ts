'use client';

import {useCallback, useSyncExternalStore} from 'react';

import {mediaUp} from '@/config/breakpoints';

/**
 * SSR-safe `matchMedia`.
 *
 * `useSyncExternalStore` supplies a server snapshot during hydration, so the
 * first client render matches the server markup. That is what stops the
 * drawer/rail from flashing the wrong layout on load. Once hydrated, the real
 * media-query result takes over.
 *
 * This hook is only for *behaviour* (open as overlay vs inline, whether the
 * bottom nav exists). All visual layout stays in CSS media queries.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {};
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onStoreChange);
      return () => mql.removeEventListener('change', onStoreChange);
    },
    [query],
  );

  const getSnapshot = useCallback(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  }, [query]);

  const getServerSnapshot = useCallback(() => false, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** True at or above `md` (768px) — the tablet/desktop boundary. */
export function useIsDesktop(): boolean {
  return useMediaQuery(mediaUp('md'));
}

/** True at or above `lg` (1024px) — full desktop chrome with the expanded sidebar. */
export function useIsWide(): boolean {
  return useMediaQuery(mediaUp('lg'));
}

/** True below `md` — phones, where the sidebar is a drawer. */
export function useIsMobile(): boolean {
  return !useMediaQuery(mediaUp('md'));
}
