import { Controller, Get, Query } from '@nestjs/common';
import { AppError } from '@helpkoro/contracts';
import { ConfigService } from '../config/config.service';

/**
 * Non-production diagnostics that exercise the ADR-006 wire contract end to end:
 * `echo` returns a success envelope, `boom` throws an {@link AppError} so the
 * exception filter produces an error envelope. Both are disabled in production.
 * Mounted under the `/v1` global prefix ⇒ `/v1/_diagnostics/...`.
 */
@Controller('_diagnostics')
export class DiagnosticsController {
  constructor(private readonly config: ConfigService) {}

  @Get('echo')
  echo(@Query('message') message?: string): { message: string; service: string } {
    this.assertEnabled();
    return {
      message: message ?? 'pong',
      service: this.config.get('OTEL_SERVICE_NAME'),
    };
  }

  @Get('boom')
  boom(): never {
    this.assertEnabled();
    throw new AppError(
      'STATE_CONFLICT',
      'Diagnostics boom: intentional error for envelope verification.',
    );
  }

  private assertEnabled(): void {
    if (this.config.isProduction) {
      throw new AppError('FORBIDDEN', 'Diagnostics are disabled in production.');
    }
  }
}
