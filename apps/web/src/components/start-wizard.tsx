'use client';

import { useActionState, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { campaignCategorySchema } from '@helpkoro/contracts';
import { Button } from '@helpkoro/ui';

import { Field } from './field';
import { SubmitButton } from './submit-button';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import type { LaunchFormState } from '@/lib/launch';

type LaunchAction = (state: LaunchFormState, formData: FormData) => Promise<LaunchFormState>;

interface Draft {
  beneficiaryType: 'myself' | 'someone_else' | 'organization';
  beneficiaryRelationship: string;
  category: string;
  subcategory: string;
  title: string;
  summary: string;
  goalMajor: string;
  currency: string;
  primaryLanguage: 'bn' | 'en';
  story: string;
  intendedUse: string;
  timeline: string;
}

const STORAGE_KEY = 'helpkoro:start-draft';
const STEP_COUNT = 6; // intro, beneficiary, cause+goal, account, story, review
const EMPTY_STATE: LaunchFormState = {};

const inputCls =
  'rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-brand';

function makeDefaultDraft(locale: AppLocale): Draft {
  return {
    beneficiaryType: 'myself',
    beneficiaryRelationship: '',
    category: 'medical',
    subcategory: '',
    title: '',
    summary: '',
    goalMajor: '',
    currency: 'BDT',
    primaryLanguage: locale,
    story: '',
    intendedUse: '',
    timeline: '',
  };
}

/** Convert a major-unit amount to integer minor units using the currency's
 * Intl-derived exponent — never a hardcoded 2 decimals. */
function minorUnitsFromMajor(major: number, currency: string): number {
  let exponent = 2;
  try {
    exponent =
      new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions()
        .maximumFractionDigits ?? 2;
  } catch {
    exponent = 2;
  }
  return Math.round(major * 10 ** exponent);
}

function buildPayload(draft: Draft): Record<string, unknown> {
  const major = Number(draft.goalMajor);
  const goalAmount = Number.isFinite(major) && major > 0 ? minorUnitsFromMajor(major, draft.currency) : 0;
  const payload: Record<string, unknown> = {
    title: draft.title.trim(),
    summary: draft.summary.trim(),
    category: draft.category,
    beneficiaryType: draft.beneficiaryType,
    goalAmount,
    currency: draft.currency,
    primaryLanguage: draft.primaryLanguage,
  };
  if (draft.subcategory.trim()) payload.subcategory = draft.subcategory.trim();
  if (draft.beneficiaryType === 'someone_else' && draft.beneficiaryRelationship.trim()) {
    payload.beneficiaryRelationship = draft.beneficiaryRelationship.trim();
  }
  if (draft.story.trim()) payload.story = draft.story.trim();
  if (draft.intendedUse.trim()) payload.intendedUse = draft.intendedUse.trim();
  if (draft.timeline.trim()) payload.timeline = draft.timeline.trim();
  return payload;
}

/** Lightweight per-step validation (UX only; the server re-validates authoritatively). */
function validateStep(step: number, draft: Draft): Record<string, string> {
  const e: Record<string, string> = {};
  if (step === 1 && draft.beneficiaryType === 'someone_else' && !draft.beneficiaryRelationship.trim()) {
    e.beneficiaryRelationship = 'errors.relationshipRequired';
  }
  if (step === 2) {
    const title = draft.title.trim();
    if (title.length < 8 || title.length > 120) e.title = 'errors.title';
    const summary = draft.summary.trim();
    if (summary.length < 20 || summary.length > 300) e.summary = 'errors.summary';
    const major = Number(draft.goalMajor);
    if (!Number.isFinite(major) || major <= 0) e.goalAmount = 'errors.goal';
  }
  return e;
}

export function StartWizard({
  locale,
  isAuthenticated,
  action,
}: {
  locale: AppLocale;
  isAuthenticated: boolean;
  action: LaunchAction;
}) {
  const t = useTranslations('start');
  const tc = useTranslations('categories');
  const [draft, setDraft] = useState<Draft>(() => makeDefaultDraft(locale));
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [hydrated, setHydrated] = useState(false);
  const [state, formAction] = useActionState(action, EMPTY_STATE);

  // Restore any in-progress draft (survives a detour to log in / register).
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { draft?: Partial<Draft>; step?: number };
        if (saved.draft) setDraft((d) => ({ ...d, ...saved.draft }));
        if (typeof saved.step === 'number') setStep(Math.min(Math.max(saved.step, 0), STEP_COUNT - 1));
      }
    } catch {
      // Ignore malformed storage — start fresh.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ draft, step }));
    } catch {
      // Storage unavailable (private mode / quota) — non-fatal.
    }
  }, [draft, step, hydrated]);

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function goNext() {
    const stepErrors = validateStep(step, draft);
    setErrors(stepErrors);
    if (Object.keys(stepErrors).length === 0) setStep((s) => Math.min(s + 1, STEP_COUNT - 1));
  }

  function goBack() {
    setErrors({});
    setStep((s) => Math.max(s - 1, 0));
  }

  const fieldError = (key: string) => (errors[key] ? t(errors[key]) : undefined);
  const startNext = `/login?next=${encodeURIComponent('/start')}`;
  const registerNext = `/register?next=${encodeURIComponent('/start')}`;

  // Terminal panels replace the wizard body; a plain 'error' is shown inline on
  // the review step so the organizer can retry without losing their draft.
  const terminal = state.status && state.status !== 'error' ? state.status : null;
  if (terminal) {
    return <ResultPanel status={terminal} loginHref={startNext} t={t} />;
  }

  return (
    <div>
      <p className="text-sm font-medium text-brand">{t('stepProgress', { current: step + 1, total: STEP_COUNT })}</p>
      <h1 className="mt-1 text-2xl font-semibold">{t('title')}</h1>

      <div className="mt-6">
        {step === 0 ? (
          <section aria-label={t('intro.heading')} className="space-y-3">
            <h2 className="text-lg font-semibold">{t('intro.heading')}</h2>
            <p className="text-sm text-neutral-600">{t('intro.body')}</p>
          </section>
        ) : null}

        {step === 1 ? (
          <fieldset className="space-y-4">
            <legend className="text-lg font-semibold">{t('beneficiary.legend')}</legend>
            <div className="space-y-2" role="radiogroup" aria-label={t('beneficiary.legend')}>
              {(['myself', 'someone_else', 'organization'] as const).map((value) => (
                <label
                  key={value}
                  className="flex items-center gap-3 rounded-md border border-neutral-200 px-3 py-2 text-sm"
                >
                  <input
                    type="radio"
                    name="beneficiaryType"
                    value={value}
                    checked={draft.beneficiaryType === value}
                    onChange={() => update('beneficiaryType', value)}
                  />
                  {t(`beneficiary.${value}`)}
                </label>
              ))}
            </div>
            {draft.beneficiaryType === 'someone_else' ? (
              <Field
                id="beneficiaryRelationship"
                label={t('beneficiary.relationshipLabel')}
                value={draft.beneficiaryRelationship}
                onChange={(e) => update('beneficiaryRelationship', e.target.value)}
                error={fieldError('beneficiaryRelationship')}
                maxLength={120}
              />
            ) : null}
            {draft.beneficiaryType === 'organization' ? (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
                {t('beneficiary.orgNote')}
              </p>
            ) : null}
          </fieldset>
        ) : null}

        {step === 2 ? (
          <fieldset className="space-y-4">
            <legend className="text-lg font-semibold">{t('cause.legend')}</legend>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="category" className="text-sm font-medium text-neutral-800">
                {t('cause.categoryLabel')}
              </label>
              <select
                id="category"
                className={inputCls}
                value={draft.category}
                onChange={(e) => update('category', e.target.value)}
              >
                {campaignCategorySchema.options.map((option) => (
                  <option key={option} value={option}>
                    {tc(option)}
                  </option>
                ))}
              </select>
            </div>
            <Field
              id="title"
              label={t('cause.titleLabel')}
              value={draft.title}
              onChange={(e) => update('title', e.target.value)}
              error={fieldError('title')}
              maxLength={120}
            />
            <div className="flex flex-col gap-1.5">
              <label htmlFor="summary" className="text-sm font-medium text-neutral-800">
                {t('cause.summaryLabel')}
              </label>
              <textarea
                id="summary"
                className={inputCls}
                rows={3}
                maxLength={300}
                value={draft.summary}
                onChange={(e) => update('summary', e.target.value)}
                aria-invalid={errors.summary ? true : undefined}
              />
              {errors.summary ? (
                <p role="alert" className="text-sm text-red-600">
                  {t(errors.summary)}
                </p>
              ) : null}
            </div>
            <Field
              id="goalAmount"
              type="number"
              inputMode="numeric"
              min={1}
              label={t('cause.goalLabel', { currency: draft.currency })}
              value={draft.goalMajor}
              onChange={(e) => update('goalMajor', e.target.value)}
              error={fieldError('goalAmount')}
            />
          </fieldset>
        ) : null}

        {step === 3 ? (
          <section aria-label={t('account.legend')} className="space-y-4">
            <h2 className="text-lg font-semibold">{t('account.legend')}</h2>
            {isAuthenticated ? (
              <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
                {t('account.signedIn')}
              </p>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-neutral-600">{t('account.needAccount')}</p>
                <div className="flex flex-wrap gap-3">
                  <Link
                    href={registerNext}
                    className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-brand-contrast transition hover:opacity-90"
                  >
                    {t('account.register')}
                  </Link>
                  <Link
                    href={startNext}
                    className="rounded-md border border-brand px-4 py-2 text-sm font-medium text-brand transition hover:bg-brand/5"
                  >
                    {t('account.login')}
                  </Link>
                </div>
                <p className="text-xs text-neutral-500">{t('account.progressSaved')}</p>
              </div>
            )}
          </section>
        ) : null}

        {step === 4 ? (
          <fieldset className="space-y-4">
            <legend className="text-lg font-semibold">{t('story.legend')}</legend>
            <p className="text-sm text-neutral-500">{t('story.optionalHint')}</p>
            {(
              [
                { key: 'story', rows: 6, max: 20000 },
                { key: 'intendedUse', rows: 3, max: 2000 },
                { key: 'timeline', rows: 2, max: 2000 },
              ] as const
            ).map(({ key, rows, max }) => (
              <div key={key} className="flex flex-col gap-1.5">
                <label htmlFor={key} className="text-sm font-medium text-neutral-800">
                  {t(`story.${key}Label`)}
                </label>
                <textarea
                  id={key}
                  className={inputCls}
                  rows={rows}
                  maxLength={max}
                  value={draft[key]}
                  onChange={(e) => update(key, e.target.value)}
                />
              </div>
            ))}
          </fieldset>
        ) : null}

        {step === 5 ? (
          <section aria-label={t('review.legend')} className="space-y-4">
            <h2 className="text-lg font-semibold">{t('review.legend')}</h2>
            <dl className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 text-sm">
              <Row label={t('cause.titleLabel')} value={draft.title} />
              <Row label={t('cause.categoryLabel')} value={tc(draft.category)} />
              <Row label={t('beneficiary.legend')} value={t(`beneficiary.${draft.beneficiaryType}`)} />
              <Row label={t('cause.goalLabel', { currency: draft.currency })} value={draft.goalMajor} />
            </dl>

            <div className="space-y-2 rounded-md bg-neutral-50 p-3 text-sm text-neutral-600">
              <p className="font-medium text-neutral-700">{t('deferred.title')}</p>
              <p>{t('deferred.payout')}</p>
              <p>{t('deferred.media')}</p>
            </div>

            {state.status === 'error' ? (
              <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {t(state.error ?? 'errors.generic')}
              </p>
            ) : null}

            <form action={formAction}>
              <input type="hidden" name="payload" value={JSON.stringify(buildPayload(draft))} />
              <SubmitButton pendingLabel={t('review.launching')} className="w-full">
                {t('review.launchCta')}
              </SubmitButton>
            </form>
          </section>
        ) : null}
      </div>

      {step < 5 ? (
        <div className="mt-8 flex items-center justify-between">
          <Button variant="ghost" onClick={goBack} disabled={step === 0}>
            {t('back')}
          </Button>
          <Button
            onClick={goNext}
            disabled={step === 3 && !isAuthenticated}
            aria-disabled={step === 3 && !isAuthenticated}
          >
            {t('next')}
          </Button>
        </div>
      ) : (
        <div className="mt-8">
          <Button variant="ghost" onClick={goBack}>
            {t('back')}
          </Button>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 px-3 py-2">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="text-end font-medium text-neutral-900">{value || '—'}</dd>
    </div>
  );
}

function ResultPanel({
  status,
  loginHref,
  t,
}: {
  status: Exclude<NonNullable<LaunchFormState['status']>, 'error'>;
  loginHref: string;
  t: ReturnType<typeof useTranslations>;
}) {
  const copy: Record<typeof status, { title: string; body: string }> = {
    disabled: { title: t('result.disabledTitle'), body: t('result.disabledBody') },
    forbidden: { title: t('result.forbiddenTitle'), body: t('result.forbiddenBody') },
    auth: { title: t('result.authTitle'), body: t('result.authBody') },
    draftSaved: { title: t('result.draftSavedTitle'), body: t('result.draftSavedBody') },
  };
  const { title, body } = copy[status];

  return (
    <div className="rounded-2xl border border-black/10 p-8 text-center">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-neutral-600">{body}</p>
      <div className="mt-6 flex justify-center">
        {status === 'auth' ? (
          <Link
            href={loginHref}
            className="rounded-md bg-brand px-5 py-2.5 text-sm font-medium text-brand-contrast transition hover:opacity-90"
          >
            {t('result.authCta')}
          </Link>
        ) : status === 'draftSaved' ? (
          <Link
            href="/dashboard"
            className="rounded-md bg-brand px-5 py-2.5 text-sm font-medium text-brand-contrast transition hover:opacity-90"
          >
            {t('result.goToDashboard')}
          </Link>
        ) : (
          <Link
            href="/campaigns"
            className="rounded-md border border-brand px-5 py-2.5 text-sm font-medium text-brand transition hover:bg-brand/5"
          >
            {t('result.backToCampaigns')}
          </Link>
        )}
      </div>
    </div>
  );
}
