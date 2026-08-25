import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

// Negotiates the locale and redirects unprefixed paths to the default (`/bn`).
// Next 16 renamed the `middleware` file convention to `proxy` (identical request
// API); next-intl's middleware function is used unchanged here.
export default createMiddleware(routing);

export const config = {
  // Run on every path except Next internals, API-style paths, and files with an
  // extension (e.g. favicon, images). Locale negotiation applies to page routes only.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
