import { getTranslations } from 'next-intl/server';

import { Link } from '@/i18n/navigation';

/**
 * Forward-only keyset pagination: a single link to the next page's cursor,
 * preserving the active category. Keyset cursors are forward-only, so there is
 * no "previous" — this advances the list rather than accumulating it (a
 * progressively-enhanced accumulator is a later increment; see ADR-009).
 */
export async function Pagination({
  nextCursor,
  category,
}: {
  nextCursor: string;
  category?: string;
}) {
  const t = await getTranslations('discover');
  const params = new URLSearchParams();
  params.set('cursor', nextCursor);
  if (category) params.set('category', category);

  return (
    <div className="flex justify-center pt-2">
      <Link
        href={`/campaigns?${params.toString()}`}
        className="rounded-full border border-black/15 px-6 py-2.5 text-sm font-medium transition hover:border-black/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        {t('loadMore')}
      </Link>
    </div>
  );
}
