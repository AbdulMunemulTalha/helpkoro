'use client';

import { useTranslations } from 'next-intl';

// Error boundaries must be Client Components. It renders inside the locale
// layout, so the NextIntlClientProvider context is available for translations.
export default function LocaleError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('common');

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-20 text-center">
      <h1 className="text-2xl font-semibold">{t('errorTitle')}</h1>
      <p className="mt-2 text-black/70">{t('errorBody')}</p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-full bg-brand px-6 py-2.5 font-medium text-brand-contrast transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        {t('retry')}
      </button>
    </div>
  );
}
