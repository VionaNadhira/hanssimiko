'use client';

import {useCallback, useEffect, useRef, type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {X} from 'lucide-react';

import {useBodyScrollLock} from '@/lib/useBodyScrollLock';

/**
 * Slide-over panel.
 *
 * One component covers both presentations because they are the same dialog with
 * a different geometry: a 480px column from the right edge on `md` and up, and a
 * near-full-height sheet from the bottom on a phone. Keeping them together means
 * the focus trap, the escape handling and the scroll lock cannot drift apart
 * between breakpoints.
 *
 * Rendered through a portal so it is never clipped by a page container, and so
 * `position: fixed` is relative to the viewport rather than to a transformed
 * ancestor.
 */
export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  labelledBy = 'drawer-title',
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  labelledBy?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useBodyScrollLock(open);

  // Remember what had focus before the panel took over, and give it back on
  // close, so a keyboard user resumes where they were rather than at the top of
  // the document.
  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    return () => {
      restoreFocusRef.current?.focus?.();
      restoreFocusRef.current = null;
    };
  }, [open]);

  // Escape closes. Tab is handled here rather than by a focus-trap library
  // because the rule is short: wrap at the two ends of the panel's own tabbables.
  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const panel = panelRef.current;
      if (!panel) return;

      const tabbables = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);

      if (tabbables.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = tabbables[0];
      const last = tabbables[tabbables.length - 1];
      if (!first || !last) return;
      const active = document.activeElement;

      if (event.shiftKey && (active === first || active === panel)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [onClose],
  );

  // Move focus into the panel once it is on screen, so screen readers announce
  // the dialog and Tab starts from inside it.
  useEffect(() => {
    if (!open) return;
    const id = window.requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const target = panel.querySelector<HTMLElement>('[data-autofocus]') ?? panel;
      target.focus();
    });
    return () => window.cancelAnimationFrame(id);
  }, [open]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[60]"
      style={{
        // `prefers-reduced-motion` is neutralised globally in globals.css, so the
        // transition below collapses to a single frame when it is set.
        transition: 'opacity 200ms ease',
        opacity: open ? 1 : 0,
        pointerEvents: open ? 'auto' : 'none',
      }}
      aria-hidden={!open}
    >
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close panel"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-black/70 backdrop-blur-sm"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        style={{transition: 'transform 240ms cubic-bezier(0.22, 1, 0.36, 1)'}}
        className={`absolute flex flex-col border-[var(--color-border)] bg-[#070707] outline-none ${
          // Phone: bottom sheet, rounded top corners, almost the full height.
          'inset-x-0 bottom-0 max-h-[92dvh] rounded-t-[var(--radius-modal)] border-t md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[480px] md:rounded-none md:border-l md:border-t-0'
        } ${open ? 'translate-y-0 md:translate-x-0' : 'translate-y-full md:translate-y-0 md:translate-x-full'}`}
      >
        {/* Header */}
        <div className="safe-top flex shrink-0 items-start gap-3 border-b border-[var(--color-border)] px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 id={labelledBy} className="t-headline-md break-anywhere text-[var(--color-fg)]">
              {title}
            </h2>
            {subtitle ? <div className="mt-1 min-w-0">{subtitle}</div> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="tap-target inline-flex shrink-0 cursor-pointer items-center justify-center rounded-[var(--radius-control)] border border-[var(--color-border)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface)] hover:text-[var(--color-fg)]"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">{children}</div>

        {/* Footer actions stay reachable without scrolling the detail. */}
        {footer ? (
          <div className="safe-bottom shrink-0 border-t border-[var(--color-border)] px-5 py-4">{footer}</div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
