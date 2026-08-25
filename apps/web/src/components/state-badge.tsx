import { getTranslations } from 'next-intl/server';
import type { CampaignStateValue } from '@helpkoro/contracts';

/** Muted, colour-coded chip per lifecycle state. Colour is a hint, not the only
 * signal — the translated label carries the meaning (accessibility). */
const STATE_CLASSES: Record<CampaignStateValue, string> = {
  draft: 'bg-neutral-100 text-neutral-700',
  submitted: 'bg-amber-100 text-amber-800',
  under_review: 'bg-amber-100 text-amber-800',
  live: 'bg-green-100 text-green-800',
  paused: 'bg-blue-100 text-blue-800',
  closed: 'bg-neutral-200 text-neutral-700',
  rejected: 'bg-red-100 text-red-700',
};

export async function StateBadge({ state }: { state: CampaignStateValue }) {
  const t = await getTranslations('states');
  return (
    <span
      className={`inline-flex w-fit rounded-full px-2.5 py-0.5 text-xs font-medium ${STATE_CLASSES[state]}`}
    >
      {t(state)}
    </span>
  );
}
