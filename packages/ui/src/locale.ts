/**
 * Locale + text-direction seam. HelpKoro launches in Bangla and English, both
 * of which are left-to-right. `localeDirection` is the single place a future
 * right-to-left locale would be wired in; components use logical CSS
 * properties (`ps-*`/`pe-*`) so they stay correct if that happens.
 */
export type Locale = 'bn' | 'en';
export type Direction = 'ltr' | 'rtl';

export const DEFAULT_LOCALE: Locale = 'bn';
export const SUPPORTED_LOCALES: readonly Locale[] = ['bn', 'en'];

const LOCALE_DIRECTION: Record<Locale, Direction> = {
  bn: 'ltr',
  en: 'ltr',
};

export function localeDirection(locale: Locale): Direction {
  return LOCALE_DIRECTION[locale];
}

export function isLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}
