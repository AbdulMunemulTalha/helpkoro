import 'server-only';

import {
  AppError,
  type CampaignOrganizerView,
  type CampaignPublicView,
  type CampaignSummary,
  type CreateCampaignDraftInput,
  type Page,
} from '@helpkoro/contracts';

import { apiFetch, apiRequest, type ApiResult } from './client';
import { apiMutate } from './mutate';

export interface PublicListParams {
  limit?: number;
  cursor?: string;
  category?: string;
}

/** Public discovery list — only *live* campaigns (enforced server-side), summary view only. */
export async function listPublicCampaigns(
  params: PublicListParams = {},
): Promise<Page<CampaignSummary>> {
  return apiFetch<Page<CampaignSummary>>('/campaigns', {
    query: { limit: params.limit, cursor: params.cursor, category: params.category },
  });
}

/**
 * Public campaign detail by slug. Returns `null` for a missing *or* non-live
 * campaign: the API answers both with HTTP 404 (deliberately indistinguishable,
 * so a draft's existence never leaks), and the caller maps `null` → `notFound()`.
 * Any other failure is a real fault and propagates.
 */
export async function getPublicCampaign(slug: string): Promise<CampaignPublicView | null> {
  const result = await apiRequest<CampaignPublicView>(`/campaigns/${encodeURIComponent(slug)}`);
  if (result.ok) return result.data;
  if (result.status === 404) return null;
  throw new AppError(result.error.code, result.error.message, result.error.details);
}

export interface OrganizerListParams {
  limit?: number;
  cursor?: string;
  state?: string;
}

/**
 * The signed-in organizer's own campaigns (any state), richer organizer view.
 * Throws `AUTH_REQUIRED` when no valid session is forwarded — the dashboard
 * catches that and redirects to login.
 */
export async function listOrganizerCampaigns(
  params: OrganizerListParams = {},
): Promise<Page<CampaignOrganizerView>> {
  return apiFetch<Page<CampaignOrganizerView>>('/organizer/campaigns', {
    query: { limit: params.limit, cursor: params.cursor, state: params.state },
  });
}

/**
 * Create a campaign draft. Ships dark in Phase 1: with `campaigns.creation_enabled`
 * off, the API returns `FORBIDDEN` + `details.reason === 'FEATURE_DISABLED'`, which
 * the wizard renders as a graceful "not yet enabled" screen. Returns the raw result
 * so the caller can branch on that outcome vs. auth/validation failures.
 */
export async function createCampaignDraft(
  input: CreateCampaignDraftInput,
): Promise<ApiResult<CampaignOrganizerView>> {
  return apiMutate<CampaignOrganizerView>('/campaigns', { method: 'POST', body: input });
}

/** Submit an owned draft for review (draft → submitted). */
export async function submitCampaign(id: string): Promise<ApiResult<CampaignOrganizerView>> {
  return apiMutate<CampaignOrganizerView>(
    `/organizer/campaigns/${encodeURIComponent(id)}/submit`,
    { method: 'POST', body: {} },
  );
}
