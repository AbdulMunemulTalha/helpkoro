'use client';

import { useFormStatus } from 'react-dom';
import { Button, type ButtonProps } from '@helpkoro/ui';

/**
 * Submit button wired to the enclosing form's pending state via `useFormStatus`
 * (React 19). Disables and marks itself busy while the server action runs, and
 * optionally swaps to `pendingLabel`.
 */
export function SubmitButton({
  children,
  pendingLabel,
  ...rest
}: ButtonProps & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-busy={pending} {...rest}>
      {pending && pendingLabel ? pendingLabel : children}
    </Button>
  );
}
