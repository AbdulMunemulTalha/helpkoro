import type { ZodError } from 'zod';

/**
 * Shared shape returned by the auth server actions to `useActionState`. Error
 * values are *translation keys* relative to the `auth` message namespace (never
 * raw copy or provider text), so the client form renders them bilingually. Only
 * non-secret inputs are echoed back in `values` — passwords are never returned.
 */
export interface AuthFormState {
  /** Top-level error message key (relative to the `auth` namespace). */
  error?: string;
  /** Per-field error message keys (relative to the `auth` namespace). */
  fieldErrors?: Partial<Record<'email' | 'password' | 'displayName', string>>;
  /** Non-secret values echoed back so the form re-renders populated. */
  values?: { email?: string; displayName?: string };
}

/** The auth fields we surface field-level errors for, mapped to message keys. */
const FIELD_ERROR_KEYS: Record<string, string> = {
  email: 'errors.email',
  password: 'errors.password',
  displayName: 'errors.displayName',
};

/** Map a Zod validation error to per-field message keys (first issue per field). */
export function authFieldErrors(error: ZodError): AuthFormState['fieldErrors'] {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? '');
    const key = FIELD_ERROR_KEYS[field];
    if (key && !(field in out)) out[field] = key;
  }
  return out;
}

/**
 * Map the API's `VALIDATION_FAILED` `details.fields` (`[{ path, message }]`, see
 * ZodValidationPipe) to the same per-field message keys. Returns `undefined`
 * when the details carry no field we display, so the caller can fall back to a
 * generic message.
 */
export function apiFieldErrors(details: unknown): AuthFormState['fieldErrors'] | undefined {
  if (!details || typeof details !== 'object' || !('fields' in details)) return undefined;
  const fields = (details as { fields?: unknown }).fields;
  if (!Array.isArray(fields)) return undefined;
  const out: Record<string, string> = {};
  for (const entry of fields) {
    const path = String((entry as { path?: unknown })?.path ?? '').split('.')[0] ?? '';
    const key = FIELD_ERROR_KEYS[path];
    if (key && !(path in out)) out[path] = key;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}
