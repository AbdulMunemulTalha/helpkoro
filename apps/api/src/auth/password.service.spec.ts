import { describe, expect, it } from 'vitest';
import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('hashes to an Argon2id encoded string (never the plaintext)', async () => {
    const hash = await service.hash('correct horse battery staple');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(hash).not.toContain('correct horse battery staple');
  });

  it('produces a distinct hash per call (random salt)', async () => {
    const [a, b] = await Promise.all([
      service.hash('same-password-123'),
      service.hash('same-password-123'),
    ]);
    expect(a).not.toBe(b);
  });

  it('verifies a correct password', async () => {
    const hash = await service.hash('super-secret-passphrase');
    await expect(service.verify(hash, 'super-secret-passphrase')).resolves.toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await service.hash('super-secret-passphrase');
    await expect(service.verify(hash, 'not-the-password')).resolves.toBe(false);
  });

  it('returns false (does not throw) on a malformed hash', async () => {
    await expect(service.verify('not-a-valid-argon2-hash', 'whatever')).resolves.toBe(false);
  });
});
