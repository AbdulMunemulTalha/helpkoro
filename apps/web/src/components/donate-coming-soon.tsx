import { getTranslations } from 'next-intl/server';

/**
 * Donations are off by design in Phase 1 (money movement is Validate-gated and
 * not built). This renders an honest, disabled call-to-action — never a live
 * checkout — so the detail page sets the right expectation without implying a
 * capability that does not exist.
 */
export async function DonateComingSoon() {
  const t = await getTranslations('campaign');

  return (
    <aside className="rounded-2xl border border-brand/20 bg-brand/5 p-5">
      <h2 className="text-base font-semibold">{t('donateSoonTitle')}</h2>
      <p className="mt-1 text-sm text-black/70">{t('donateSoonBody')}</p>
      <button
        type="button"
        disabled
        aria-disabled="true"
        className="mt-4 w-full cursor-not-allowed rounded-full bg-brand/40 px-6 py-3 font-medium text-brand-contrast"
      >
        {t('donateSoonCta')}
      </button>
    </aside>
  );
}
