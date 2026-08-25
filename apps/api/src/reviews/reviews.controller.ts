import { Body, Controller, Get, HttpCode, Param, Post, Query, Req } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import {
  AppError,
  isUuid,
  reviewDecisionInputSchema,
  reviewQueueQuery,
  type Page,
  type ReviewCaseView,
  type ReviewDecisionInput,
  type ReviewQueueItem,
  type ReviewQueueQuery,
} from '@helpkoro/contracts';
import { ROLES } from '@helpkoro/domain';
import { AuditService } from '../audit/audit.service';
import { Roles } from '../auth/auth.decorators';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { ReviewsService } from './reviews.service';

/**
 * Reviewer workspace (`/v1/reviews`). The class-level `@Roles(REVIEWER)` gates
 * the entire surface — the authorization guard reads role metadata at the class
 * level, so no route here is reachable without the reviewer role. Reviewers see
 * the full campaign (organizer view + submitted snapshot); this is the internal
 * moderation boundary, deliberately richer than any public projection (ADR-008).
 *
 * High-impact decisions are human-only by construction: there is no auto-approve
 * or auto-reject path — a decision is always recorded against a real reviewer id.
 */
@Roles(ROLES.REVIEWER)
@Controller('reviews')
export class ReviewsController {
  constructor(
    private readonly reviews: ReviewsService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  async queue(
    @Query(new ZodValidationPipe(reviewQueueQuery)) query: ReviewQueueQuery,
  ): Promise<Page<ReviewQueueItem>> {
    return this.reviews.listQueue({ limit: query.limit, cursor: query.cursor });
  }

  @Get(':caseId')
  async detail(@Param('caseId') caseId: string): Promise<ReviewCaseView> {
    assertUuid(caseId);
    return this.reviews.getCase(caseId);
  }

  @HttpCode(200)
  @Post(':caseId/decision')
  async decide(
    @Param('caseId') caseId: string,
    @Body(new ZodValidationPipe(reviewDecisionInputSchema)) body: ReviewDecisionInput,
    @Req() request: FastifyRequest,
  ): Promise<ReviewCaseView> {
    const principal = requirePrincipal(request);
    assertUuid(caseId);
    const result = await this.reviews.decide(principal, caseId, body);
    await this.audit.record({
      action: 'campaign_review.decided',
      entityType: 'campaign',
      entityId: result.view.campaign.id,
      actorType: 'user',
      actorId: principal.userId,
      sourceSessionId: principal.sessionId,
      // The decision and the state move — never the reviewed content or the
      // organizer-facing explanation text.
      afterSummary: {
        caseId,
        decision: result.decision,
        reasonCode: result.reasonCode,
        fromState: result.fromState,
        toState: result.toState,
      },
    });
    return result.view;
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
    throw new AppError('VALIDATION_FAILED', 'Invalid review case id.', {
      fields: [{ path: 'caseId', message: 'must be a valid id' }],
    });
  }
}
