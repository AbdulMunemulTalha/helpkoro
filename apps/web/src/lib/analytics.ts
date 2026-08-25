import type { AppLocale } from '@/i18n/routing';

/**
 * Analytics event sink. Phase 1 ships a **no-op** sink; a real sink lands in a
 * later increment. Event shapes are deliberately constrained to non-sensitive
 * identifiers (slug, category, locale) — story text, identity, phone, and payout
 * data must never be sent to analytics (sensitive-data rule).
 */
export type AnalyticsEvent =
  | { name: 'discover_viewed'; category?: string }
  | { name: 'campaign_viewed'; slug: string; category: string }
  | { name: 'locale_switched'; to: AppLocale };

export function track(_event: AnalyticsEvent): void {
  // Intentional no-op in Phase 1. A real sink (and consent gating) is a later increment.
}
