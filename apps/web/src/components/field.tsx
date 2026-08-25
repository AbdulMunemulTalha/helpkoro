import type { InputHTMLAttributes } from 'react';

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  /** Already-translated error text; when present the field is marked invalid. */
  error?: string;
  hint?: string;
}

/**
 * Labelled text input with accessible error wiring (`aria-invalid` +
 * `aria-describedby`). Presentational and hook-free, so it renders inside both
 * client forms and server components. Logical padding keeps it correct under RTL.
 */
export function Field({ id, label, error, hint, className, ...input }: FieldProps) {
  const errorId = error ? `${id}-error` : undefined;
  const hintId = hint ? `${id}-hint` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-neutral-800">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={[
          'rounded-md border bg-white px-3 py-2 text-sm text-neutral-900 outline-none',
          'focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-brand',
          error ? 'border-red-500' : 'border-neutral-300',
          className ?? '',
        ]
          .filter(Boolean)
          .join(' ')}
        {...input}
      />
      {hint ? (
        <p id={hintId} className="text-xs text-neutral-500">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
