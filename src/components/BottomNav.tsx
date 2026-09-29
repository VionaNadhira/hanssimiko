'use client';

import {History, LayoutDashboard, Lock, PlusCircle} from 'lucide-react';

import {NAV_ITEMS, useWorkspace, type TabId} from '@/components/WorkspaceContext';

const ICONS = {
  overview: LayoutDashboard,
  'my-locks': Lock,
  'create-lock': PlusCircle,
  history: History,
} as const;

/**
 * Phone navigation.
 *
 * The drawer is a poor fit one-handed, so below `md` every destination is also
 * reachable from a fixed bar at the bottom of the screen. Purely CSS: the bar is
 * hidden from `md` up, so there is no hydration branch to get wrong.
 */
export function BottomNav() {
  const {tab, setTab} = useWorkspace();

  return (
    <nav
      aria-label="Primary"
      className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-[var(--color-border)] bg-[#050505] md:hidden"
    >
      <ul className="mx-auto grid max-w-[var(--container-page)] grid-cols-4">
        {NAV_ITEMS.map((item) => {
          const Icon = ICONS[item.id as TabId];
          const active = tab === item.id;
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => setTab(item.id)}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-11 w-full cursor-pointer flex-col items-center justify-center gap-1 px-1 py-2 transition-colors ${
                  active
                    ? 'text-[var(--color-primary-3)]'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-fg)]'
                }`}
              >
                <Icon size={20} aria-hidden="true" />
                <span className="text-[0.75rem] leading-none">{item.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
