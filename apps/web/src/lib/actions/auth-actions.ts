'use server';

import { redirect } from 'next/navigation';
import { loginInputSchema, registerInputSchema } from '@helpkoro/contracts';

import type { AppLocale } from '@/i18n/routing';
import { login, logout, register } from '@/lib/api/auth';
import { apiFieldErrors, authFieldErrors, type AuthFormState } from '@/lib/forms';
import { safeRedirectPath } from '@/lib/safe-redirect';

/**
 * Auth server actions bound to the current locale + safe `next` target by the
 * page (`action.bind(null, locale, next)`), then driven by `useActionState`.
 * Validation runs against the shared contract schemas first, so most bad input
 * never reaches the API; API failures are collapsed to stable, non-enumerating
 * message keys. On success the action `redirect()`s (which throws the Next
 * redirect signal — deliberately not caught).
 */

export async function loginAction(
  locale: AppLocale,
  next: string | undefined,
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');

  const parsed = loginInputSchema.safeParse({ email, password });
  if (!parsed.success) {
    return { fieldErrors: authFieldErrors(parsed.error), values: { email } };
  }

  const result = await login(parsed.data);
  if (!result.ok) {
    if (result.error.code === 'RATE_LIMITED') {
      return { error: 'errors.rateLimited', values: { email } };
    }
    // Bad credentials arrive as AUTH_REQUIRED; collapse every failure to one
    // generic message so we never reveal whether an email is registered.
    return { error: 'errors.invalidCredentials', values: { email } };
  }

  redirect(safeRedirectPath(next, locale));
}

export async function registerAction(
  locale: AppLocale,
  next: string | undefined,
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get('email') ?? '');
  const displayName = String(formData.get('displayName') ?? '');
  const password = String(formData.get('password') ?? '');

  const parsed = registerInputSchema.safeParse({
    email,
    password,
    displayName,
    // Reconcile transports: the UI defaults to bn but the API's localeSchema
    // defaults to en, so pass the active UI locale explicitly.
    locale,
  });
  if (!parsed.success) {
    return { fieldErrors: authFieldErrors(parsed.error), values: { email, displayName } };
  }

  const result = await register(parsed.data);
  if (!result.ok) {
    const { code, details } = result.error;
    if (code === 'STATE_CONFLICT') {
      return { fieldErrors: { email: 'errors.emailTaken' }, values: { email, displayName } };
    }
    if (code === 'RATE_LIMITED') {
      return { error: 'errors.rateLimited', values: { email, displayName } };
    }
    if (code === 'VALIDATION_FAILED') {
      const fieldErrors = apiFieldErrors(details);
      return {
        fieldErrors,
        error: fieldErrors ? undefined : 'errors.generic',
        values: { email, displayName },
      };
    }
    return { error: 'errors.generic', values: { email, displayName } };
  }

  redirect(safeRedirectPath(next, locale));
}

/** Bound as `logoutAction.bind(null, locale)` and used as a `<form action>`. */
export async function logoutAction(locale: AppLocale): Promise<void> {
  await logout();
  redirect(`/${locale}`);
}
