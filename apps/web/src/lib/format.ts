import type { AppLocale } from '@/i18n/routing';

/**
 * Locale-native formatting via `Intl`. Both are Bangladesh locales: `bn-BD`
 * renders Bengali numerals (০–৯) and lakh/crore grouping, `en-BD` renders
 * Western digits — the digit system is the only user-visible difference. The
 * currency exponent is derived from the ISO code (never hardcode BDT / 2
 * decimals — the money rule): the API sends integer minor units and the ISO
 * currency, and we render whatever it returns.
 */
const INTL_LOCALE: Record<AppLocale, string> = {
  bn: 'bn-BD',
  en: 'en-BD',
};

export function formatNumber(value: number, locale: AppLocale): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale]).format(value);
}

export function formatMoney(minorUnits: number, currency: string, locale: AppLocale): string {
  const formatter = new Intl.NumberFormat(INTL_LOCALE[locale], { style: 'currency', currency });
  const exponent = formatter.resolvedOptions().maximumFractionDigits ?? 2;
  const major = minorUnits / 10 ** exponent;
  return formatter.format(major);
}

export function formatDate(iso: string, locale: AppLocale): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}
