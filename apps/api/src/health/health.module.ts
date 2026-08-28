import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

/** Liveness/readiness probes. The DB handle comes from the global DatabaseModule. */
@Module({
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
