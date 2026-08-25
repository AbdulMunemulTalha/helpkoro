import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { CampaignsController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';
import { OrganizerCampaignsController } from './organizer-campaigns.controller';

/**
 * Campaign domain module (ADR-008). Registers the public discovery + creation
 * controller and the organizer-scoped management controller over a shared
 * {@link CampaignsService}. `AuditModule` provides the audit trail; feature
 * flags and the DB handle come from the global infra modules.
 */
@Module({
  imports: [AuditModule],
  controllers: [CampaignsController, OrganizerCampaignsController],
  providers: [CampaignsService],
  exports: [CampaignsService],
})
export class CampaignsModule {}
