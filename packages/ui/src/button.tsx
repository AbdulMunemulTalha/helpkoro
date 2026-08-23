import { forwardRef, type ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-brand-contrast hover:opacity-90',
  secondary: 'border border-brand text-brand',
  ghost: 'text-brand hover:underline',
};

/**
 * Accessible button. Defaults `type="button"` (never an accidental form
 * submit), shows a visible focus ring for keyboard users, and uses logical
 * padding so it mirrors correctly under RTL.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', className, type, ...rest },
  ref,
) {
  const classes = [
    'inline-flex items-center justify-center rounded-md ps-4 pe-4 py-2 text-sm font-medium',
    'transition disabled:cursor-not-allowed disabled:opacity-50',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-brand',
    VARIANT_CLASSES[variant],
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return <button ref={ref} type={type ?? 'button'} className={classes} {...rest} />;
});
