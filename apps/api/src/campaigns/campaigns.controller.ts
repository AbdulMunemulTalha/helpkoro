import { Body, Controller, Get, HttpCode, Param, Post, Query, Req } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import {
  AppError,
  campaignListQuery,
  createCampaignDraftInputSchema,
  type CampaignListQuery,
  type CampaignOrganizerView,
  type CampaignPublicView,
  type CampaignSummary,
  type CreateCampaignDraftInput,
  type Page,
} from '@helpkoro/contracts';
import { PERMISSIONS } from '@helpkoro/domain';
import { AuditService } from '../audit/audit.service';
import { Public, RateLimit, RequirePermission } from '../auth/auth.decorators';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { CampaignsService } from './campaigns.service';

/** Feature flag gating campaign creation (seeded disabled; see ADR-008). */
const CREATION_FLAG = 'campaigns.creation_enabled';

/**
 * Public campaign discovery + campaign creation (`/v1/campaigns`). Discovery
 * routes are `@Public` and return only *live* campaigns via the public view
 * (no payout/evidence/private fields). Creation requires an authenticated actor
 * and is gated behind the `campaigns.creation_enabled` flag so the surface can
 * ship dark and be switched on per the rollout plan.
 *
 * Organizer-scoped reads/edits live on the separate `/v1/organizer/campaigns`
 * controller: keeping the paths apart means a draft can never leak through a
 * public route by id/slug manipulation.
 */
@Controller('campaigns')
export class CampaignsController {
  constructor(
    private readonly campaigns: CampaignsService,
    private readonly flags: FeatureFlagsService,
    private readonly audit: AuditService,
  ) {}

  @RequirePermission(PERMISSIONS.CAMPAIGN_CREATE.resource, PERMISSIONS.CAMPAIGN_CREATE.action)
  @RateLimit({ limit: 20, windowSeconds: 3600, name: 'campaign.create' })
  @Post()
  async create(
    @Body(new ZodValidationPipe(createCampaignDraftInputSchema)) body: CreateCampaignDraftInput,
    @Req() request: FastifyRequest,
  ): Promise<CampaignOrganizerView> {
    const principal = requirePrincipal(request);
    if (!(await this.flags.isEnabled(CREATION_FLAG))) {
      throw new AppError('FORBIDDEN', 'Campaign creation is not currently available.', {
        reason: 'FEATURE_DISABLED',
      });
    }

    const campaign = await this.campaigns.createDraft(principal, body);
    await this.audit.record({
      action: 'campaign.created',
      entityType: 'campaign',
      entityId: campaign.id,
      actorType: 'user',
      actorId: principal.userId,
      sourceSessionId: principal.sessionId,
      // Non-content fields only — no title/story/beneficiary free text in audit.
      afterSummary: {
        category: campaign.category,
        beneficiaryType: campaign.beneficiaryType,
        goalAmount: campaign.goalAmount,
        currency: campaign.currency,
        state: campaign.state,
      },
    });
    return campaign;
  }

  @Public()
  @Get()
  async list(
    @Query(new ZodValidationPipe(campaignListQuery)) query: CampaignListQuery,
  ): Promise<Page<CampaignSummary>> {
    return this.campaigns.listPublic({
      limit: query.limit,
      cursor: query.cursor,
      category: query.category,
    });
  }

  @Public()
  @HttpCode(200)
  @Get(':slug')
  async detail(@Param('slug') slug: string): Promise<CampaignPublicView> {
    return this.campaigns.getPublicBySlug(slug);
  }
}

function requirePrincipal(request: FastifyRequest) {
  const principal = request.principal;
  if (!principal) {
    throw new AppError('AUTH_REQUIRED', 'Authentication required.');
  }
  return principal;
}
