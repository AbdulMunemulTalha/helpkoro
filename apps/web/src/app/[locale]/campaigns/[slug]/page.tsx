import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { DonateComingSoon } from '@/components/donate-coming-soon';
import { MoneyAmount } from '@/components/money-amount';
import type { AppLocale } from '@/i18n/routing';
import { getPublicCampaign } from '@/lib/api/campaigns';
import { formatDate } from '@/lib/format';

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ locale: AppLocale; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  // A missing or non-live campaign resolves to null (API 404) → render the 404 boundary.
  const campaign = await getPublicCampaign(slug);
  if (!campaign) notFound();

  const t = await getTranslations('campaign');
  const tCat = await getTranslations('categories');
  const tBeneficiary = await getTranslations('campaign.beneficiary');

  return (
    <article className="mx-auto w-full max-w-5xl px-4 py-10">
      <div className="grid gap-10 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0">
          <span className="inline-flex rounded-full bg-brand/10 px-3 py-1 text-xs font-medium text-brand">
            {tCat(campaign.category)}
          </span>
          <h1 className="mt-3 text-2xl font-bold text-balance sm:text-3xl">{campaign.title}</h1>
          <p className="mt-3 text-lg text-black/75 text-pretty">{campaign.summary}</p>

          <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-2 text-sm text-black/60">
            <div>
              <dt className="inline">{t('byOrganizer')}: </dt>
              <dd className="inline font-medium text-black/80">{campaign.organizerDisplayName}</dd>
            </div>
            <div>
              <dt className="inline">{t('beneficiaryLabel')}: </dt>
              <dd className="inline font-medium text-black/80">
                {tBeneficiary(campaign.beneficiaryType)}
              </dd>
            </div>
            {campaign.publishedAt ? (
              <div>
                <dt className="inline">{t('publishedOn')}: </dt>
                <dd className="inline font-medium text-black/80">
                  {formatDate(campaign.publishedAt, locale)}
                </dd>
              </div>
            ) : null}
          </dl>

          {campaign.story ? (
            <section className="mt-8">
              <h2 className="text-lg font-semibold">{t('storyHeading')}</h2>
              <div className="mt-3 leading-relaxed whitespace-pre-line text-black/80">
                {campaign.story}
              </div>
            </section>
          ) : null}

          <section className="mt-10 rounded-2xl border border-black/10 bg-black/[0.02] p-4">
            <h2 className="text-sm font-semibold">{t('reportTitle')}</h2>
            <p className="mt-1 text-sm text-black/60">{t('reportBody')}</p>
          </section>
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-2xl border border-black/10 p-5">
            <p className="text-sm text-black/60">{t('goalLabel')}</p>
            <p className="mt-1 text-2xl font-bold">
              <MoneyAmount
                minorUnits={campaign.goalAmount}
                currency={campaign.currency}
                locale={locale}
              />
            </p>
          </div>
          <div className="mt-4">
            <DonateComingSoon />
          </div>
        </aside>
      </div>
    </article>
  );
}
