import { getTranslations, setRequestLocale } from 'next-intl/server';
import { campaignCategorySchema } from '@helpkoro/contracts';

import { CampaignCard } from '@/components/campaign-card';
import { CategoryChips } from '@/components/category-chips';
import { Pagination } from '@/components/pagination';
import type { AppLocale } from '@/i18n/routing';
import { listPublicCampaigns } from '@/lib/api/campaigns';

const PAGE_SIZE = 12;

export default async function CampaignsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: AppLocale }>;
  searchParams: Promise<{ category?: string; cursor?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;

  // Only forward a category the contract recognises; anything else is dropped
  // (the API would reject it, and this keeps the active-chip state honest).
  const category = campaignCategorySchema.safeParse(sp.category).success ? sp.category : undefined;
  const cursor = typeof sp.cursor === 'string' && sp.cursor.length > 0 ? sp.cursor : undefined;

  const t = await getTranslations('discover');
  const page = await listPublicCampaigns({ limit: PAGE_SIZE, cursor, category });

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-bold sm:text-3xl">{t('heading')}</h1>
        <p className="mt-1 text-black/70">{t('subheading')}</p>
      </header>

      <div className="mb-8">
        <CategoryChips selected={category} />
      </div>

      {page.items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-black/15 p-10 text-center text-black/60">
          {t('empty')}
        </p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {page.items.map((campaign) => (
              <CampaignCard key={campaign.id} campaign={campaign} locale={locale} />
            ))}
          </div>
          {page.pageInfo.hasMore && page.pageInfo.nextCursor ? (
            <div className="mt-10">
              <Pagination nextCursor={page.pageInfo.nextCursor} category={category} />
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
