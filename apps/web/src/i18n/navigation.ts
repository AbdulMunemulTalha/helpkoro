import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

/**
 * Locale-aware navigation helpers. `Link`, `redirect`, `usePathname`, `useRouter`,
 * and `getPathname` automatically carry the active locale prefix, so callers use
 * bare paths like `/campaigns` and the current `/bn`·`/en` is applied for them.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
