import type {ButtonHTMLAttributes, InputHTMLAttributes, ReactNode} from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  trailing?: ReactNode;
  fullWidth?: boolean;
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--color-primary)] text-[var(--color-fg)] font-semibold border border-[var(--color-primary)] hover:bg-[var(--color-primary-1)] hover:border-[var(--color-primary-1)] active:opacity-90 disabled:bg-[var(--color-border)] disabled:text-[var(--color-text-muted)] disabled:border-[var(--color-border)] focus-visible:outline-[var(--color-primary-1)]',
  secondary:
    'bg-[var(--color-surface)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-fg)] active:bg-[var(--color-surface-hover)] disabled:text-[var(--color-text-muted)] disabled:border-[var(--color-border)]',
  outline:
    'bg-transparent text-[var(--color-fg)] font-semibold border border-[var(--color-border-strong)] hover:border-[var(--color-primary-1)] hover:bg-[var(--color-surface)] active:bg-[var(--color-surface-hover)] disabled:text-[var(--color-text-muted)] disabled:border-[var(--color-border)]',
  ghost:
    'bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)] hover:text-[var(--color-fg)] disabled:text-[var(--color-text-muted)]',
  danger:
    'bg-transparent text-error border border-error hover:bg-error-subtle active:opacity-90 disabled:border-[var(--color-border)] disabled:text-[var(--color-text-muted)]',
  success:
    'bg-success text-[#000] font-semibold border border-success hover:opacity-90 active:opacity-100 disabled:bg-[var(--color-border)] disabled:text-[var(--color-text-muted)] disabled:border-[var(--color-border)]',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[0.75rem] font-mono',
  md: 'h-10 px-4 text-[0.875rem] font-mono tracking-[0.04em]',
  lg: 'h-12 px-5 text-[0.875rem] font-mono tracking-[0.04em]',
};

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  trailing,
  fullWidth = false,
  className = '',
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-[var(--radius-control)] transition-colors duration-150 disabled:cursor-not-allowed ${SIZES[size]} ${VARIANTS[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {icon ? <span aria-hidden="true" className="inline-flex shrink-0">{icon}</span> : null}
      <span className="truncate">{children}</span>
      {trailing ? <span aria-hidden="true" className="inline-flex shrink-0">{trailing}</span> : null}
    </button>
  );
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  prefix?: string;
  suffix?: ReactNode;
  error?: string;
}

export function Input({prefix, suffix, error, className = '', id, ...rest}: InputProps) {
  return (
    <div className="min-w-0">
      <div
        className={`flex min-w-0 items-center gap-2 rounded-[var(--radius-control)] border bg-[var(--color-surface)] px-4 transition-colors duration-150 focus-within:border-[var(--color-primary-1)] ${
          error ? 'border-error' : 'border-[var(--color-border)]'
        }`}
        style={{minHeight: '3rem'}}
      >
        {prefix ? (
          <span className="t-mono-sm shrink-0 pr-1 text-[var(--color-text-secondary)]">{prefix}</span>
        ) : null}
        <input
          id={id}
          style={{fontSize: '1.125rem'}}
          className={`t-mono-sm min-w-0 flex-1 bg-transparent text-[var(--color-fg)] outline-none placeholder:text-[var(--color-text-muted)] disabled:cursor-not-allowed disabled:text-[var(--color-text-muted)] ${className}`}
          {...rest}
        />
        {suffix ? <span className="shrink-0 pl-1">{suffix}</span> : null}
      </div>
      {error ? (
        <p className="t-mono-xs mt-1.5 break-anywhere text-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Field({
  label,
  hint,
  htmlFor,
  children,
  className = '',
}: {
  label: string;
  hint?: ReactNode;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`min-w-0 ${className}`}>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <label htmlFor={htmlFor} className="t-label min-w-0 truncate text-[var(--color-text-secondary)]">
          {label}
        </label>
        {hint ? <span className="t-mono-xs shrink-0 text-[var(--color-text-muted)]">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}

type StatusTone = 'neutral' | 'active' | 'ready' | 'error' | 'warning' | 'withdrawn';

const TONES: Record<StatusTone, string> = {
  neutral: 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)]',
  active: 'border-[rgba(230,184,92,0.30)] bg-[rgba(230,184,92,0.10)] text-warning',
  ready: 'border-[rgba(46,204,113,0.30)] bg-[rgba(46,204,113,0.12)] text-success',
  error: 'border-[rgba(224,82,82,0.32)] bg-[rgba(224,82,82,0.10)] text-error',
  warning: 'border-[rgba(230,184,92,0.30)] bg-[rgba(230,184,92,0.10)] text-warning',
  withdrawn: 'border-[var(--color-border)] bg-[var(--color-border)]/50 text-[var(--color-text-secondary)]',
};

export function Status({tone = 'neutral', children}: {tone?: StatusTone; children: ReactNode}) {
  return (
    <span
      className={`t-mono-xs inline-flex items-center px-2 py-1 rounded-[0.375rem] border font-medium whitespace-nowrap ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}

export function DataRow({
  label,
  value,
  mono = true,
  className = '',
}: {
  label: ReactNode;
  value: ReactNode;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex items-baseline justify-between gap-4 py-2.5 ${className}`}>
      <dt className="t-mono-xs shrink-0 text-[var(--color-text-secondary)]">{label}</dt>
      <dd className={`${mono ? 't-mono-sm' : 't-body-sm'} min-w-0 truncate text-right text-[var(--color-fg)] tabular-numbers`}>
        {value}
      </dd>
    </div>
  );
}

export function Panel({
  title,
  description,
  actions,
  children,
  className = '',
  bodyClassName = '',
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={`min-w-0 overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] ${className}`}
    >
      {title ? (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] px-[var(--space-section)] py-4">
          <div className="min-w-0">
            <h2 className="text-[0.9375rem] font-semibold text-[var(--color-fg)]">{title}</h2>
            {description ? (
              <p className="t-mono-xs mt-1 text-[var(--color-text-secondary)]">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}
      <div className={`p-[var(--space-section)] ${bodyClassName}`}>{children}</div>
    </section>
  );
}

type NoticeTone = 'info' | 'error' | 'warning' | 'success';

const NOTICE_TONES: Record<NoticeTone, string> = {
  info: 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)]',
  error: 'border-[rgba(224,82,82,0.32)] bg-[rgba(224,82,82,0.10)] text-error',
  warning: 'border-[rgba(230,184,92,0.30)] bg-[rgba(230,184,92,0.10)] text-warning',
  success: 'border-[rgba(46,204,113,0.32)] bg-[rgba(46,204,113,0.12)] text-success',
};

export function Notice({
  tone = 'info',
  title,
  children,
  action,
  className = '',
}: {
  tone?: NoticeTone;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-start justify-between gap-3 rounded-[0.5rem] border px-4 py-3.5 ${NOTICE_TONES[tone]} ${className}`}>
      <div className="min-w-0 flex-1">
        {title ? <p className="font-sans text-[0.8125rem] font-semibold uppercase tracking-wide">{title}</p> : null}
        {children ? <div className="font-sans text-[0.8125rem] leading-relaxed mt-1 break-words">{children}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
