import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { users, userCredentials, userRoles, type DatabaseHandle } from '@helpkoro/db';
import { AppError, uuidv7, type PublicUser, type AccountStatus } from '@helpkoro/contracts';
import { ROLES, type Role } from '@helpkoro/domain';
import { DATABASE } from '../infra/database.module';

interface CreateUserInput {
  email: string;
  displayName: string;
  locale: 'en' | 'bn';
  passwordHash: string;
}

/** Postgres unique-violation SQLSTATE. */
const UNIQUE_VIOLATION = '23505';

function hasPgCode(err: unknown, code: string): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && err.code === code;
}

/**
 * Reads and writes for accounts, their password credentials, and role grants.
 * The Argon2id hash lives in a separate table (`user_credentials`) and is only
 * loaded when explicitly needed for verification.
 */
@Injectable()
export class UsersService {
  constructor(@Inject(DATABASE) private readonly handle: DatabaseHandle) {}

  private get db() {
    return this.handle.db;
  }

  async findByEmail(email: string) {
    return this.db.query.users.findFirst({ where: eq(users.email, email) });
  }

  async findById(id: string) {
    return this.db.query.users.findFirst({ where: eq(users.id, id) });
  }

  async getRoles(userId: string): Promise<Role[]> {
    const rows = await this.db
      .select({ role: userRoles.role })
      .from(userRoles)
      .where(eq(userRoles.userId, userId));
    // Only surface roles still in the domain vocabulary (defensive).
    return rows.map((r) => r.role).filter(isRoleValue);
  }

  async getPasswordHash(userId: string): Promise<string | undefined> {
    const row = await this.db.query.userCredentials.findFirst({
      where: eq(userCredentials.userId, userId),
      columns: { passwordHash: true },
    });
    return row?.passwordHash;
  }

  /**
   * Create an account with its credential and default donor role in one
   * transaction. Throws STATE_CONFLICT if the (normalised) email already exists.
   */
  async createUser(input: CreateUserInput): Promise<string> {
    const userId = uuidv7();
    try {
      await this.db.transaction(async (tx) => {
        await tx.insert(users).values({
          id: userId,
          email: input.email,
          displayName: input.displayName,
          locale: input.locale,
        });
        await tx.insert(userCredentials).values({ userId, passwordHash: input.passwordHash });
        await tx.insert(userRoles).values({ id: uuidv7(), userId, role: ROLES.DONOR });
      });
    } catch (err) {
      if (hasPgCode(err, UNIQUE_VIOLATION)) {
        throw new AppError('STATE_CONFLICT', 'An account with that email already exists.');
      }
      throw err;
    }
    return userId;
  }

  async updatePasswordHash(userId: string, passwordHash: string): Promise<void> {
    const now = new Date();
    await this.db.transaction(async (tx) => {
      await tx
        .update(userCredentials)
        .set({ passwordHash, passwordUpdatedAt: now, updatedAt: now })
        .where(eq(userCredentials.userId, userId));
      await tx.update(users).set({ updatedAt: now }).where(eq(users.id, userId));
    });
  }

  /** Grant a role. Returns true if newly added, false if the user already had it. */
  async assignRole(userId: string, role: Role, grantedBy: string): Promise<boolean> {
    const inserted = await this.db
      .insert(userRoles)
      .values({ id: uuidv7(), userId, role, grantedBy })
      .onConflictDoNothing({ target: [userRoles.userId, userRoles.role] })
      .returning({ id: userRoles.id });
    return inserted.length > 0;
  }

  /** Revoke a role. Returns true if a grant was removed. */
  async revokeRole(userId: string, role: Role): Promise<boolean> {
    const deleted = await this.db
      .delete(userRoles)
      .where(and(eq(userRoles.userId, userId), eq(userRoles.role, role)))
      .returning({ id: userRoles.id });
    return deleted.length > 0;
  }

  /** Assemble the client-facing user view (account fields + current roles). */
  async getPublicUser(userId: string): Promise<PublicUser | undefined> {
    const user = await this.findById(userId);
    if (!user) return undefined;
    const roles = await this.getRoles(userId);
    return toPublicUser(user, roles);
  }
}

function isRoleValue(value: string): value is Role {
  return (Object.values(ROLES) as string[]).includes(value);
}

/** Map a persisted user row + roles to the ADR-006 public shape. */
export function toPublicUser(
  user: {
    id: string;
    email: string;
    displayName: string;
    emailVerified: boolean;
    status: AccountStatus;
    locale: 'en' | 'bn';
    createdAt: Date;
  },
  roles: readonly string[],
): PublicUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    emailVerified: user.emailVerified,
    status: user.status,
    locale: user.locale,
    roles: [...roles],
    createdAt: user.createdAt.toISOString(),
  };
}
