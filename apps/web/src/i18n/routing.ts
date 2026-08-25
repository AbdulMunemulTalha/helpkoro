import { defineRouting } from 'next-intl/routing';

/**
 * Path-prefixed bilingual routing (`/bn`, `/en`). Bangla is the default locale
 * (Bangladesh-first, ADR-004/ADR-009).
 *
 * The locale list intentionally mirrors `@helpkoro/ui`'s `SUPPORTED_LOCALES` /
 * `DEFAULT_LOCALE`. It is duplicated here rather than imported so the middleware
 * (which runs on the edge/runtime) stays free of the React UI bundle. If a locale
 * is ever added, update both places.
 */
export const routing = defineRouting({
  locales: ['bn', 'en'],
  defaultLocale: 'bn',
  localePrefix: 'always',
});

export type AppLocale = (typeof routing.locales)[number];
