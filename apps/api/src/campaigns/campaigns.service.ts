import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, lt, ne, type SQL } from 'drizzle-orm';
import {
  campaigns,
  campaignSubmissions,
  reviewCases,
  userRoles,
  users,
  type CampaignRow,
  type DatabaseHandle,
  type NewCampaignRow,
} from '@helpkoro/db';
import {
  AppError,
  decodeCursor,
  uuidv7,
  type CampaignOrganizerView,
  type CampaignPublicView,
  type CampaignSummary,
  type CreateCampaignDraftInput,
  type Page,
  type UpdateCampaignDraftInput,
} from '@helpkoro/contracts';
import {
  campaignTransition,
  platformAuthorizer,
  ROLES,
  type CampaignCategory,
} from '@helpkoro/domain';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { DATABASE } from '../infra/database.module';
import { pageOf } from '../common/keyset-pagination';
import { snapshotOf, toOrganizerView, toPublicView, toSummary } from './campaign.views';

/** Postgres unique-violation SQLSTATE (duplicate slug / racing submit). */
const UNIQUE_VIOLATION = '23505';

function hasPgCode(err: unknown, code: string): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && err.code === code;
}

/**
 * Build a URL slug from a title plus a short id suffix (guaranteeing global
 * uniqueness). ASCII titles slugify normally; a Bangla-only title reduces to the
 * `campaign` base, so its public URL is `campaign-<id8>` — still unique and safe.
 */
function makeSlug(title: string, id: string): string {
  const base = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  const suffix = id.replace(/-/g, '').slice(0, 8);
  return `${base || 'campaign'}-${suffix}`;
}

interface ListArgs {
  limit: number;
  cursor?: string;
  category?: CampaignCategory;
}

interface OrganizerListArgs {
  limit: number;
  cursor?: string;
  state?: CampaignRow['status'];
}

export interface SubmitResult {
  campaign: CampaignOrganizerView;
  reviewCaseId: string;
  /** True when an open review case already existed (idempotent duplicate submit). */
  alreadyOpen: boolean;
}

/**
 * Campaign reads and writes (ADR-008). Ownership and state rules are enforced
 * *here*, not at the guard: the guard cannot load the target row, so it can only
 * gate coarse `authenticated`/role access. Every owner-scoped method loads the
 * campaign and runs the same pure `platformAuthorizer` with the real owner id and
 * state. Public reads are strictly `status = 'live'` — a draft can never surface
 * on a public route (enforced by query, not by trusting a client flag or URL).
 */
@Injectable()
export class CampaignsService {
  constructor(@Inject(DATABASE) private readonly handle: DatabaseHandle) {}

  private get db() {
    return this.handle.db;
  }

  // --- Organizer (owner-scoped) writes & reads ------------------------------

  /**
   * Create a draft and, in the same transaction, grant the creator the
   * `organizer` role (idempotently). Atomic: a campaign never exists without its
   * organizer grant, and the grant is never made without the campaign.
   */
  async createDraft(
    principal: AuthenticatedPrincipal,
    input: CreateCampaignDraftInput,
  ): Promise<CampaignOrganizerView> {
    const id = uuidv7();
    const slug = makeSlug(input.title, id);
    const consent = input.beneficiaryType === 'someone_else' ? 'pending' : 'not_required';

    let row: CampaignRow;
    try {
      row = await this.db.transaction(async (tx) => {
        const [created] = await tx
          .insert(campaigns)
          .values({
            id,
            organizerId: principal.userId,
            title: input.title,
            summary: input.summary,
            story: input.story ?? null,
            category: input.category,
            subcategory: input.subcategory ?? null,
            beneficiaryType: input.beneficiaryType,
            beneficiaryRelationship: input.beneficiaryRelationship ?? null,
            beneficiaryConsentStatus: consent,
            intendedUse: input.intendedUse ?? null,
            timeline: input.timeline ?? null,
            goalAmount: input.goalAmount,
            currency: input.currency,
            primaryLanguage: input.primaryLanguage,
            slug,
            status: 'draft',
            version: 1,
          })
          .returning();
        if (!created) {
          // Insert returned no row — treat as a transient conflict and retry.
          throw new AppError('STATE_CONFLICT', 'Could not create the campaign; please retry.');
        }
        // Creating a campaign makes you an organizer. `granted_by` is null: this
        // is a self/system grant, not an administrator action.
        await tx
          .insert(userRoles)
          .values({
            id: uuidv7(),
            userId: principal.userId,
            role: ROLES.ORGANIZER,
            grantedBy: null,
          })
          .onConflictDoNothing({ target: [userRoles.userId, userRoles.role] });
        return created;
      });
    } catch (err) {
      // Astronomically unlikely (id + slug both collide), but fail cleanly.
      if (hasPgCode(err, UNIQUE_VIOLATION)) {
        throw new AppError('STATE_CONFLICT', 'Could not create the campaign; please retry.');
      }
      throw err;
    }
    return toOrganizerView(row);
  }

  /** Load one of the principal's own campaigns (any state) as the organizer view. */
  async getOwnedById(
    principal: AuthenticatedPrincipal,
    id: string,
  ): Promise<CampaignOrganizerView> {
    const campaign = await this.loadOr404(id);
    this.assertCanAccess(campaign, principal);
    return toOrganizerView(campaign);
  }

  /** List the principal's own campaigns (any state, optional state filter). */
  async listOwned(
    principal: AuthenticatedPrincipal,
    args: OrganizerListArgs,
  ): Promise<Page<CampaignOrganizerView>> {
    const conditions: SQL[] = [eq(campaigns.organizerId, principal.userId)];
    if (args.state) conditions.push(eq(campaigns.status, args.state));
    const cursorId = args.cursor ? decodeCursor(args.cursor) : undefined;
    if (cursorId) conditions.push(lt(campaigns.id, cursorId));

    const rows = await this.db
      .select()
      .from(campaigns)
      .where(and(...conditions))
      .orderBy(desc(campaigns.id))
      .limit(args.limit + 1);

    return pageOf(rows, args.limit, toOrganizerView, (r) => r.id);
  }

  /** Apply a partial edit to a draft the principal owns. */
  async updateDraft(
    principal: AuthenticatedPrincipal,
    id: string,
    patch: UpdateCampaignDraftInput,
  ): Promise<CampaignOrganizerView> {
    const campaign = await this.loadOr404(id);
    this.assertCanMutate(campaign, principal, 'update');

    // The someone_else relationship rule must hold against the *merged* row, not
    // just the patch (a patch can set the type without re-sending the relationship).
    const mergedType = patch.beneficiaryType ?? campaign.beneficiaryType;
    const mergedRelationship =
      patch.beneficiaryRelationship !== undefined
        ? patch.beneficiaryRelationship
        : campaign.beneficiaryRelationship;
    if (mergedType === 'someone_else' && !mergedRelationship) {
      throw new AppError('VALIDATION_FAILED', 'Request validation failed.', {
        fields: [
          {
            path: 'beneficiaryRelationship',
            message: 'beneficiaryRelationship is required when raising for someone else',
          },
        ],
      });
    }

    const consentUpdate: Partial<Pick<NewCampaignRow, 'beneficiaryConsentStatus'>> =
      patch.beneficiaryType !== undefined
        ? { beneficiaryConsentStatus: mergedType === 'someone_else' ? 'pending' : 'not_required' }
        : {};

    const [updated] = await this.db
      .update(campaigns)
      .set({
        ...definedOnly({
          title: patch.title,
          summary: patch.summary,
          story: patch.story,
          category: patch.category,
          subcategory: patch.subcategory,
          beneficiaryType: patch.beneficiaryType,
          beneficiaryRelationship: patch.beneficiaryRelationship,
          intendedUse: patch.intendedUse,
          timeline: patch.timeline,
          goalAmount: patch.goalAmount,
          currency: patch.currency,
          primaryLanguage: patch.primaryLanguage,
        }),
        ...consentUpdate,
        updatedAt: new Date(),
      })
      .where(eq(campaigns.id, id))
      .returning();
    if (!updated) {
      // The draft was loaded moments ago; a missing row here means it was
      // concurrently removed — surface a conflict rather than returning nothing.
      throw new AppError('STATE_CONFLICT', 'This campaign can no longer be edited.');
    }
    return toOrganizerView(updated);
  }

  /**
   * Submit a draft for review: writes an immutable snapshot and opens a review
   * case, moving the campaign draft → submitted, all in one transaction.
   * Idempotent — if an open review case already exists, the existing case is
   * returned unchanged (no second case, no state change, no duplicate audit).
   */
  async submit(principal: AuthenticatedPrincipal, id: string): Promise<SubmitResult> {
    const campaign = await this.loadOr404(id);
    // Ownership first (any state): a non-owner gets FORBIDDEN, never a hint about
    // the campaign's state.
    this.assertCanAccess(campaign, principal);

    // Idempotency: an already-open case short-circuits before any state change.
    const open = await this.findOpenCase(id);
    if (open) {
      return { campaign: toOrganizerView(campaign), reviewCaseId: open.id, alreadyOpen: true };
    }

    // No open case → this must be a fresh draft submission.
    this.assertCanMutate(campaign, principal, 'submit');
    const next = campaignTransition('draft', 'submit');
    if (next === null) {
      // Unreachable given the draft guard above, but keeps the state machine
      // authoritative rather than trusting the guard alone.
      throw new AppError(
        'STATE_CONFLICT',
        'This campaign cannot be submitted from its current state.',
      );
    }

    const caseId = uuidv7();
    const now = new Date();
    try {
      const updated = await this.db.transaction(async (tx) => {
        const [row] = await tx
          .update(campaigns)
          .set({ status: next, submittedAt: now, updatedAt: now })
          .where(and(eq(campaigns.id, id), eq(campaigns.status, 'draft')))
          .returning();
        if (!row) {
          // Lost a race to another writer; abort and fall through to the
          // idempotent re-read below.
          throw new AppError('STATE_CONFLICT', 'This campaign was already submitted.');
        }
        await tx.insert(campaignSubmissions).values({
          id: uuidv7(),
          campaignId: id,
          version: row.version,
          snapshot: snapshotOf(row),
          submittedBy: principal.userId,
        });
        await tx.insert(reviewCases).values({
          id: caseId,
          campaignId: id,
          status: 'queued',
          priority: 0,
          version: 1,
          openedAt: now,
          updatedAt: now,
        });
        return row;
      });
      return { campaign: toOrganizerView(updated), reviewCaseId: caseId, alreadyOpen: false };
    } catch (err) {
      // Concurrent submit won the race and created the open case first. Treat as
      // idempotent success and return the winner's case.
      if (hasPgCode(err, UNIQUE_VIOLATION)) {
        const existing = await this.findOpenCase(id);
        const fresh = await this.loadOr404(id);
        if (existing) {
          return { campaign: toOrganizerView(fresh), reviewCaseId: existing.id, alreadyOpen: true };
        }
      }
      throw err;
    }
  }

  // --- Public reads (live only) ---------------------------------------------

  /** Public discovery list — strictly live campaigns, newest first. */
  async listPublic(args: ListArgs): Promise<Page<CampaignSummary>> {
    const conditions: SQL[] = [eq(campaigns.status, 'live')];
    if (args.category) conditions.push(eq(campaigns.category, args.category));
    const cursorId = args.cursor ? decodeCursor(args.cursor) : undefined;
    if (cursorId) conditions.push(lt(campaigns.id, cursorId));

    const rows = await this.db
      .select()
      .from(campaigns)
      .where(and(...conditions))
      .orderBy(desc(campaigns.id))
      .limit(args.limit + 1);

    return pageOf(rows, args.limit, toSummary, (r) => r.id);
  }

  /** Public campaign detail by slug — 404 unless the campaign is live. */
  async getPublicBySlug(slug: string): Promise<CampaignPublicView> {
    const rows = await this.db
      .select({ campaign: campaigns, organizerDisplayName: users.displayName })
      .from(campaigns)
      .innerJoin(users, eq(users.id, campaigns.organizerId))
      .where(and(eq(campaigns.slug, slug), eq(campaigns.status, 'live')))
      .limit(1);
    const found = rows[0];
    if (!found) {
      // A non-live campaign is indistinguishable from a missing one: same 404,
      // no leak of whether a draft/under-review campaign exists at this slug.
      throw new NotFoundException('Campaign not found.');
    }
    return toPublicView(found.campaign, found.organizerDisplayName);
  }

  // --- Internal helpers -----------------------------------------------------

  private async loadOr404(id: string): Promise<CampaignRow> {
    const campaign = await this.db.query.campaigns.findFirst({ where: eq(campaigns.id, id) });
    if (!campaign) {
      throw new NotFoundException('Campaign not found.');
    }
    return campaign;
  }

  private async findOpenCase(campaignId: string) {
    return this.db.query.reviewCases.findFirst({
      where: and(eq(reviewCases.campaignId, campaignId), ne(reviewCases.status, 'resolved')),
    });
  }

  /** Ownership gate (any state): denies a non-owner with FORBIDDEN. */
  private assertCanAccess(campaign: CampaignRow, principal: AuthenticatedPrincipal): void {
    const decision = platformAuthorizer({
      roles: principal.roles,
      resource: 'campaign',
      action: 'read',
      actorId: principal.userId,
      resourceOwnerId: campaign.organizerId,
      state: campaign.status,
    });
    if (decision.effect === 'deny') {
      throw new AppError('FORBIDDEN', 'You do not have access to this campaign.', {
        reason: decision.reason,
      });
    }
  }

  /**
   * Mutability gate (owner + draft). A non-owner is FORBIDDEN; the owner acting
   * on a non-draft campaign gets STATE_CONFLICT (the correct, informative code —
   * the resource is theirs, but the action is not valid in this state).
   */
  private assertCanMutate(
    campaign: CampaignRow,
    principal: AuthenticatedPrincipal,
    action: 'update' | 'submit',
  ): void {
    const decision = platformAuthorizer({
      roles: principal.roles,
      resource: 'campaign',
      action,
      actorId: principal.userId,
      resourceOwnerId: campaign.organizerId,
      state: campaign.status,
    });
    if (decision.effect === 'allow') return;
    if (campaign.organizerId !== principal.userId) {
      throw new AppError('FORBIDDEN', 'You do not have access to this campaign.', {
        reason: decision.reason,
      });
    }
    throw new AppError(
      'STATE_CONFLICT',
      action === 'submit'
        ? 'Only a draft campaign can be submitted for review.'
        : 'This campaign can no longer be edited.',
      { reason: decision.reason, state: campaign.status },
    );
  }
}

// --- Local helpers ----------------------------------------------------------

/** Drop keys whose value is `undefined` so a partial patch never nulls a column. */
function definedOnly<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k as keyof T] = v as T[keyof T];
  }
  return out;
}
