#!/usr/bin/env node
// HelpKoro build-status generator.
//
// Regenerates the auto-generated block inside docs/13-build-blueprint/build-status.md
// from *evidence in the repository* — which deliverables exist, the live API route
// surface, ADR/migration/test counts, and the current git HEAD.
//
// It is intentionally conservative and honest: it reports what is PRESENT, not what
// is verified-correct. The curated narrative above the auto block is authoritative
// for nuance (intentionally deferred work, Validate-gated items, etc.).
//
// Usage:
//   node scripts/build-status.mjs           # rewrite the auto block in place
//   node scripts/build-status.mjs --check    # exit 1 if the block is stale (CI-friendly;
//                                             # ignores the volatile commit stamp line)
//
// Zero dependencies. Idempotent: same repo state -> identical output.

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DOC = join(ROOT, 'docs', '13-build-blueprint', 'build-status.md');
const BEGIN = '<!-- BUILD-STATUS:AUTO:BEGIN -->';
const END = '<!-- BUILD-STATUS:AUTO:END -->';
const PRUNE = new Set([
  'node_modules',
  'dist',
  '.turbo',
  '.git',
  'graphify-out',
  '.next',
  'coverage',
]);

// ---------------------------------------------------------------------------
// Small filesystem helpers
// ---------------------------------------------------------------------------
const abs = (rel) => join(ROOT, rel);
const has = (rel) => existsSync(abs(rel));

function walk(rel, out = []) {
  const dir = abs(rel);
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') && entry.name !== '.github') {
      // allow .github, prune other dotfiles/dirs (.turbo etc. also in PRUNE)
    }
    if (PRUNE.has(entry.name)) continue;
    const childRel = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) walk(childRel, out);
    else out.push(childRel);
  }
  return out;
}

function listDir(rel) {
  const dir = abs(rel);
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true });
}

function git(args, fallback = 'unknown') {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch {
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// Evidence model — roadmap-aligned. `evidence` entries are repo-relative paths
// (file or directory). A directory counts as present if it exists and is non-empty.
// An entry ending in a known extension is matched exactly; a bare dir is a tree probe.
// ---------------------------------------------------------------------------
const PHASES = [
  {
    id: 0,
    name: 'Platform (foundation)',
    goal: 'Monorepo, Docker, CI, config/secrets, migrations, shared UI, API shell, auth/RBAC, audit events, telemetry.',
    items: [
      {
        label: 'Monorepo tooling (pnpm workspaces + Turborepo)',
        evidence: ['turbo.json', 'pnpm-workspace.yaml'],
      },
      {
        label: 'Local services (Docker Compose: Postgres, Redis, MinIO)',
        evidence: ['infra/docker-compose.yml'],
      },
      { label: 'Continuous integration', evidence: ['.github/workflows/ci.yml'] },
      {
        label: 'Config & secrets contract (Zod env schema)',
        evidence: ['packages/contracts/src/env.ts'],
      },
      {
        label: 'Database schema & migrations (Drizzle)',
        evidence: ['packages/db/src/schema.ts', 'packages/db/drizzle'],
      },
      { label: 'Shared UI package (bilingual / RTL primitives)', evidence: ['packages/ui/src'] },
      {
        label: 'API application shell (NestJS on Fastify, health, error envelope)',
        evidence: ['apps/api/src/bootstrap.ts', 'apps/api/src/health/health.controller.ts'],
      },
      {
        label: 'Telemetry & observability (OpenTelemetry, structured logs)',
        evidence: ['apps/api/src/instrumentation.ts'],
      },
      { label: 'Append-only audit events', evidence: ['apps/api/src/audit/audit.service.ts'] },
      {
        label: 'Auth core + RBAC — Argon2id, rotating refresh, step-up, rate limits (ADR-007)',
        evidence: ['apps/api/src/auth/auth.controller.ts', 'apps/api/src/auth/guards'],
      },
    ],
  },
  {
    id: 1,
    name: 'Campaigns',
    goal: 'Profiles, organizer onboarding, drafts, uploads, submission, public campaigns, discovery, reports, organizer dashboard, reviewer queue.',
    items: [
      {
        label: 'Campaign domain model & state machine',
        evidence: ['packages/domain/src/campaigns.ts'],
      },
      { label: 'Campaign API module', evidence: ['apps/api/src/campaigns'] },
      { label: 'Organizer onboarding & profiles', evidence: ['apps/api/src/profiles'] },
      { label: 'Reviewer queue (manual review)', evidence: ['apps/api/src/reviews'] },
      { label: 'Public web experience (apps/web)', evidence: ['apps/web/src'] },
    ],
  },
  {
    id: 2,
    name: 'Donations & ledger',
    goal: 'Provider adapter interface, sandbox checkout, signature-verified webhooks, immutable ledger, receipts, donor history, reconciliation, refund simulation.',
    items: [
      {
        label: 'Provider adapter interface (ADR-002)',
        evidence: ['packages/domain/src/payment-provider.ts'],
      },
      { label: 'Immutable ledger (ADR-001)', evidence: ['packages/domain/src/ledger.ts'] },
      { label: 'Donations API + sandbox checkout', evidence: ['apps/api/src/donations'] },
      { label: 'Signature-verified webhook processing', evidence: ['apps/api/src/webhooks'] },
      { label: 'Receipts & donor history', evidence: ['apps/api/src/receipts'] },
    ],
  },
  {
    id: 3,
    name: 'Payout & operations',
    goal: 'Payout eligibility, dual approval, sandbox payout adapter, holds, finance console, support workflows, notifications, incident/report operations.',
    items: [
      { label: 'Payout eligibility & dual approval', evidence: ['apps/api/src/payouts'] },
      { label: 'Finance console (apps/operations)', evidence: ['apps/operations/src'] },
      { label: 'Support & moderation workflows', evidence: ['apps/api/src/support'] },
      { label: 'Notifications', evidence: ['apps/api/src/notifications'] },
    ],
  },
  {
    id: 4,
    name: 'Launch hardening',
    goal: 'Accessibility, localization, security/load testing, backup-restore drill, ops training, provider acceptance, monitoring, all Bangladesh Validate approvals. No real funds before written launch sign-off.',
    items: [
      { label: 'Accessibility & localization sign-off', evidence: [] },
      { label: 'Security & load testing', evidence: [] },
      { label: 'Backup-restore drill & runbooks', evidence: [] },
      { label: 'Bangladesh legal/provider Validate approvals', evidence: [], manual: true },
    ],
  },
];

function evidencePresent(rel) {
  if (!has(rel)) return false;
  const p = abs(rel);
  if (statSync(p).isDirectory()) {
    // a directory counts only if it holds at least one non-pruned file
    return walk(rel).length > 0;
  }
  return true;
}

function itemStatus(item) {
  if (!item.evidence || item.evidence.length === 0) {
    return { mark: item.manual ? '🔒' : '⬜', matched: 0, total: 0 };
  }
  const matched = item.evidence.filter(evidencePresent).length;
  const total = item.evidence.length;
  if (matched === 0) return { mark: '⬜', matched, total };
  if (matched === total) return { mark: '✅', matched, total };
  return { mark: '🟡', matched, total };
}

function phaseStatus(marks) {
  const real = marks.filter((m) => m !== '🔒');
  if (real.length > 0 && real.every((m) => m === '✅')) return 'Complete';
  if (marks.some((m) => m === '✅' || m === '🟡')) return 'In progress';
  return 'Not started';
}

// ---------------------------------------------------------------------------
// Repo signal collectors
// ---------------------------------------------------------------------------
function collectAdrs() {
  return listDir('docs/12-decisions')
    .filter((e) => e.isFile() && /^adr-\d+.*\.md$/.test(e.name))
    .map((e) => {
      const first = readFileSync(abs(`docs/12-decisions/${e.name}`), 'utf8')
        .split(/\r?\n/)
        .find((l) => l.startsWith('# '));
      return { file: e.name, title: first ? first.replace(/^#\s*/, '').trim() : e.name };
    })
    .sort((a, b) => a.file.localeCompare(b.file));
}

function collectMigrations() {
  return listDir('packages/db/drizzle')
    .filter((e) => e.isFile() && e.name.endsWith('.sql'))
    .map((e) => e.name)
    .sort();
}

function collectPackages() {
  const out = [];
  for (const scope of ['apps', 'packages']) {
    for (const e of listDir(scope)) {
      if (!e.isDirectory()) continue;
      const pkg = `${scope}/${e.name}/package.json`;
      if (!has(pkg)) continue;
      try {
        const name = JSON.parse(readFileSync(abs(pkg), 'utf8')).name || `${scope}/${e.name}`;
        out.push(name);
      } catch {
        out.push(`${scope}/${e.name}`);
      }
    }
  }
  return out.sort();
}

function countSpecs() {
  const files = [...walk('apps'), ...walk('packages')];
  return {
    unit: files.filter(
      (f) => f.endsWith('.spec.ts') || f.endsWith('.test.ts') || f.endsWith('.test.tsx'),
    ).length,
    e2e: files.filter((f) => f.endsWith('.e2e-spec.ts')).length,
  };
}

const METHOD_RE = /@(Get|Post|Put|Patch|Delete)\(\s*(?:'([^']*)'|"([^"]*)"|`([^`]*)`)?\s*\)/g;
const CONTROLLER_RE = /@Controller\(\s*(?:'([^']*)'|"([^"]*)"|`([^`]*)`)?\s*\)/;

function collectRoutes() {
  const controllers = walk('apps').filter((f) => f.endsWith('.controller.ts'));
  const routes = [];
  for (const rel of controllers) {
    const src = readFileSync(abs(rel), 'utf8');
    const cm = src.match(CONTROLLER_RE);
    const base = cm ? (cm[1] ?? cm[2] ?? cm[3] ?? '') : '';
    let m;
    METHOD_RE.lastIndex = 0;
    while ((m = METHOD_RE.exec(src)) !== null) {
      const sub = m[2] ?? m[3] ?? m[4] ?? '';
      const path = ['', base, sub].filter(Boolean).join('/');
      routes.push({ method: m[1].toUpperCase(), path: path || '/', file: rel });
    }
  }
  return routes.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
}

// ---------------------------------------------------------------------------
// Render the auto block
// ---------------------------------------------------------------------------
function buildBlock() {
  const sha = git(['rev-parse', '--short', 'HEAD']);
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
  const commitDate = git(['show', '-s', '--format=%cs', 'HEAD']); // YYYY-MM-DD
  const commitCount = git(['rev-list', '--count', 'HEAD'], '0');
  const dirty = git(['status', '--porcelain'], '') !== '' ? ' · uncommitted changes present' : '';

  const adrs = collectAdrs();
  const migrations = collectMigrations();
  const packages = collectPackages();
  const specs = countSpecs();
  const routes = collectRoutes();

  const lines = [];
  lines.push(BEGIN);
  lines.push('');
  lines.push(
    '> _Auto-generated by [`scripts/build-status.mjs`](../../scripts/build-status.mjs). Detected from repository files — presence is evidence, not a correctness guarantee. Run `pnpm build:status` to refresh._',
  );
  lines.push('');
  lines.push(
    `**As of commit** \`${sha}\` on \`${branch}\` (${commitDate}) · ${commitCount} commits${dirty}`,
  );
  lines.push('');

  // Phase overview
  lines.push('### Phase overview');
  lines.push('');
  lines.push('| Phase | Name | Status | Items complete |');
  lines.push('| ----- | ---- | ------ | -------------- |');
  const phaseDetail = [];
  for (const phase of PHASES) {
    const statuses = phase.items.map((it) => ({ it, st: itemStatus(it) }));
    const marks = statuses.map((s) => s.st.mark);
    const done = marks.filter((m) => m === '✅').length;
    const total = marks.length;
    lines.push(`| ${phase.id} | ${phase.name} | ${phaseStatus(marks)} | ${done}/${total} |`);
    phaseDetail.push({ phase, statuses });
  }
  lines.push('');

  // Per-phase checklists
  for (const { phase, statuses } of phaseDetail) {
    lines.push(`### Phase ${phase.id} — ${phase.name}`);
    lines.push('');
    lines.push(`_${phase.goal}_`);
    lines.push('');
    for (const { it, st } of statuses) {
      const suffix =
        st.total > 1 && st.mark === '🟡' ? ` _(${st.matched}/${st.total} signals)_` : '';
      lines.push(`- ${st.mark} ${it.label}${suffix}`);
    }
    lines.push('');
  }

  // Repo signals
  lines.push('### Repository signals');
  lines.push('');
  lines.push(
    `- **Workspace packages** (${packages.length}): ${packages.map((p) => `\`${p}\``).join(', ')}`,
  );
  lines.push(
    `- **ADRs** (${adrs.length}): ${adrs.map((a) => `\`${a.file.replace(/\.md$/, '')}\``).join(', ')}`,
  );
  lines.push(
    `- **Migrations** (${migrations.length}): ${migrations.map((m) => `\`${m}\``).join(', ')}`,
  );
  lines.push(`- **Tests**: ${specs.unit} unit/component specs, ${specs.e2e} end-to-end specs`);
  lines.push('');

  // API surface
  lines.push('### API route surface (declared in source)');
  lines.push('');
  lines.push(
    '> Business routes are served under the `/v1` prefix; `health*` probes are unversioned (see ADR-006).',
  );
  lines.push('');
  lines.push('| Method | Route | Source |');
  lines.push('| ------ | ----- | ------ |');
  for (const r of routes) {
    lines.push(`| ${r.method} | \`${r.path}\` | \`${r.file}\` |`);
  }
  lines.push('');

  // Legend
  lines.push(
    '**Legend:** ✅ present · 🟡 partial · ⬜ not started · 🔒 gated on external validation (legal/provider).',
  );
  lines.push('');
  lines.push(END);
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Splice into the doc
// ---------------------------------------------------------------------------
function splice(existing, block) {
  const b = existing.indexOf(BEGIN);
  const e = existing.indexOf(END);
  if (b === -1 || e === -1 || e < b) {
    throw new Error(`Markers not found in ${relative(ROOT, DOC)}. Expected ${BEGIN} ... ${END}.`);
  }
  return existing.slice(0, b) + block + existing.slice(e + END.length);
}

// The "as of" line is volatile (commit stamp) — normalize it out for --check so a
// doc generated at commit N-1 does not read as "stale" against HEAD N in CI.
const stripStamp = (s) => s.replace(/\*\*As of commit\*\*.*(\r?\n)?/g, '');

function main() {
  const check = process.argv.includes('--check');
  if (!existsSync(DOC)) {
    console.error(`[build-status] ${relative(ROOT, DOC)} does not exist.`);
    process.exit(1);
  }
  const existing = readFileSync(DOC, 'utf8');
  const block = buildBlock();
  const next = splice(existing, block);

  if (check) {
    if (stripStamp(existing) !== stripStamp(next)) {
      console.error('[build-status] STALE: build-status.md does not match repository state.');
      console.error('[build-status] Run `pnpm build:status` and commit the result.');
      process.exit(1);
    }
    console.log('[build-status] up to date.');
    return;
  }

  if (existing === next) {
    console.log('[build-status] no changes.');
    return;
  }
  writeFileSync(DOC, next);
  console.log(`[build-status] updated ${relative(ROOT, DOC)}.`);
}

main();
