import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

/**
 * Review module (ADR-008). Reviewer queue + case workspace + decision recording
 * over a shared {@link ReviewsService}. `AuditModule` provides the audit trail;
 * the DB handle comes from the global infra module.
 */
@Module({
  imports: [AuditModule],
  controllers: [ReviewsController],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
