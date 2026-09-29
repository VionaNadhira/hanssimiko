import type {ReactNode} from 'react';

/**
 * Placeholder blocks shown while on-chain data loads.
 *
 * Their dimensions mirror the real content so the page does not jump when the
 * data arrives (CLS = 0 for the affected regions).
 */

export function Skeleton({className = ''}: {className?: string}) {
  return <div aria-hidden="true" className={`skeleton ${className}`} />;
}

/** A metric card skeleton: label, value, divider, footer bar. */
export function StatCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-section)]">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-6 w-28" />
      <div className="h-px w-full bg-[var(--color-border)]" />
      <Skeleton className="h-3 w-24" />
    </div>
  );
}

/** Skeleton row sized to the real table row so nothing shifts on load. */
export function TableRowSkeleton({columns}: {columns: number}) {
  return (
    <tr className="h-11 border-b border-[var(--color-border)]">
      {Array.from({length: columns}, (_, i) => (
        <td key={i} className="px-5 py-2">
          <Skeleton className="h-3 w-full max-w-28" />
        </td>
      ))}
    </tr>
  );
}

/** Stacked-card skeleton used below the `md` breakpoint. */
export function CardListSkeleton({count = 3}: {count?: number}) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({length: count}, (_, i) => (
        <div key={i} className="flex flex-col gap-2.5 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3 w-full max-w-52" />
        </div>
      ))}
    </div>
  );
}

/** Generic shimmering panel body. */
export function PanelSkeleton({rows = 3, children}: {rows?: number; children?: ReactNode}) {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-live="polite">
      {children}
      {Array.from({length: rows}, (_, i) => (
        <Skeleton key={i} className="h-4 w-full" />
      ))}
    </div>
  );
}
