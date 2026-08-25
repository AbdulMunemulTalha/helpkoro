import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, desc, eq, gt, inArray, type SQL } from 'drizzle-orm';
import {
  campaigns,
  campaignSubmissions,
  reviewCases,
  reviewDecisions,
  type CampaignRow,
  type DatabaseHandle,
  type ReviewCaseRow,
} from '@helpkoro/db';
import {
  AppError,
  decodeCursor,
  uuidv7,
  type Page,
  type ReviewCaseView,
  type ReviewDecisionInput,
  type ReviewDecisionRecord,
  type ReviewQueueItem,
} from '@helpkoro/contracts';
import {
  campaignTransition,
  REVIEW_DECISION_CASE_STATUS,
  REVIEW_DECISION_EVENT,
  type CampaignState,
  type ReviewCaseStatus,
  type ReviewDecision,
} from '@helpkoro/domain';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { DATABASE } from '../infra/database.module';
import { pageOf } from '../common/keyset-pagination';
import { toOrganizerView } from '../campaigns/campaign.views';

/** Cases a reviewer can act on now. `needs_information` is awaiting the
 * organizer, `resolved` is done — neither belongs in the active queue. */
const OPEN_CASE_STATUSES: ReviewCaseStatus[] = ['queued', 'in_review'];

interface QueueArgs {
  limit: number;
  cursor?: string;
}

/** The outcome of a recorded decision — enough for the controller to audit
 * without re-deriving the transition. */
export interface DecideResult {
  view: ReviewCaseView;
  fromState: CampaignState;
  toState: CampaignState;
  decision: ReviewDecision;
  reasonCode: string;
}

/**
 * Reviewer-facing operations (ADR-008). The controller restricts the whole
 * surface to `@Roles(REVIEWER)`; this service owns the transaction that records
 * an **immutable** decision, advances the campaign through the domain state
 * machine, and resolves the review case — atomically, with optimistic guards so
 * two reviewers can never double-decide the same case. No money is touched.
 */
@Injectable()
export class ReviewsService {
  constructor(@Inject(DATABASE) private readonly handle: DatabaseHandle) {}

  private get db() {
    return this.handle.db;
  }

  /**
   * The active review queue: `queued` + `in_review` cases, oldest first. Keyset
   * pagination on the case id (UUIDv7 → time-ordered), so the FIFO order is
   * stable across pages even as new cases are opened.
   */
  async listQueue(args: QueueArgs): Promise<Page<ReviewQueueItem>> {
    const conditions: SQL[] = [inArray(reviewCases.status, OPEN_CASE_STATUSES)];
    const cursorId = args.cursor ? decodeCursor(args.cursor) : undefined;
    if (cursorId) conditions.push(gt(reviewCases.id, cursorId));

    const rows = await this.db
      .select({
        caseId: reviewCases.id,
        campaignId: reviewCases.campaignId,
        campaignTitle: campaigns.title,
        category: campaigns.category,
        status: reviewCases.status,
        priority: reviewCases.priority,
        openedAt: reviewCases.openedAt,
      })
      .from(reviewCases)
      .innerJoin(campaigns, eq(campaigns.id, reviewCases.campaignId))
      .where(and(...conditions))
      .orderBy(asc(reviewCases.id))
      .limit(args.limit + 1);

    return pageOf(
      rows,
      args.limit,
      (r): ReviewQueueItem => ({
        caseId: r.caseId,
        campaignId: r.campaignId,
        campaignTitle: r.campaignTitle,
        category: r.category,
        status: r.status,
        priority: r.priority,
        openedAt: r.openedAt.toISOString(),
      }),
      (r) => r.caseId,
    );
  }

  /** The reviewer's workspace for one case: submitted snapshot + current
   * campaign + full decision history. 404 if the case does not exist. */
  async getCase(caseId: string): Promise<ReviewCaseView> {
    const caseRow = await this.loadCaseOr404(caseId);
    return this.assembleView(caseRow);
  }

  /**
   * Record a reviewer decision. In one transaction: append an immutable
   * `review_decisions` row, apply the campaign lifecycle event (approve → live +
   * publishedAt, reject → rejected, request_info → case needs_information with no
   * publish/reject), and update the review case. Optimistic `WHERE status = …`
   * guards on both the campaign and the case make a concurrent second decision
   * fail cleanly with `STATE_CONFLICT` rather than clobbering the first.
   */
  async decide(
    principal: AuthenticatedPrincipal,
    caseId: string,
    input: ReviewDecisionInput,
  ): Promise<DecideResult> {
    const caseRow = await this.loadCaseOr404(caseId);
    if (caseRow.status === 'resolved') {
      throw new AppError('STATE_CONFLICT', 'This review case has already been resolved.', {
        reason: 'CASE_RESOLVED',
      });
    }

    const campaign = await this.loadCampaignOr404(caseRow.campaignId);
    const fromState = campaign.status;
    const event = REVIEW_DECISION_EVENT[input.decision];
    const toState = campaignTransition(fromState, event);
    if (toState === null) {
      // The campaign left the reviewable states (e.g. already decided). The
      // decision does not apply — surface a conflict, not a silent no-op.
      throw new AppError('STATE_CONFLICT', 'This campaign is not awaiting a review decision.', {
        reason: 'NOT_REVIEWABLE',
        state: fromState,
      });
    }
    const caseStatus = REVIEW_DECISION_CASE_STATUS[input.decision];
    const now = new Date();

    await this.db.transaction(async (tx) => {
      // Immutable, append-only audit of the decision itself.
      await tx.insert(reviewDecisions).values({
        id: uuidv7(),
        reviewCaseId: caseId,
        campaignId: campaign.id,
        reviewerId: principal.userId,
        decision: input.decision,
        reasonCode: input.reasonCode,
        organizerExplanation: input.organizerExplanation ?? null,
        evidenceRefs: input.evidenceRefs ?? null,
        decidedAt: now,
      });

      const [movedCampaign] = await tx
        .update(campaigns)
        .set({
          status: toState,
          updatedAt: now,
          // Publish timestamp is set once, on first approval.
          ...(toState === 'live' ? { publishedAt: campaign.publishedAt ?? now } : {}),
        })
        .where(and(eq(campaigns.id, campaign.id), eq(campaigns.status, fromState)))
        .returning();
      if (!movedCampaign) {
        throw new AppError('STATE_CONFLICT', 'This campaign is not awaiting a review decision.', {
          reason: 'NOT_REVIEWABLE',
        });
      }

      const [movedCase] = await tx
        .update(reviewCases)
        .set({
          status: caseStatus,
          assignedReviewerId: principal.userId,
          resolvedAt: caseStatus === 'resolved' ? now : null,
          version: caseRow.version + 1,
          updatedAt: now,
        })
        .where(and(eq(reviewCases.id, caseId), eq(reviewCases.status, caseRow.status)))
        .returning();
      if (!movedCase) {
        throw new AppError('STATE_CONFLICT', 'This review case was updated concurrently.', {
          reason: 'CASE_CONFLICT',
        });
      }
    });

    const view = await this.getCase(caseId);
    return { view, fromState, toState, decision: input.decision, reasonCode: input.reasonCode };
  }

  // --- Internal helpers -----------------------------------------------------

  private async loadCaseOr404(caseId: string): Promise<ReviewCaseRow> {
    const found = await this.db.query.reviewCases.findFirst({
      where: eq(reviewCases.id, caseId),
    });
    if (!found) {
      throw new NotFoundException('Review case not found.');
    }
    return found;
  }

  private async loadCampaignOr404(campaignId: string): Promise<CampaignRow> {
    const found = await this.db.query.campaigns.findFirst({
      where: eq(campaigns.id, campaignId),
    });
    if (!found) {
      throw new NotFoundException('Campaign not found.');
    }
    return found;
  }

  /** Compose the full case view from the case row (case + campaign + snapshot +
   * decision history). */
  private async assembleView(caseRow: ReviewCaseRow): Promise<ReviewCaseView> {
    const campaign = await this.loadCampaignOr404(caseRow.campaignId);

    const [snapshot] = await this.db
      .select({ snapshot: campaignSubmissions.snapshot })
      .from(campaignSubmissions)
      .where(eq(campaignSubmissions.campaignId, caseRow.campaignId))
      .orderBy(desc(campaignSubmissions.version))
      .limit(1);

    const decisionRows = await this.db
      .select()
      .from(reviewDecisions)
      .where(eq(reviewDecisions.reviewCaseId, caseRow.id))
      .orderBy(asc(reviewDecisions.decidedAt), asc(reviewDecisions.id));

    const decisions: ReviewDecisionRecord[] = decisionRows.map((d) => ({
      id: d.id,
      decision: d.decision,
      reasonCode: d.reasonCode,
      organizerExplanation: d.organizerExplanation,
      reviewerId: d.reviewerId,
      decidedAt: d.decidedAt.toISOString(),
    }));

    return {
      caseId: caseRow.id,
      status: caseRow.status,
      priority: caseRow.priority,
      assignedReviewerId: caseRow.assignedReviewerId,
      openedAt: caseRow.openedAt.toISOString(),
      resolvedAt: caseRow.resolvedAt ? caseRow.resolvedAt.toISOString() : null,
      campaign: toOrganizerView(campaign),
      submittedSnapshot: snapshot ? snapshot.snapshot : null,
      decisions,
    };
  }
}
