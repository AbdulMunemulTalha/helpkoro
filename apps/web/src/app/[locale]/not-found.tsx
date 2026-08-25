import Link from 'next/link';

/**
 * Locale-scoped 404. Kept translation-free (bilingual static text) so it renders
 * correctly regardless of i18n request context — e.g. for an unknown campaign slug
 * or any unmatched path under a valid locale prefix.
 */
export default function NotFound() {
  return (
    <section className="mx-auto w-full max-w-2xl px-4 py-20 text-center">
      <h1 className="text-2xl font-bold">Page not found · পৃষ্ঠাটি খুঁজে পাওয়া যায়নি</h1>
      <p className="mt-3 text-neutral-600">
        The page you’re looking for doesn’t exist or is no longer available. · আপনি যে পৃষ্ঠাটি খুঁজছেন
        তা নেই বা আর উপলব্ধ নয়।
      </p>
      <Link href="/" className="mt-6 inline-block font-semibold text-brand underline">
        HelpKoro
      </Link>
    </section>
  );
}
