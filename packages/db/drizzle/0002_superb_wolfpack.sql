CREATE TABLE "campaign_submissions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"campaign_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"submitted_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organizer_id" uuid NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"story" text,
	"category" text NOT NULL,
	"subcategory" text,
	"beneficiary_type" text NOT NULL,
	"beneficiary_relationship" text,
	"beneficiary_consent_status" text DEFAULT 'not_required' NOT NULL,
	"intended_use" text,
	"timeline" text,
	"goal_amount" integer NOT NULL,
	"currency" text NOT NULL,
	"primary_language" text DEFAULT 'bn' NOT NULL,
	"slug" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"submitted_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campaigns_category_check" CHECK ("campaigns"."category" in ('medical', 'emergency', 'memorial', 'education', 'community', 'disaster_response', 'nonprofit', 'personal')),
	CONSTRAINT "campaigns_beneficiary_type_check" CHECK ("campaigns"."beneficiary_type" in ('myself', 'someone_else', 'organization')),
	CONSTRAINT "campaigns_beneficiary_consent_check" CHECK ("campaigns"."beneficiary_consent_status" in ('not_required', 'pending', 'granted')),
	CONSTRAINT "campaigns_status_check" CHECK ("campaigns"."status" in ('draft', 'submitted', 'under_review', 'live', 'paused', 'closed', 'rejected')),
	CONSTRAINT "campaigns_primary_language_check" CHECK ("campaigns"."primary_language" in ('en', 'bn')),
	CONSTRAINT "campaigns_goal_amount_positive_check" CHECK ("campaigns"."goal_amount" >= 1)
);
--> statement-breakpoint
CREATE TABLE "review_cases" (
	"id" uuid PRIMARY KEY NOT NULL,
	"campaign_id" uuid NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"assigned_reviewer_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "review_cases_status_check" CHECK ("review_cases"."status" in ('queued', 'in_review', 'needs_information', 'resolved'))
);
--> statement-breakpoint
CREATE TABLE "review_decisions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"review_case_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"reviewer_id" uuid NOT NULL,
	"decision" text NOT NULL,
	"reason_code" text NOT NULL,
	"organizer_explanation" text,
	"evidence_refs" jsonb,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "review_decisions_decision_check" CHECK ("review_decisions"."decision" in ('approve', 'reject', 'request_info'))
);
--> statement-breakpoint
ALTER TABLE "campaign_submissions" ADD CONSTRAINT "campaign_submissions_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_submissions" ADD CONSTRAINT "campaign_submissions_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_organizer_id_users_id_fk" FOREIGN KEY ("organizer_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_cases" ADD CONSTRAINT "review_cases_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_cases" ADD CONSTRAINT "review_cases_assigned_reviewer_id_users_id_fk" FOREIGN KEY ("assigned_reviewer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_decisions" ADD CONSTRAINT "review_decisions_review_case_id_review_cases_id_fk" FOREIGN KEY ("review_case_id") REFERENCES "public"."review_cases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_decisions" ADD CONSTRAINT "review_decisions_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_decisions" ADD CONSTRAINT "review_decisions_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "campaign_submissions_campaign_version_unique" ON "campaign_submissions" USING btree ("campaign_id","version");--> statement-breakpoint
CREATE INDEX "campaign_submissions_campaign_idx" ON "campaign_submissions" USING btree ("campaign_id");--> statement-breakpoint
CREATE UNIQUE INDEX "campaigns_slug_unique" ON "campaigns" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "campaigns_organizer_idx" ON "campaigns" USING btree ("organizer_id");--> statement-breakpoint
CREATE INDEX "campaigns_status_created_idx" ON "campaigns" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "review_cases_status_opened_idx" ON "review_cases" USING btree ("status","opened_at");--> statement-breakpoint
CREATE INDEX "review_cases_campaign_idx" ON "review_cases" USING btree ("campaign_id");--> statement-breakpoint
CREATE UNIQUE INDEX "review_cases_one_open_per_campaign" ON "review_cases" USING btree ("campaign_id") WHERE "review_cases"."status" <> 'resolved';--> statement-breakpoint
CREATE INDEX "review_decisions_case_idx" ON "review_decisions" USING btree ("review_case_id");--> statement-breakpoint
CREATE INDEX "review_decisions_campaign_idx" ON "review_decisions" USING btree ("campaign_id");