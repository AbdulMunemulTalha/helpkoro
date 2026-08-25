import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { isAppError, type CampaignOrganizerView } from '@helpkoro/contracts';

import { MoneyAmount } from '@/components/money-amount';
import { StateBadge } from '@/components/state-badge';
import { SubmitButton } from '@/components/submit-button';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import { logoutAction } from '@/lib/actions/auth-actions';
import { getCurrentUser } from '@/lib/api/auth';
import { listOrganizerCampaigns } from '@/lib/api/campaigns';

type PageProps = {
  params: Promise<{ locale: AppLocale }>;
  searchParams: Promise<{ created?: string }>;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: AppLocale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'dashboard' });
  return { title: t('title') };
}

const LOGIN_NEXT = `/login?next=${encodeURIComponent('/dashboard')}`;

// Auth-gated + per-user: never prerender a static shell. Without this, Next 16
// flushes a prerendered shell before the cookie-based `redirect()` resolves, so an
// anonymous request degrades to a 1s `<meta refresh>` instead of a clean 307. Forcing
// dynamic rendering lets `redirect()` emit a real HTTP redirect to the login page.
export const dynamic = 'force-dynamic';

export default async function DashboardPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const { created } = await searchParams;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}${LOGIN_NEXT}`);

  let campaigns: CampaignOrganizerView[] = [];
  try {
    const page = await listOrganizerCampaigns({ limit: 50 });
    campaigns = page.items;
  } catch (err) {
    // A session that lapsed between the /me read and this call → back to login.
    if (isAppError(err) && err.code === 'AUTH_REQUIRED') {
      redirect(`/${locale}${LOGIN_NEXT}`);
    }
    throw err;
  }

  const t = await getTranslations('dashboard');
  const logout = logoutAction.bind(null, locale);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t('title')}</h1>
          <p className="mt-1 text-sm text-neutral-600">{t('greeting', { name: user.displayName })}</p>
        </div>
        <form action={logout}>
          <SubmitButton variant="ghost" pendingLabel={t('loggingOut')}>
            {t('logout')}
          </SubmitButton>
        </form>
      </div>

      {created === '1' ? (
        <p
          role="status"
          className="mt-6 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
        >
          {t('launchedBanner')}
        </p>
      ) : null}

      <div className="mt-6 flex flex-col gap-3 rounded-xl border border-black/10 bg-neutral-50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-neutral-700">{t('startPrompt')}</p>
        <Link
          href="/start"
          className="w-fit shrink-0 rounded-md bg-brand px-4 py-2 text-sm font-medium text-brand-contrast transition hover:opacity-90"
        >
          {t('startCta')}
        </Link>
      </div>

      <h2 className="mt-10 text-lg font-semibold">{t('yourCampaigns')}</h2>
      {campaigns.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-black/15 p-8 text-center text-sm text-neutral-600">
          {t('empty')}
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {campaigns.map((campaign) => (
            <li
              key={campaign.id}
              className="flex flex-col gap-3 rounded-xl border border-black/10 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <StateBadge state={campaign.state} />
                <h3 className="mt-2 truncate text-base font-medium">{campaign.title}</h3>
                <p className="mt-1 text-sm text-neutral-600">{t(`nextSteps.${campaign.state}`)}</p>
              </div>
              <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end">
                <MoneyAmount
                  minorUnits={campaign.goalAmount}
                  currency={campaign.currency}
                  locale={locale}
                  className="text-sm font-semibold"
                />
                {campaign.state === 'live' ? (
                  <Link
                    href={`/campaigns/${campaign.slug}`}
                    className="text-sm font-medium text-brand hover:underline"
                  >
                    {t('viewPublic')}
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
