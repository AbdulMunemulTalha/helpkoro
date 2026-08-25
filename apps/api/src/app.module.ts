import { Module, type DynamicModule } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import type { Logger } from 'pino';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { EnvelopeInterceptor } from './common/interceptors/envelope.interceptor';
import { LoggerModule } from './common/logger/logger.module';
import { ConfigModule } from './config/config.module';
import { DiagnosticsController } from './v1/diagnostics.controller';
import { FeatureFlagsModule } from './feature-flags/feature-flags.module';
import { HealthModule } from './health/health.module';
import { DatabaseModule } from './infra/database.module';
import { RedisModule } from './infra/redis.module';
import { ReviewsModule } from './reviews/reviews.module';

export interface AppModuleOptions {
  /** The process-wide pino logger, created in the composition root. */
  logger: Logger;
}

/**
 * Root module. `forRoot` threads in the pre-built logger (also handed to the
 * Fastify adapter) and registers the global envelope interceptor + exception
 * filter that implement the ADR-006 wire contract.
 */
@Module({})
export class AppModule {
  static forRoot(options: AppModuleOptions): DynamicModule {
    return {
      module: AppModule,
      imports: [
        ConfigModule,
        LoggerModule.forRoot(options.logger),
        DatabaseModule,
        RedisModule,
        HealthModule,
        FeatureFlagsModule,
        AuditModule,
        AuthModule,
        CampaignsModule,
        ReviewsModule,
      ],
      controllers: [DiagnosticsController],
      providers: [
        { provide: APP_INTERCEPTOR, useClass: EnvelopeInterceptor },
        { provide: APP_FILTER, useClass: AllExceptionsFilter },
      ],
    };
  }
}
