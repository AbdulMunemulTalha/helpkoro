import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { localeDirection } from '@helpkoro/ui';
import { routing } from '../../i18n/routing';
import { SiteHeader } from '../../components/site-header';
import { SiteFooter } from '../../components/site-footer';
import '../globals.css';

export const metadata: Metadata = {
  title: { default: 'HelpKoro', template: '%s · HelpKoro' },
  description: 'Trusted, Bangladesh-first fundraising for personal, community, and emergency needs.',
};

// Pre-render both locale shells at build time.
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  // Enable static rendering for this request tree.
  setRequestLocale(locale);

  return (
    <html lang={locale} dir={localeDirection(locale)}>
      <body className="bg-white text-neutral-900 antialiased">
        <NextIntlClientProvider>
          <div className="flex min-h-dvh flex-col">
            <SiteHeader locale={locale} />
            <main className="flex-1">{children}</main>
            <SiteFooter />
          </div>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
