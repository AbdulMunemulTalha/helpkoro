import { describe, it, expect } from 'vitest';
import { denyAll, ROLES } from './index';

describe('denyAll evaluator', () => {
  it('denies by default with a stable reason', () => {
    const decision = denyAll({
      roles: [ROLES.ADMINISTRATOR],
      resource: 'campaign',
      action: 'publish',
      state: 'draft',
    });
    expect(decision.effect).toBe('deny');
    expect(decision.reason).toBe('NO_POLICY');
  });
});
