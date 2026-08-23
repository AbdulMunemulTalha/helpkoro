import type { ReactNode } from 'react';
import { localeDirection, type Locale } from './locale';

export interface LocaleRootProps {
  locale: Locale;
  children: ReactNode;
  className?: string;
}

/**
 * Wraps a subtree with the correct `lang` and `dir` attributes for the active
 * locale, so descendant components inherit direction from the DOM rather than
 * hardcoding it.
 */
export function LocaleRoot({ locale, children, className }: LocaleRootProps) {
  return (
    <div lang={locale} dir={localeDirection(locale)} className={className}>
      {children}
    </div>
  );
}
