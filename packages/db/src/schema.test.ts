import { describe, it, expect } from 'vitest';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { auditEvents, featureFlags, outboxEvents } from './schema';

describe('audit_events', () => {
  const cfg = getTableConfig(auditEvents);
  const columns = cfg.columns.map((c) => c.name);

  it('carries actor, entity ref, correlation, and safe summaries', () => {
    expect(cfg.name).toBe('audit_events');
    expect(columns).toEqual(
      expect.arrayContaining([
        'id',
        'occurred_at',
        'actor_id',
        'actor_type',
        'source_session_id',
        'action',
        'entity_type',
        'entity_id',
        'correlation_id',
        'before_summary',
        'after_summary',
      ]),
    );
  });

  it('has no updated_at column (append-only)', () => {
    expect(columns).not.toContain('updated_at');
  });
});

describe('feature_flags', () => {
  const cfg = getTableConfig(featureFlags);
  const columns = cfg.columns.map((c) => c.name);

  it('is keyed by a string key and carries the standard columns', () => {
    expect(cfg.name).toBe('feature_flags');
    expect(columns).toEqual(
      expect.arrayContaining(['key', 'enabled', 'created_at', 'updated_at', 'version']),
    );
  });
});

describe('outbox_events', () => {
  const cfg = getTableConfig(outboxEvents);
  const columns = cfg.columns.map((c) => c.name);

  it('carries dispatch bookkeeping columns', () => {
    expect(cfg.name).toBe('outbox_events');
    expect(columns).toEqual(
      expect.arrayContaining(['id', 'event_type', 'payload', 'status', 'attempts', 'available_at']),
    );
  });
});
