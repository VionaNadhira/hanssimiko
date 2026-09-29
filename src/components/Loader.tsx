'use client';

export function Loader({label = 'Loading'}: {label?: string}) {
  return (
    <div className="flex flex-col items-center gap-4 py-10" role="status" aria-live="polite" aria-busy="true">
      <div className="loader" aria-hidden="true" />
      <p className="t-mono-xs text-[var(--color-text-muted)] tracking-widest uppercase">{label}</p>
    </div>
  );
}

export function LoaderInline({label}: {label?: string}) {
  return (
    <div className="flex items-center gap-3 py-2" role="status" aria-live="polite" aria-busy="true">
      <div className="loader scale-[0.45] origin-left -my-6 -mr-10" aria-hidden="true" />
      {label ? <span className="t-mono-xs text-[var(--color-text-muted)] uppercase tracking-widest">{label}</span> : null}
    </div>
  );
}
