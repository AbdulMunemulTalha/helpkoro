import { Global, Module } from '@nestjs/common';
import { FeatureFlagsService } from './feature-flags.service';

/**
 * Feature flags are cross-cutting infra (staged rollouts): any domain module may
 * gate a surface behind a flag, so — like the DB/Redis/Config infra modules —
 * this is `@Global`. That is what the `CampaignsModule`/`ReviewsModule` comments
 * mean by "feature flags come from the global infra modules": consumers inject
 * {@link FeatureFlagsService} without importing this module explicitly.
 */
@Global()
@Module({
  providers: [FeatureFlagsService],
  exports: [FeatureFlagsService],
})
export class FeatureFlagsModule {}
