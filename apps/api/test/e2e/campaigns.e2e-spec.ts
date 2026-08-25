import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { and, eq, ne } from 'drizzle-orm';
import { featureFlags, reviewCases, type DatabaseHandle } from '@helpkoro/db';
import { uuidv7 } from '@helpkoro/contracts';
import { ROLES } from '@helpkoro/domain';
import { UsersService } from '../../src/auth/users.service';
import { DATABASE } from '../../src/infra/database.module';
import { buildTestApp, flushRateLimitKeys } from './app-harness';

/**
 * End-to-end campaign lifecycle (ADR-008): organizer creates a draft → submits →
 * reviewer approves → the campaign becomes publicly discoverable. Also pins the
 * authorization boundaries the spec requires: no draft leaks through a public
 * route, non-owners cannot edit/submit, non-reviewers cannot decide, and creation
 * is gated behind the `campaigns.creation_enabled` flag. No money moves here —
 * donations stay off for all of Phase 1.
 */

interface Tokens {
  accessToken: string;
  refreshToken: string;
}
interface AuthBody {
  data: { user: { id: string }; tokens: Tokens };
}
interface ErrorBody {
  error: { code: string; details?: { reason?: string } };
}
interface OrganizerCampaign {
  id: string;
  slug: string;
  state: string;
  version: number;
  beneficiaryRelationship: string | null;
}
interface OrganizerCampaignBody {
  data: OrganizerCampaign;
}
interface SubmitBody {
  data: OrganizerCampaign;
}
interface ReviewCaseBody {
  data: {
    caseId: string;
    status: string;
    campaign: { id: string; state: string };
    submittedSnapshot: unknown;
    decisions: Array<{ decision: string; reasonCode: string }>;
  };
}
interface QueueBody {
  data: { items: Array<{ caseId: string; campaignId: string; campaignTitle: string }> };
}
interface PublicListBody {
  data: { items: Array<{ id: string; slug: string; title: string }> };
}

const PASSWORD = 'a-strong-password-123';
const CREATION_FLAG = 'campaigns.creation_enabled';

const DRAFT_INPUT = {
  title: 'Help rebuild the flooded school',
  summary: 'Monsoon floods destroyed the classroom block; we are raising funds to rebuild it.',
  category: 'disaster_response',
  beneficiaryType: 'myself',
  goalAmount: 500_000,
  currency: 'BDT',
  primaryLanguage: 'bn',
  story: 'The school served 300 children before the flood. Every taka helps us rebuild.',
} as const;

describe('Campaign lifecycle (organizer → review → public)', () => {
  let app: NestFastifyApplication;
  let handle: DatabaseHandle;

  beforeAll(async () => {
    app = await buildTestApp();
    handle = app.get(DATABASE, { strict: false }) as DatabaseHandle;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await flushRateLimitKeys(app);
  });

  // --- helpers --------------------------------------------------------------

  async function registerUser(displayName = 'Organizer'): Promise<{
    userId: string;
    creds: { email: string; password: string };
    tokens: Tokens;
  }> {
    const creds = { email: `user-${uuidv7()}@helpkoro.test`, password: PASSWORD };
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: { ...creds, displayName },
    });
    const body = res.json() as AuthBody;
    return { userId: body.data.user.id, creds, tokens: body.data.tokens };
  }

  async function login(creds: { email: string; password: string }): Promise<Tokens> {
    const res = await app.inject({ method: 'POST', url: '/v1/auth/login', payload: creds });
    return (res.json() as AuthBody).data.tokens;
  }

  /** Elevate a user to reviewer out-of-band, then re-login for a token that carries the role. */
  async function makeReviewer(user: {
    userId: string;
    creds: { email: string; password: string };
  }): Promise<Tokens> {
    await app
      .get(UsersService, { strict: false })
      .assignRole(user.userId, ROLES.REVIEWER, user.userId);
    return login(user.creds);
  }

  async function setCreationFlag(enabled: boolean): Promise<void> {
    await handle.db
      .insert(featureFlags)
      .values({ key: CREATION_FLAG, enabled })
      .onConflictDoUpdate({
        target: featureFlags.key,
        set: { enabled, updatedAt: new Date() },
      });
  }

  function auth(tokens: Tokens) {
    return { authorization: `Bearer ${tokens.accessToken}` };
  }

  async function createDraft(tokens: Tokens, overrides: Record<string, unknown> = {}) {
    return app.inject({
      method: 'POST',
      url: '/v1/campaigns',
      headers: auth(tokens),
      payload: { ...DRAFT_INPUT, ...overrides },
    });
  }

  // --- the happy path -------------------------------------------------------

  it('runs the full loop: create → submit → approve → publicly visible (public view only)', async () => {
    await setCreationFlag(true);
    const organizer = await registerUser();

    // Create a draft.
    const created = await createDraft(organizer.tokens);
    expect(created.statusCode).toBe(201);
    const draft = (created.json() as OrganizerCampaignBody).data;
    expect(draft.state).toBe('draft');

    // It is NOT publicly visible yet: not in the list, and the slug 404s.
    const earlyList = await app.inject({ method: 'GET', url: '/v1/campaigns' });
    expect((earlyList.json() as PublicListBody).data.items.map((c) => c.id)).not.toContain(
      draft.id,
    );
    const earlyDetail = await app.inject({ method: 'GET', url: `/v1/campaigns/${draft.slug}` });
    expect(earlyDetail.statusCode).toBe(404);

    // Submit it for review.
    const submitted = await app.inject({
      method: 'POST',
      url: `/v1/organizer/campaigns/${draft.id}/submit`,
      headers: auth(organizer.tokens),
    });
    expect(submitted.statusCode).toBe(200);
    expect((submitted.json() as SubmitBody).data.state).toBe('submitted');

    // A reviewer sees the case in the queue.
    const reviewer = await registerUser('Reviewer');
    const reviewerTokens = await makeReviewer(reviewer);
    const queue = await app.inject({
      method: 'GET',
      url: '/v1/reviews',
      headers: auth(reviewerTokens),
    });
    expect(queue.statusCode).toBe(200);
    const queued = (queue.json() as QueueBody).data.items.find((c) => c.campaignId === draft.id);
    expect(queued).toBeDefined();
    const caseId = queued!.caseId;

    // The case workspace carries the submitted snapshot + organizer-grade campaign view.
    const workspace = await app.inject({
      method: 'GET',
      url: `/v1/reviews/${caseId}`,
      headers: auth(reviewerTokens),
    });
    expect(workspace.statusCode).toBe(200);
    expect((workspace.json() as ReviewCaseBody).data.submittedSnapshot).toBeTruthy();

    // Approve.
    const decision = await app.inject({
      method: 'POST',
      url: `/v1/reviews/${caseId}/decision`,
      headers: auth(reviewerTokens),
      payload: { decision: 'approve', reasonCode: 'meets_guidelines' },
    });
    expect(decision.statusCode).toBe(200);
    const decided = (decision.json() as ReviewCaseBody).data;
    expect(decided.campaign.state).toBe('live');
    expect(decided.status).toBe('resolved');

    // Now it is publicly discoverable…
    const list = await app.inject({ method: 'GET', url: '/v1/campaigns' });
    expect(list.statusCode).toBe(200);
    expect((list.json() as PublicListBody).data.items.map((c) => c.id)).toContain(draft.id);

    // …and the public detail returns ONLY the public projection — no payout,
    // evidence, internal-review, or private beneficiary-identity fields.
    const detail = await app.inject({ method: 'GET', url: `/v1/campaigns/${draft.slug}` });
    expect(detail.statusCode).toBe(200);
    const publicView = (detail.json() as { data: Record<string, unknown> }).data;
    expect(publicView.state).toBe('live');
    expect(publicView).toHaveProperty('organizerDisplayName');
    for (const forbidden of [
      'beneficiaryRelationship',
      'intendedUse',
      'timeline',
      'version',
      'submittedAt',
      'organizerId',
    ]) {
      expect(publicView).not.toHaveProperty(forbidden);
    }
  });

  // --- gating & authorization ----------------------------------------------

  it('blocks creation when the feature flag is off (FORBIDDEN / FEATURE_DISABLED)', async () => {
    await setCreationFlag(false);
    const organizer = await registerUser();
    const res = await createDraft(organizer.tokens);
    expect(res.statusCode).toBe(403);
    const body = res.json() as ErrorBody;
    expect(body.error.code).toBe('FORBIDDEN');
    expect(body.error.details?.reason).toBe('FEATURE_DISABLED');
  });

  it('requires authentication to create a campaign', async () => {
    await setCreationFlag(true);
    const res = await app.inject({ method: 'POST', url: '/v1/campaigns', payload: DRAFT_INPUT });
    expect(res.statusCode).toBe(401);
    expect((res.json() as ErrorBody).error.code).toBe('AUTH_REQUIRED');
  });

  it('requires beneficiaryRelationship when raising for someone else (VALIDATION_FAILED)', async () => {
    await setCreationFlag(true);
    const organizer = await registerUser();
    const res = await createDraft(organizer.tokens, {
      beneficiaryType: 'someone_else',
      beneficiaryRelationship: undefined,
    });
    expect(res.statusCode).toBe(400);
    expect((res.json() as ErrorBody).error.code).toBe('VALIDATION_FAILED');
  });

  it('forbids a non-owner from editing or submitting another organizer’s draft', async () => {
    await setCreationFlag(true);
    const owner = await registerUser();
    const created = await createDraft(owner.tokens);
    const draft = (created.json() as OrganizerCampaignBody).data;

    const stranger = await registerUser('Stranger');

    const edit = await app.inject({
      method: 'PATCH',
      url: `/v1/organizer/campaigns/${draft.id}`,
      headers: auth(stranger.tokens),
      payload: { title: 'Hijacked title that is long enough' },
    });
    expect(edit.statusCode).toBe(403);
    expect((edit.json() as ErrorBody).error.code).toBe('FORBIDDEN');

    const submit = await app.inject({
      method: 'POST',
      url: `/v1/organizer/campaigns/${draft.id}/submit`,
      headers: auth(stranger.tokens),
    });
    expect(submit.statusCode).toBe(403);
    expect((submit.json() as ErrorBody).error.code).toBe('FORBIDDEN');

    // The stranger cannot even confirm the draft exists via the organizer detail route.
    const peek = await app.inject({
      method: 'GET',
      url: `/v1/organizer/campaigns/${draft.id}`,
      headers: auth(stranger.tokens),
    });
    expect(peek.statusCode).toBe(403);
  });

  it('forbids a non-reviewer from reading the queue or deciding a case', async () => {
    await setCreationFlag(true);
    const organizer = await registerUser();
    const created = await createDraft(organizer.tokens);
    const draft = (created.json() as OrganizerCampaignBody).data;
    await app.inject({
      method: 'POST',
      url: `/v1/organizer/campaigns/${draft.id}/submit`,
      headers: auth(organizer.tokens),
    });

    // The organizer (no reviewer role) is refused the reviewer surface entirely.
    const queue = await app.inject({
      method: 'GET',
      url: '/v1/reviews',
      headers: auth(organizer.tokens),
    });
    expect(queue.statusCode).toBe(403);
    expect((queue.json() as ErrorBody).error.code).toBe('FORBIDDEN');
  });

  it('is idempotent on submit: a duplicate submit does not open a second review case', async () => {
    await setCreationFlag(true);
    const organizer = await registerUser();
    const created = await createDraft(organizer.tokens);
    const draft = (created.json() as OrganizerCampaignBody).data;

    const first = await app.inject({
      method: 'POST',
      url: `/v1/organizer/campaigns/${draft.id}/submit`,
      headers: auth(organizer.tokens),
    });
    expect(first.statusCode).toBe(200);

    const second = await app.inject({
      method: 'POST',
      url: `/v1/organizer/campaigns/${draft.id}/submit`,
      headers: auth(organizer.tokens),
    });
    expect(second.statusCode).toBe(200);
    expect((second.json() as SubmitBody).data.state).toBe('submitted');

    // Exactly one open review case exists for the campaign.
    const openCases = await handle.db
      .select()
      .from(reviewCases)
      .where(and(eq(reviewCases.campaignId, draft.id), ne(reviewCases.status, 'resolved')));
    expect(openCases).toHaveLength(1);
  });

  it('rejects a submitted campaign and never lets it become public', async () => {
    await setCreationFlag(true);
    const organizer = await registerUser();
    const created = await createDraft(organizer.tokens);
    const draft = (created.json() as OrganizerCampaignBody).data;
    await app.inject({
      method: 'POST',
      url: `/v1/organizer/campaigns/${draft.id}/submit`,
      headers: auth(organizer.tokens),
    });

    const reviewer = await registerUser('Reviewer');
    const reviewerTokens = await makeReviewer(reviewer);
    const queue = await app.inject({
      method: 'GET',
      url: '/v1/reviews',
      headers: auth(reviewerTokens),
    });
    const caseId = (queue.json() as QueueBody).data.items.find(
      (c) => c.campaignId === draft.id,
    )!.caseId;

    const decision = await app.inject({
      method: 'POST',
      url: `/v1/reviews/${caseId}/decision`,
      headers: auth(reviewerTokens),
      payload: {
        decision: 'reject',
        reasonCode: 'insufficient_evidence',
        organizerExplanation:
          'We could not verify the beneficiary; please resubmit with documents.',
      },
    });
    expect(decision.statusCode).toBe(200);
    expect((decision.json() as ReviewCaseBody).data.campaign.state).toBe('rejected');

    // A rejected campaign is not publicly visible.
    const detail = await app.inject({ method: 'GET', url: `/v1/campaigns/${draft.slug}` });
    expect(detail.statusCode).toBe(404);
  });
});
