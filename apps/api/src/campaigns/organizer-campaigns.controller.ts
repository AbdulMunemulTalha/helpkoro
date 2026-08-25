import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import {
  AppError,
  isUuid,
  organizerCampaignListQuery,
  updateCampaignDraftInputSchema,
  type CampaignOrganizerView,
  type OrganizerCampaignListQuery,
  type Page,
  type UpdateCampaignDraftInput,
} from '@helpkoro/contracts';
import { AuditService } from '../audit/audit.service';
import { RateLimit } from '../auth/auth.decorators';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CampaignsService } from './campaigns.service';

/**
 * Organizer-scoped campaign management (`/v1/organizer/campaigns`). All routes
 * require authentication (enforced by the global guards) but carry no
 * `@RequirePermission`: ownership and state are data-dependent, so the service
 * loads the row and runs the domain authorizer with the real owner id + state
 * (the guard cannot — it never loads the target). Keeping these off the public
 * `/v1/campaigns` path means a draft is unreachable by an anonymous visitor.
 */
@Controller('organizer/campaigns')
export class OrganizerCampaignsController {
  constructor(
    private readonly campaigns: CampaignsService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  async list(
    @Query(new ZodValidationPipe(organizerCampaignListQuery)) query: OrganizerCampaignListQuery,
    @Req() request: FastifyRequest,
  ): Promise<Page<CampaignOrganizerView>> {
    const principal = requirePrincipal(request);
    return this.campaigns.listOwned(principal, {
      limit: query.limit,
      cursor: query.cursor,
      state: query.state,
    });
  }

  @Get(':id')
  async detail(
    @Param('id') id: string,
    @Req() request: FastifyRequest,
  ): Promise<CampaignOrganizerView> {
    const principal = requirePrincipal(request);
    assertUuid(id);
    return this.campaigns.getOwnedById(principal, id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateCampaignDraftInputSchema)) body: UpdateCampaignDraftInput,
    @Req() request: FastifyRequest,
  ): Promise<CampaignOrganizerView> {
    const principal = requirePrincipal(request);
    assertUuid(id);
    const campaign = await this.campaigns.updateDraft(principal, id, body);
    await this.audit.record({
      action: 'campaign.updated',
      entityType: 'campaign',
      entityId: id,
      actorType: 'user',
      actorId: principal.userId,
      sourceSessionId: principal.sessionId,
      // Which fields changed — never the submitted content itself.
      afterSummary: { fields: Object.keys(body) },
    });
    return campaign;
  }

  @RateLimit({ limit: 20, windowSeconds: 3600, name: 'campaign.submit' })
  @HttpCode(200)
  @Post(':id/submit')
  async submit(
    @Param('id') id: string,
    @Req() request: FastifyRequest,
  ): Promise<CampaignOrganizerView> {
    const principal = requirePrincipal(request);
    assertUuid(id);
    const result = await this.campaigns.submit(principal, id);
    // Only audit a real submission — the idempotent no-op writes nothing.
    if (!result.alreadyOpen) {
      await this.audit.record({
        action: 'campaign.submitted',
        entityType: 'campaign',
        entityId: id,
        actorType: 'user',
        actorId: principal.userId,
        sourceSessionId: principal.sessionId,
        afterSummary: { reviewCaseId: result.reviewCaseId, state: result.campaign.state },
      });
    }
    return result.campaign;
  }
}

function requirePrincipal(request: FastifyRequest) {
  const principal = request.principal;
  if (!principal) {
    throw new AppError('AUTH_REQUIRED', 'Authentication required.');
  }
  return principal;
}

/** Reject a malformed id before it reaches a `uuid` column (avoids a DB type error). */
function assertUuid(id: string): void {
  if (!isUuid(id)) {
    throw new AppError('VALIDATION_FAILED', 'Invalid campaign id.', {
      fields: [{ path: 'id', message: 'must be a valid id' }],
    });
  }
}
