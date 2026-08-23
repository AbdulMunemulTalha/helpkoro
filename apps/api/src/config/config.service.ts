import { Injectable } from '@nestjs/common';
import { apiEnvSchema, parseEnv, type ApiEnv } from '@helpkoro/contracts';

/**
 * Typed access to validated environment configuration. `parseEnv` runs in the
 * constructor, so an invalid environment fails the app at DI initialisation
 * (fail-fast at boot) rather than surfacing later as a runtime error. Never logs
 * values — only the offending paths (see `parseEnv`).
 */
@Injectable()
export class ConfigService {
  readonly env: ApiEnv = parseEnv(apiEnvSchema);

  get<K extends keyof ApiEnv>(key: K): ApiEnv[K] {
    return this.env[key];
  }

  get isProduction(): boolean {
    return this.env.NODE_ENV === 'production';
  }

  get isDevelopment(): boolean {
    return this.env.NODE_ENV === 'development';
  }
}
