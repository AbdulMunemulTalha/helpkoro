import { getTranslations } from 'next-intl/server';
import type { Locale } from '@helpkoro/ui';
import { Link } from '../i18n/navigation';
import { LocaleSwitcher } from './locale-switcher';

export async function SiteHeader({ locale }: { locale: Locale }) {
  const t = await getTranslations('nav');

  return (
    <header className="border-b border-neutral-200">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="text-lg font-bold text-brand">
          HelpKoro
        </Link>
        <nav className="flex items-center gap-4 text-sm" aria-label={t('home')}>
          <Link href="/campaigns" className="hover:underline">
            {t('discover')}
          </Link>
          <Link href="/start" className="hover:underline">
            {t('start')}
          </Link>
          <Link href="/dashboard" className="hover:underline">
            {t('dashboard')}
          </Link>
          <Link href="/login" className="hover:underline">
            {t('login')}
          </Link>
          <LocaleSwitcher current={locale} />
        </nav>
      </div>
    </header>
  );
}
