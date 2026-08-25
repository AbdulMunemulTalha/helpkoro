import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { CampaignSummary } from '@helpkoro/contracts';

import { CampaignCard } from '@/components/campaign-card';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import { listPublicCampaigns } from '@/lib/api/campaigns';

export default async function HomePage({ params }: { params: Promise<{ locale: AppLocale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('home');
  const tDiscover = await getTranslations('discover');

  // The hero must render even if the API is unreachable, so a failed fetch
  // degrades to an empty featured grid rather than the whole page erroring.
  let featured: CampaignSummary[] = [];
  try {
    const page = await listPublicCampaigns({ limit: 6 });
    featured = page.items;
  } catch {
    featured = [];
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4">
      <section className="py-14 text-center sm:py-20">
        <h1 className="text-3xl font-bold tracking-tight text-balance sm:text-5xl">{t('title')}</h1>
        <p className="mx-auto mt-4 max-w-2xl text-base text-black/70 text-pretty sm:text-lg">
          {t('subtitle')}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/campaigns"
            className="rounded-full bg-brand px-6 py-3 font-medium text-brand-contrast transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            {t('browseCta')}
          </Link>
          <Link
            href="/start"
            className="rounded-full border border-black/15 px-6 py-3 font-medium transition hover:border-black/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            {t('startCta')}
          </Link>
        </div>
      </section>

      <section className="pb-16">
        <div className="mb-6 flex items-baseline justify-between gap-4">
          <h2 className="text-xl font-semibold">{tDiscover('featuredHeading')}</h2>
          <Link
            href="/campaigns"
            className="text-sm font-medium text-brand hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            {tDiscover('viewAll')}
          </Link>
        </div>
        {featured.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-black/15 p-8 text-center text-black/60">
            {tDiscover('empty')}
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((campaign) => (
              <CampaignCard key={campaign.id} campaign={campaign} locale={locale} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
