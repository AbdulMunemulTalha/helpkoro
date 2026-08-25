import { hash, Algorithm } from '@node-rs/argon2';
import { eq } from 'drizzle-orm';
import {
  apiEnvSchema,
  parseEnv,
  uuidv7,
  emailSchema,
  passwordSchema,
  ARGON2ID_MEMORY_COST,
  ARGON2ID_TIME_COST,
  ARGON2ID_PARALLELISM,
} from '@helpkoro/contracts';
import { ROLES } from '@helpkoro/domain';
import { createDatabase } from './client';
import { campaigns, featureFlags, users, userCredentials, userRoles } from './schema';
import type { DatabaseHandle } from './client';

/**
 * Baseline feature flags, all disabled by default (fail-safe).
 */
const BASELINE_FLAGS = [
  {
    key: 'platform.maintenance_mode',
    description: 'Puts the platform into read-only maintenance mode.',
    enabled: false,
  },
  {
    key: 'donations.enabled',
    description: 'Master switch for accepting new donations.',
    enabled: false,
  },
  {
    key: 'campaigns.creation_enabled',
    description: 'Allows organizers to create new campaigns.',
    enabled: false,
  },
];

async function seedFeatureFlags(db: DatabaseHandle['db']): Promise<void> {
  for (const flag of BASELINE_FLAGS) {
    await db.insert(featureFlags).values(flag).onConflictDoNothing({ target: featureFlags.key });
  }
  console.log(`seeded ${BASELINE_FLAGS.length} baseline feature flags`);
}

/**
 * Bootstrap an administrator for local development and CI only. In production
 * the first administrator is created through a documented manual procedure
 * (ADR-007), NEVER seeded — so this is skipped when NODE_ENV=production.
 *
 * Idempotent: if the account already exists, the password/role are left as-is.
 * Credentials come from env with dev defaults; the defaults are safe only
 * because this never runs in production.
 */
async function seedBootstrapAdmin(db: DatabaseHandle['db']): Promise<void> {
  const email = emailSchema.parse(process.env.BOOTSTRAP_ADMIN_EMAIL ?? 'admin@helpkoro.test');
  const password = passwordSchema.parse(
    process.env.BOOTSTRAP_ADMIN_PASSWORD ?? 'helpkoro-dev-admin-1',
  );

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (existing.length > 0) {
    console.log('bootstrap admin already present; leaving untouched');
    return;
  }

  const passwordHash = await hash(password, {
    algorithm: Algorithm.Argon2id,
    memoryCost: ARGON2ID_MEMORY_COST,
    timeCost: ARGON2ID_TIME_COST,
    parallelism: ARGON2ID_PARALLELISM,
  });

  const userId = uuidv7();
  await db.transaction(async (tx) => {
    await tx.insert(users).values({
      id: userId,
      email,
      displayName: 'Bootstrap Administrator',
      emailVerified: true,
      status: 'active',
      locale: 'en',
    });
    await tx.insert(userCredentials).values({ userId, passwordHash });
    await tx.insert(userRoles).values({
      id: uuidv7(),
      userId,
      role: ROLES.ADMINISTRATOR,
      grantedBy: null,
    });
  });

  // Never log the password. The email is a non-secret dev identifier.
  console.log(`seeded bootstrap administrator <${email}>`);
}

/**
 * Demo organizer + a small set of LIVE campaigns for local development and CI
 * only (skipped when NODE_ENV=production, like the bootstrap admin). This lets
 * the public web app render discovery and detail pages without running the full
 * submit→review→approve loop or toggling `campaigns.creation_enabled`.
 *
 * The content is obviously fictional sample data — HelpKoro shows no "verified"
 * badge and no raised-amount, so a seeded live campaign is simply a live
 * campaign, not a claim of a real, vetted cause. Goals are integer minor units
 * with an explicit currency (never a float), matching the money contract.
 *
 * Idempotent: keyed by the organizer email and each campaign's unique slug, so
 * re-running the seed neither duplicates nor overwrites existing rows.
 */
const DEMO_CAMPAIGNS = [
  {
    slug: 'rahima-heart-surgery',
    title: 'রহিমার হৃদযন্ত্রের অস্ত্রোপচারে পাশে দাঁড়ান',
    summary:
      'রহিমার জীবন রক্ষাকারী হৃদযন্ত্রের অস্ত্রোপচার প্রয়োজন। তার চিকিৎসার খরচ জোগাড়ে আপনার সহায়তা দরকার।',
    story:
      'রহিমা দুই সন্তানের মা। সম্প্রতি চিকিৎসকরা জানিয়েছেন তার দ্রুত একটি হৃদযন্ত্রের অস্ত্রোপচার প্রয়োজন। পরিবারটির পক্ষে এই ব্যয় বহন করা কঠিন। আপনার সহায়তা তার সুস্থ জীবনে ফেরার পথ সহজ করবে।',
    category: 'medical' as const,
    beneficiaryType: 'someone_else' as const,
    beneficiaryRelationship: 'বোন',
    beneficiaryConsentStatus: 'granted' as const,
    goalAmount: 50_000_000, // 5,00,000 BDT (minor units, exponent 2)
    currency: 'BDT',
    primaryLanguage: 'bn' as const,
  },
  {
    slug: 'flood-relief-sylhet',
    title: 'Flood relief for families in Sylhet',
    summary:
      'Recent floods displaced dozens of families in Sylhet. Funds go toward clean water, food, and temporary shelter.',
    story:
      'Monsoon flooding has left many families in low-lying areas of Sylhet without safe shelter or clean drinking water. This community drive coordinates emergency supplies — water purification, dry food, and tarpaulin — for the worst-affected households.',
    category: 'disaster_response' as const,
    beneficiaryType: 'organization' as const,
    beneficiaryConsentStatus: 'granted' as const,
    goalAmount: 30_000_000, // 3,00,000 BDT
    currency: 'BDT',
    primaryLanguage: 'en' as const,
  },
  {
    slug: 'books-for-village-school',
    title: 'গ্রামের স্কুলের জন্য বই ও শিক্ষা উপকরণ',
    summary:
      'একটি প্রত্যন্ত গ্রামের প্রাথমিক বিদ্যালয়ের শিক্ষার্থীদের জন্য বই, খাতা ও শিক্ষা উপকরণ সংগ্রহ করা হচ্ছে।',
    story:
      'এই প্রাথমিক বিদ্যালয়ে দুই শতাধিক শিক্ষার্থী পড়াশোনা করে, কিন্তু পর্যাপ্ত বই ও শিক্ষা উপকরণ নেই। আপনার সহায়তায় শিশুরা নতুন বই, খাতা ও প্রয়োজনীয় উপকরণ পাবে।',
    category: 'education' as const,
    beneficiaryType: 'myself' as const,
    beneficiaryConsentStatus: 'not_required' as const,
    goalAmount: 12_000_000, // 1,20,000 BDT
    currency: 'BDT',
    primaryLanguage: 'bn' as const,
  },
];

async function seedDemoCampaigns(db: DatabaseHandle['db']): Promise<void> {
  const email = emailSchema.parse(process.env.DEMO_ORGANIZER_EMAIL ?? 'organizer@helpkoro.test');
  const password = passwordSchema.parse(
    process.env.DEMO_ORGANIZER_PASSWORD ?? 'helpkoro-dev-organizer-1',
  );

  // Reuse the organizer across runs; create it (with credentials + role) only once.
  let organizerId: string;
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (existing[0]) {
    organizerId = existing[0].id;
    console.log('demo organizer already present; reusing');
  } else {
    const passwordHash = await hash(password, {
      algorithm: Algorithm.Argon2id,
      memoryCost: ARGON2ID_MEMORY_COST,
      timeCost: ARGON2ID_TIME_COST,
      parallelism: ARGON2ID_PARALLELISM,
    });
    organizerId = uuidv7();
    await db.transaction(async (tx) => {
      await tx.insert(users).values({
        id: organizerId,
        email,
        displayName: 'HelpKoro Demo Organizer',
        emailVerified: true,
        status: 'active',
        locale: 'bn',
      });
      await tx.insert(userCredentials).values({ userId: organizerId, passwordHash });
      await tx.insert(userRoles).values({
        id: uuidv7(),
        userId: organizerId,
        role: ROLES.ORGANIZER,
        grantedBy: null,
      });
    });
    console.log(`seeded demo organizer <${email}>`);
  }

  // A fixed publish time keeps ordering stable across re-runs.
  const publishedAt = new Date('2026-01-15T09:00:00.000Z');
  let inserted = 0;
  for (const c of DEMO_CAMPAIGNS) {
    const result = await db
      .insert(campaigns)
      .values({
        id: uuidv7(),
        organizerId,
        title: c.title,
        summary: c.summary,
        story: c.story,
        category: c.category,
        beneficiaryType: c.beneficiaryType,
        beneficiaryRelationship: c.beneficiaryRelationship ?? null,
        beneficiaryConsentStatus: c.beneficiaryConsentStatus,
        goalAmount: c.goalAmount,
        currency: c.currency,
        primaryLanguage: c.primaryLanguage,
        slug: c.slug,
        status: 'live',
        submittedAt: publishedAt,
        publishedAt,
      })
      .onConflictDoNothing({ target: campaigns.slug })
      .returning({ id: campaigns.id });
    if (result.length > 0) inserted += 1;
  }
  console.log(`seeded ${inserted} demo live campaign(s) (${DEMO_CAMPAIGNS.length} defined)`);
}

/** Idempotently seed baseline data. Run via `pnpm seed`. */
async function main(): Promise<void> {
  const env = parseEnv(apiEnvSchema);
  const { db, close } = createDatabase(env.DATABASE_URL, { max: 1 });
  try {
    await seedFeatureFlags(db);
    if (env.NODE_ENV === 'production') {
      console.log('skipping bootstrap admin (production): use the manual first-admin procedure');
    } else {
      await seedBootstrapAdmin(db);
      await seedDemoCampaigns(db);
    }
  } finally {
    await close();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
