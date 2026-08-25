import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { AuthForm } from '@/components/auth-form';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import { loginAction } from '@/lib/actions/auth-actions';
import { getCurrentUser } from '@/lib/api/auth';
import { safeRedirectPath } from '@/lib/safe-redirect';

type PageProps = {
  params: Promise<{ locale: AppLocale }>;
  searchParams: Promise<{ next?: string }>;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: AppLocale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth' });
  return { title: t('loginTitle') };
}

export default async function LoginPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const { next } = await searchParams;
  setRequestLocale(locale);

  // Already signed in → skip the form.
  if (await getCurrentUser()) redirect(safeRedirectPath(next, locale));

  const t = await getTranslations('auth');
  const action = loginAction.bind(null, locale, next);
  const registerHref = next ? `/register?next=${encodeURIComponent(next)}` : '/register';

  return (
    <div className="mx-auto w-full max-w-md px-4 py-12">
      <h1 className="text-2xl font-semibold">{t('loginTitle')}</h1>
      <p className="mt-1 text-sm text-neutral-600">{t('loginSubtitle')}</p>
      <div className="mt-6">
        <AuthForm mode="login" action={action} />
      </div>
      <p className="mt-6 text-sm text-neutral-600">
        {t('noAccount')}{' '}
        <Link href={registerHref} className="font-medium text-brand hover:underline">
          {t('registerCta')}
        </Link>
      </p>
    </div>
  );
}
