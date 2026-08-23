import type { ReactNode } from 'react';

export interface VisuallyHiddenProps {
  children: ReactNode;
}

/**
 * Hides content visually while keeping it in the accessibility tree — for
 * labels, status text, and skip links screen-reader users still need.
 * Relies on Tailwind's `sr-only` utility.
 */
export function VisuallyHidden({ children }: VisuallyHiddenProps) {
  return <span className="sr-only">{children}</span>;
}
