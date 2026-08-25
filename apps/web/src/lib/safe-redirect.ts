/**
 * Open-redirect-safe resolution of a post-auth `next` target.
 *
 * A `next` value is honoured only when it is an *internal* path: a single leading
 * slash, never protocol-relative (`//host`), absolute (`scheme://`), or a
 * backslash-smuggled variant. Anything else falls back to `fallback`. The result
 * is always prefixed with the active locale segment (routing uses
 * `localePrefix: 'always'`), stripping any locale already present so we never
 * emit `/bn/bn/...`. The return value is fed straight to `redirect()` from
 * `next/navigation`, so it must be a fully locale-prefixed absolute path.
 */
const LOCALES: readonly string[] = ['bn', 'en'];

function isInternalPath(value: string | null | undefined): value is string {
  return (
    typeof value === 'string' &&
    value.startsWith('/') &&
    !value.startsWith('//') &&
    !value.includes('\\') &&
    !value.includes('://')
  );
}

export function safeRedirectPath(
  next: string | null | undefined,
  locale: string,
  fallback = '/dashboard',
): string {
  const target = isInternalPath(next) ? next : fallback;
  const [, first = '', ...rest] = target.split('/');
  const withoutLocale = LOCALES.includes(first) ? `/${rest.join('/')}` : target;
  const normalized = withoutLocale === '/' ? '' : withoutLocale.replace(/\/+$/, '');
  return `/${locale}${normalized}`;
}
