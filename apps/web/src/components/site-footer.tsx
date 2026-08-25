import { getTranslations } from 'next-intl/server';

export async function SiteFooter() {
  const t = await getTranslations('common');

  return (
    <footer className="border-t border-neutral-200">
      <div className="mx-auto w-full max-w-5xl px-4 py-6 text-sm text-neutral-500">
        <p>{t('tagline')}</p>
        <p className="mt-1">© HelpKoro</p>
      </div>
    </footer>
  );
}
