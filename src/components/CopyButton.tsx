'use client';

import {useCallback, useEffect, useRef, useState} from 'react';
import {Check, Copy} from 'lucide-react';

/**
 * Copy-to-clipboard control for addresses and hashes.
 *
 * Mobile note: hover-only tooltips do not exist on touch, so the confirmation is
 * rendered as visible inline text ("Copied") and announced politely, which
 * works identically on every input method.
 */
export function CopyButton({
  value,
  label,
  className = '',
  size = 'sm',
}: {
  value: string;
  /** Accessible name, e.g. "Copy transaction hash". */
  label: string;
  className?: string;
  size?: 'sm' | 'md';
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Clipboard API can be blocked; fall back to a hidden textarea + execCommand.
      try {
        const ta = document.createElement('textarea');
        ta.value = value;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      } catch {
        return;
      }
    }
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1600);
  }, [value]);

  const iconSize = size === 'sm' ? 13 : 15;

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <button
        type="button"
        onClick={() => void copy()}
        aria-label={label}
        title={label}
        className={`inline-flex shrink-0 cursor-pointer items-center justify-center rounded-[var(--radius-control)] border border-transparent text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-border)] hover:bg-[var(--color-surface)] hover:text-[var(--color-fg)] ${
          size === 'sm' ? 'h-6 w-6' : 'h-8 w-8 tap-target'
        }`}
      >
        {copied ? <Check size={iconSize} className="text-success" /> : <Copy size={iconSize} />}
      </button>
      <span aria-live="polite" className="sr-only-focusable">
        {copied ? `${label}: copied` : ''}
      </span>
      {copied ? (
        <span aria-hidden="true" className="t-mono-xs whitespace-nowrap text-success">
          Copied
        </span>
      ) : null}
    </span>
  );
}
