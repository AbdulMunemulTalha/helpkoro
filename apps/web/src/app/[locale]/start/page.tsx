import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { StartWizard } from '@/components/start-wizard';
import type { AppLocale } from '@/i18n/routing';
import { getCurrentUser } from '@/lib/api/auth';
import { launchCampaignAction } from './actions';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: AppLocale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'start' });
  return { title: t('title') };
}

export default async function StartPage({ params }: { params: Promise<{ locale: AppLocale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Drives the account step: authenticated organizers skip straight through.
  const isAuthenticated = Boolean(await getCurrentUser());
  const action = launchCampaignAction.bind(null, locale);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <StartWizard locale={locale} isAuthenticated={isAuthenticated} action={action} />
    </div>
  );
}
