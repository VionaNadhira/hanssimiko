'use client';

import {createContext, useContext, useCallback, useEffect, useMemo, useState, type ReactNode} from 'react';

import {useIsDesktop, useIsWide} from '@/lib/useMediaQuery';

export type TabId = 'overview' | 'my-locks' | 'create-lock' | 'history';

interface WorkspaceContextValue {
  tab: TabId;
  setTab: (id: TabId) => void;
  /** Desktop rail state. Persisted across sessions. */
  collapsed: boolean;
  setCollapsed: (v: boolean | ((prev: boolean) => boolean)) => void;
  /** One button, three behaviours depending on the viewport. */
  toggleSidebar: () => void;
  /** Phone drawer. Never persisted: a reload should always start closed. */
  mobileOpen: boolean;
  setMobileOpen: (v: boolean | ((prev: boolean) => boolean)) => void;
  /** False during SSR and the first paint, so nothing is rendered conditionally. */
  hydrated: boolean;
}

const LS_COLLAPSED = 'hanssimiko-bunker:sidebar-collapsed';

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

export function WorkspaceProvider({children}: {children: ReactNode}) {
  const [tab, setTabState] = useState<TabId>('overview');
  const [collapsed, setCollapsedRaw] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const isDesktop = useIsDesktop();
  const isWide = useIsWide();

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_COLLAPSED);
      if (raw !== null) setCollapsedRaw(raw === '1');
    } catch {}
    // A shared `?vault=<id>` link must land on the panel even from a cold load,
    // where the selection hook is not mounted yet because the tab starts on Overview.
    try {
      if (new URLSearchParams(window.location.search).has('vault')) setTabState('my-locks');
    } catch {}
    setHydrated(true);
  }, []);

  const setCollapsed = useCallback<WorkspaceContextValue['setCollapsed']>((value) => {
    setCollapsedRaw((prev) => {
      const next = typeof value === 'function' ? (value as (p: boolean) => boolean)(prev) : value;
      try {
        localStorage.setItem(LS_COLLAPSED, next ? '1' : '0');
      } catch {}
      return next;
    });
  }, []);

  // Tablets are a rail by default; the user can still open the full panel over
  // the content. Phones always open as a drawer.
  useEffect(() => {
    if (!hydrated) return;
    if (isDesktop && !isWide) setCollapsedRaw(true);
  }, [hydrated, isDesktop, isWide]);

  const setTab = useCallback((id: TabId) => {
    setTabState(id);
    // Choosing a destination on a phone should never leave the drawer covering it.
    setMobileOpen(false);
  }, []);

  const toggleSidebar = useCallback(() => {
    if (!isDesktop) {
      setMobileOpen((v) => !v);
      return;
    }
    if (isWide) {
      setCollapsed((v) => !v);
      setMobileOpen(false);
      return;
    }
    // Tablet: first tap opens the overlay, closing it returns to the rail.
    setMobileOpen((v) => !v);
  }, [isDesktop, isWide, setCollapsed]);

  // Freeze the page behind the drawer, and reset when the viewport grows past
  // the breakpoint so a resize never leaves the body locked.
  useEffect(() => {
    if (mobileOpen) {
      const previous = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = previous;
      };
    }
    return;
  }, [mobileOpen]);

  useEffect(() => {
    if (isDesktop) setMobileOpen(false);
  }, [isDesktop]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === 'b' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        toggleSidebar();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toggleSidebar]);

  const value = useMemo<WorkspaceContextValue>(
    () => ({tab, setTab, collapsed, setCollapsed, toggleSidebar, mobileOpen, setMobileOpen, hydrated}),
    [tab, setTab, collapsed, setCollapsed, toggleSidebar, mobileOpen, setMobileOpen, hydrated],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return context;
}

/** Navigation definition, shared by the sidebar and the mobile bottom nav. */
export const NAV_ITEMS = [
  {id: 'overview', label: 'Overview'},
  {id: 'my-locks', label: 'My Locks'},
  {id: 'create-lock', label: 'Create Lock'},
  {id: 'history', label: 'History'},
] as const satisfies readonly {id: TabId; label: string}[];
