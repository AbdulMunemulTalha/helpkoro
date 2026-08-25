'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';

import { Field } from './field';
import { SubmitButton } from './submit-button';
import type { AuthFormState } from '@/lib/forms';

type AuthAction = (state: AuthFormState, formData: FormData) => Promise<AuthFormState>;

const EMPTY: AuthFormState = {};

/**
 * Shared login/register form. Receives an already-locale-bound server action as
 * a prop (the page binds it) and translates the message keys the action returns.
 * `noValidate` hands validation to the server action so the messaging stays
 * bilingual and consistent across client + server.
 */
export function AuthForm({ mode, action }: { mode: 'login' | 'register'; action: AuthAction }) {
  const t = useTranslations('auth');
  const [state, formAction] = useActionState(action, EMPTY);
  const isRegister = mode === 'register';

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {state.error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {t(state.error)}
        </p>
      ) : null}

      {isRegister ? (
        <Field
          id="displayName"
          name="displayName"
          label={t('displayName')}
          autoComplete="name"
          required
          defaultValue={state.values?.displayName ?? ''}
          error={state.fieldErrors?.displayName ? t(state.fieldErrors.displayName) : undefined}
        />
      ) : null}

      <Field
        id="email"
        name="email"
        type="email"
        inputMode="email"
        label={t('email')}
        autoComplete="email"
        required
        defaultValue={state.values?.email ?? ''}
        error={state.fieldErrors?.email ? t(state.fieldErrors.email) : undefined}
      />

      <Field
        id="password"
        name="password"
        type="password"
        label={t('password')}
        autoComplete={isRegister ? 'new-password' : 'current-password'}
        required
        minLength={12}
        hint={isRegister ? t('passwordHint') : undefined}
        error={state.fieldErrors?.password ? t(state.fieldErrors.password) : undefined}
      />

      <SubmitButton pendingLabel={t('submitting')} className="mt-2 w-full">
        {isRegister ? t('registerCta') : t('loginCta')}
      </SubmitButton>
    </form>
  );
}
