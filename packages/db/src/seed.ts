import { apiEnvSchema, parseEnv } from '@helpkoro/contracts';
import { createDatabase } from './client';
import { featureFlags } from './schema';

/**
 * Baseline feature flags, all disabled by default (fail-safe). A `system`
 * actor row is intentionally NOT seeded here — the `users` table lands in the
 * step-4 auth pass; system-originated audit events use actor_type='system'
 * with a null actor_id until then.
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

/** Idempotently seed baseline data. Run via `pnpm seed`. */
async function main(): Promise<void> {
  const env = parseEnv(apiEnvSchema);
  const { db, close } = createDatabase(env.DATABASE_URL, { max: 1 });
  try {
    for (const flag of BASELINE_FLAGS) {
      await db.insert(featureFlags).values(flag).onConflictDoNothing({ target: featureFlags.key });
    }
    console.log(`seeded ${BASELINE_FLAGS.length} baseline feature flags`);
  } finally {
    await close();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
