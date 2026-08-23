import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

/** Liveness/readiness probes. DB and Redis handles come from global modules. */
@Module({
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
