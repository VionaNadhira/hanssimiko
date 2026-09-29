'use client';

import {useCallback, useEffect, useState} from 'react';

/**
 * Which vault detail panel is open, mirrored into the query string.
 *
 * Living in the URL rather than in component state is what makes a panel
 * shareable and refreshable: `?vault=3` reopens vault 3 after a reload or a
 * paste into a new tab. `pushState` (not `replaceState`) so the browser Back
 * button closes the panel, which is what people expect from an overlay.
 */
const PARAM = 'vault';

function readFromLocation(): bigint | null {
  if (typeof window === 'undefined') return null;
  const raw = new URLSearchParams(window.location.search).get(PARAM);
  if (raw === null || raw === '') return null;
  if (!/^\d+$/.test(raw)) return null;
  try {
    return BigInt(raw);
  } catch {
    return null;
  }
}

function writeToLocation(id: bigint | null, replace: boolean) {
  const url = new URL(window.location.href);
  if (id === null) url.searchParams.delete(PARAM);
  else url.searchParams.set(PARAM, id.toString());
  // A trailing "?" after deleting the only param is noise; strip it.
  const next = `${url.pathname}${url.search}${url.hash}`;
  if (replace) window.history.replaceState(window.history.state, '', next);
  else window.history.pushState(window.history.state, '', next);
}

export interface VaultSelection {
  selectedId: bigint | null;
  select: (id: bigint) => void;
  close: () => void;
}

export function useVaultSelection(): VaultSelection {
  const [selectedId, setSelectedId] = useState<bigint | null>(null);

  // Read once on mount so a shared link opens the panel directly. Done in an
  // effect rather than in the initialiser to keep the first client render
  // identical to the server's.
  useEffect(() => {
    setSelectedId(readFromLocation());
  }, []);

  // Back/forward navigation.
  useEffect(() => {
    function onPopState() {
      setSelectedId(readFromLocation());
    }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const select = useCallback((id: bigint) => {
    setSelectedId(id);
    writeToLocation(id, false);
  }, []);

  const close = useCallback(() => {
    setSelectedId(null);
    // Replace rather than push: closing should not leave a history entry that
    // the user then has to press Back through to escape.
    writeToLocation(null, true);
  }, []);

  return {selectedId, select, close};
}
