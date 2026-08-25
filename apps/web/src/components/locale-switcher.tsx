'use client';

import { useTransition } from 'react';
import type { Locale } from '@helpkoro/ui';
import { usePathname, useRouter } from '../i18n/navigation';
import { routing } from '../i18n/routing';

const LABELS: Record<Locale, string> = { bn: 'বাংলা', en: 'English' };

export function LocaleSwitcher({ current }: { current: Locale }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-1" role="group" aria-label="Language">
      {routing.locales.map((loc) => {
        const active = loc === current;
        return (
          <button
            key={loc}
            type="button"
            disabled={active || isPending}
            aria-current={active ? 'true' : undefined}
            onClick={() => startTransition(() => router.replace(pathname, { locale: loc }))}
            className={
              active
                ? 'rounded px-2 py-1 text-sm font-semibold text-neutral-900'
                : 'rounded px-2 py-1 text-sm text-neutral-500 hover:text-neutral-900'
            }
          >
            {LABELS[loc]}
          </button>
        );
      })}
    </div>
  );
}
