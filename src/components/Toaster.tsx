'use client';

import {Toaster as SonnerToaster} from 'sonner';

/**
 * Global toast host.
 *
 * Desktop: docked to the top-right. Mobile: full width across the top, clear of
 * the safe area (see `.app-toaster` in `globals.css`). The live region is polite
 * so a screen reader announces a result without interrupting the user.
 */
export function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      closeButton
      className="app-toaster"
      toastOptions={{
        classNames: {
          toast:
            'rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[#0a0a0a] text-[var(--color-fg)] text-[0.8125rem]',
          description: 'text-[var(--color-text-secondary)] text-[0.75rem]',
          success: '!border-[var(--success-border)] !text-success',
          error: '!border-[var(--error-border)] !text-error',
          warning: '!border-[var(--warning-border)] !text-warning',
          loading: '!border-[var(--color-border)] text-[var(--color-fg)]',
          actionButton:
            'bg-[var(--color-primary)] text-[var(--color-fg)] rounded-[var(--radius-control)]',
          cancelButton:
            'bg-[var(--color-surface)] text-[var(--color-fg)] rounded-[var(--radius-control)]',
        },
      }}
    />
  );
}
