import { Controller, Get, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { SkipEnvelope } from '../common/interceptors/skip-envelope.decorator';
import { HealthService, type LivenessResult } from './health.service';

/**
 * Health probes. Registered outside the `/v1` prefix (see `setGlobalPrefix`
 * exclude) and opted out of the success envelope — orchestrators expect the raw
 * `{ status, checks }` shape (ADR-006).
 */
@Controller()
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get('health')
  @SkipEnvelope()
  live(): LivenessResult {
    return this.health.live();
  }

  @Get('health/ready')
  @SkipEnvelope()
  async ready(@Res({ passthrough: true }) reply: FastifyReply): Promise<unknown> {
    const { ok, body } = await this.health.ready();
    void reply.status(ok ? 200 : 503);
    return body;
  }
}
