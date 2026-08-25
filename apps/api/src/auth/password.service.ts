import { Injectable } from '@nestjs/common';
import { hash, verify, Algorithm } from '@node-rs/argon2';
import {
  ARGON2ID_MEMORY_COST,
  ARGON2ID_TIME_COST,
  ARGON2ID_PARALLELISM,
} from '@helpkoro/contracts';

/**
 * Password hashing with Argon2id (ADR-005). Parameters come from
 * `@helpkoro/contracts` so the API and the database seed never drift. The
 * `@node-rs/argon2` binding ships prebuilt binaries for the platforms we build
 * on, so no native toolchain is required.
 */
@Injectable()
export class PasswordService {
  private readonly options = {
    algorithm: Algorithm.Argon2id,
    memoryCost: ARGON2ID_MEMORY_COST,
    timeCost: ARGON2ID_TIME_COST,
    parallelism: ARGON2ID_PARALLELISM,
  };

  hash(plain: string): Promise<string> {
    return hash(plain, this.options);
  }

  /**
   * Verify a plaintext password against a stored hash. Argon2's encoded hash
   * carries its own parameters, so verification does not need the options.
   * Returns false on any malformed hash rather than throwing.
   */
  async verify(hashed: string, plain: string): Promise<boolean> {
    try {
      return await verify(hashed, plain);
    } catch {
      return false;
    }
  }
}
