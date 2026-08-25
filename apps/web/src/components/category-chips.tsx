import { getTranslations } from 'next-intl/server';
import { campaignCategorySchema } from '@helpkoro/contracts';

import { Link } from '@/i18n/navigation';

const CATEGORIES = campaignCategorySchema.options;

function ChipLink({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={
        active
          ? 'rounded-full bg-brand px-4 py-1.5 text-sm font-medium text-brand-contrast'
          : 'rounded-full border border-black/15 px-4 py-1.5 text-sm text-black/70 transition hover:border-black/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand'
      }
    >
      {label}
    </Link>
  );
}

/**
 * Category filter as plain locale-aware links (no client JS) — selecting one
 * navigates to `/campaigns?category=…`. Forward-only pagination resets when the
 * category changes because the cursor is not carried across chips.
 */
export async function CategoryChips({ selected }: { selected?: string }) {
  const t = await getTranslations('categories');
  const tDiscover = await getTranslations('discover');

  return (
    <nav aria-label={tDiscover('filterLabel')} className="flex flex-wrap gap-2">
      <ChipLink href="/campaigns" active={!selected} label={tDiscover('allCategories')} />
      {CATEGORIES.map((category) => (
        <ChipLink
          key={category}
          href={`/campaigns?category=${category}`}
          active={selected === category}
          label={t(category)}
        />
      ))}
    </nav>
  );
}
