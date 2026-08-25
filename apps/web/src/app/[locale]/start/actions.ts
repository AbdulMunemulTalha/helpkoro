'use server';

import { redirect } from 'next/navigation';
import { createCampaignDraftInputSchema } from '@helpkoro/contracts';

import type { AppLocale } from '@/i18n/routing';
import { createCampaignDraft, submitCampaign } from '@/lib/api/campaigns';
import type { LaunchFormState } from '@/lib/launch';

/**
 * Create a draft from the wizard's serialized payload, then submit it for
 * review. Bound as `launchCampaignAction.bind(null, locale)`. The payload is
 * re-validated here against the authoritative contract schema — the client
 * checks are only for UX. Money arrives as integer minor units (never a
 * client-trusted major-unit float re-derived server-side).
 */
export async function launchCampaignAction(
  locale: AppLocale,
  _prev: LaunchFormState,
  formData: FormData,
): Promise<LaunchFormState> {
  let payload: unknown;
  try {
    payload = JSON.parse(String(formData.get('payload') ?? 'null'));
  } catch {
    return { status: 'error', error: 'errors.invalidDraft' };
  }

  const parsed = createCampaignDraftInputSchema.safeParse(payload);
  if (!parsed.success) {
    return { status: 'error', error: 'errors.invalidDraft' };
  }

  const created = await createCampaignDraft(parsed.data);
  if (!created.ok) {
    const { code, details } = created.error;
    if (code === 'FORBIDDEN') {
      const reason = (details as { reason?: string } | undefined)?.reason;
      return { status: reason === 'FEATURE_DISABLED' ? 'disabled' : 'forbidden' };
    }
    if (code === 'AUTH_REQUIRED') return { status: 'auth' };
    return { status: 'error', error: 'errors.generic' };
  }

  const submitted = await submitCampaign(created.data.id);
  if (!submitted.ok) {
    // The draft exists and is safe in the organizer's dashboard; only the
    // submit-for-review step failed.
    return { status: 'draftSaved' };
  }

  redirect(`/${locale}/dashboard?created=1`);
}
