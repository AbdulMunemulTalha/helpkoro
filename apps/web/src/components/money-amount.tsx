import { formatMoney } from '@/lib/format';
import type { AppLocale } from '@/i18n/routing';

/** Renders integer minor units as locale-native currency (Bengali digits for bn). */
export function MoneyAmount({
  minorUnits,
  currency,
  locale,
  className,
}: {
  minorUnits: number;
  currency: string;
  locale: AppLocale;
  className?: string;
}) {
  return <span className={className}>{formatMoney(minorUnits, currency, locale)}</span>;
}
