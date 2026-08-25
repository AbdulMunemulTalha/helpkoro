import { getTranslations } from 'next-intl/server';
import type { CampaignSummary } from '@helpkoro/contracts';

import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import { MoneyAmount } from './money-amount';

/**
 * Discovery card for a public campaign summary. Renders only `CampaignSummary`
 * fields — no progress bar or verified badge (neither exists in the Phase-1
 * contract; we do not fabricate them).
 */
export async function CampaignCard({
  campaign,
  locale,
}: {
  campaign: CampaignSummary;
  locale: AppLocale;
}) {
  const t = await getTranslations('campaign');
  const tCat = await getTranslations('categories');

  return (
    <Link
      href={`/campaigns/${campaign.slug}`}
      className="group flex h-full flex-col gap-3 rounded-2xl border border-black/10 bg-white p-5 transition hover:border-black/20 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      <span className="inline-flex w-fit rounded-full bg-brand/10 px-3 py-1 text-xs font-medium text-brand">
        {tCat(campaign.category)}
      </span>
      <h3 className="text-lg font-semibold leading-snug text-balance">{campaign.title}</h3>
      <p className="line-clamp-3 text-sm text-black/70">{campaign.summary}</p>
      <p className="mt-auto pt-2 text-sm text-black/60">
        {t('goalLabel')}:{' '}
        <MoneyAmount
          minorUnits={campaign.goalAmount}
          currency={campaign.currency}
          locale={locale}
          className="font-semibold text-black/80"
        />
      </p>
    </Link>
  );
}
