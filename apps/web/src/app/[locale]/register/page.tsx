import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { AuthForm } from '@/components/auth-form';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import { registerAction } from '@/lib/actions/auth-actions';
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
  return { title: t('registerTitle') };
}

export default async function RegisterPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const { next } = await searchParams;
  setRequestLocale(locale);

  if (await getCurrentUser()) redirect(safeRedirectPath(next, locale));

  const t = await getTranslations('auth');
  const action = registerAction.bind(null, locale, next);
  const loginHref = next ? `/login?next=${encodeURIComponent(next)}` : '/login';

  return (
    <div className="mx-auto w-full max-w-md px-4 py-12">
      <h1 className="text-2xl font-semibold">{t('registerTitle')}</h1>
      <p className="mt-1 text-sm text-neutral-600">{t('registerSubtitle')}</p>
      <div className="mt-6">
        <AuthForm mode="register" action={action} />
      </div>
      <p className="mt-6 text-sm text-neutral-600">
        {t('haveAccount')}{' '}
        <Link href={loginHref} className="font-medium text-brand hover:underline">
          {t('loginCta')}
        </Link>
      </p>
    </div>
  );
}
