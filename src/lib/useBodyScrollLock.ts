'use client';

import {useEffect} from 'react';

/**
 * Body scroll lock, reference counted.
 *
 * A plain save/restore per caller breaks when two overlays are open at once: the
 * sidebar releases the lock and hands back `"hidden"`, so unlocking the drawer
 * later sets `overflow` back to `""` and the page scrolls underneath both. A
 * counter makes the innermost release a no-op until the last holder lets go.
 */
let holders = 0;
let restore: string | null = null;

export function useBodyScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;

    if (holders === 0) {
      restore = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    holders += 1;

    return () => {
      holders -= 1;
      if (holders === 0) {
        document.body.style.overflow = restore ?? '';
        restore = null;
      }
    };
  }, [active]);
}
