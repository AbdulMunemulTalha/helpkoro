import { describe, it, expect } from 'vitest';
import { ROLES, ALL_ROLES, isRole } from './roles';

describe('roles', () => {
  it('defines exactly eight roles', () => {
    expect(ALL_ROLES).toHaveLength(8);
    expect(new Set(ALL_ROLES).size).toBe(8);
  });

  it('narrows known role strings', () => {
    expect(isRole(ROLES.ADMINISTRATOR)).toBe(true);
    expect(isRole('donor')).toBe(true);
    expect(isRole('superuser')).toBe(false);
  });
});
