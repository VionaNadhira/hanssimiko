'use client';

import {useEffect, useRef} from 'react';
import {History, LayoutDashboard, Lock, PlusCircle} from 'lucide-react';

import {useWorkspace, type TabId} from '@/components/WorkspaceContext';

interface NavItem {
  id: TabId;
  label: string;
  icon: React.ComponentType<{size?: number; className?: string}>;
}

export const SIDEBAR_ID = 'primary-sidebar';

const NAV_ITEMS: readonly NavItem[] = [
  {id: 'overview', label: 'Overview', icon: LayoutDashboard},
  {id: 'my-locks', label: 'My Locks', icon: Lock},
  {id: 'create-lock', label: 'Create Lock', icon: PlusCircle},
  {id: 'history', label: 'History', icon: History},
] as const;

/**
 * Primary navigation.
 *
 * Three presentations of the same list, driven by CSS plus two behavioural
 * booleans from the workspace context:
 *   phone   (<768px)   overlay drawer over a backdrop
 *   tablet  (768-1023) 64px icon rail, expandable to the same overlay
 *   desktop (>=1024px) 240px panel, collapsible to the rail
 *
 * The panel contains the brand and the menu and nothing else. Connection
 * status, balance and the vault address all live in the header, so repeating
 * them here only produced a second, contradicting source of truth.
 */
export function Sidebar() {
  const {tab, setTab, collapsed, mobileOpen, setMobileOpen} = useWorkspace();
  const panelRef = useRef<HTMLElement>(null);

  // Escape closes the overlay; focus moves into the drawer so keyboard users are
  // not left behind on the page underneath.
  useEffect(() => {
    if (!mobileOpen) return;
    panelRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setMobileOpen(false);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen, setMobileOpen]);

  // A rail is a persistent control, not a modal, so the title attribute is the
  // only affordance; on the overlay the labels are always visible.
  const showLabels = mobileOpen || !collapsed;

  return (
    <>
      {/* Backdrop: phones and the tablet overlay under TopBar. */}
      <div
        aria-hidden="true"
        onClick={() => setMobileOpen(false)}
        style={{top: 'var(--header-height)'}}
        className={`fixed inset-x-0 bottom-0 z-40 bg-black/70 transition-opacity duration-200 ${
          mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      <aside
        ref={panelRef}
        id={SIDEBAR_ID}
        tabIndex={-1}
        aria-label="Primary navigation"
        style={{
          width: showLabels ? 'var(--sidebar-width-expanded)' : 'var(--sidebar-width-rail)',
          top: 'var(--header-height)',
          height: 'calc(100dvh - var(--header-height))',
        }}
        className={`safe-bottom fixed left-0 z-40 flex flex-col border-r border-[var(--color-border)] bg-black outline-none overflow-hidden transition-[width,transform] duration-250 ease-in-out md:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >

        {/* Menu. The remaining space below stays empty and unlabelled. */}
        <nav className="min-h-0 flex-1 overflow-y-auto py-4">
          <ul className="flex flex-col gap-1.5 px-2">
            {NAV_ITEMS.map((item) => {
              const active = tab === item.id;
              const Icon = item.icon;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setTab(item.id)}
                    title={showLabels ? undefined : item.label}
                    aria-current={active ? 'page' : undefined}
                    className={`tap-target flex w-full cursor-pointer items-center gap-3 rounded-[var(--radius-control)] border px-3 py-2.5 text-left transition-colors ${
                      active
                        ? 'border-transparent bg-[rgba(146,0,225,0.16)] text-[var(--color-primary-3)]'
                        : 'border-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)] hover:text-[var(--color-fg)]'
                    }`}
                  >
                    <Icon size={19} className="shrink-0" />
                    {showLabels ? (
                      <span className="min-w-0 truncate text-[0.875rem] font-medium">{item.label}</span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
    </>
  );
}
