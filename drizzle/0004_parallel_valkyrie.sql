CREATE TABLE "external_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"source" text NOT NULL,
	"intervals_id" text,
	"garmin_id" text,
	"dedup_key" text NOT NULL,
	"start_time" timestamp with time zone NOT NULL,
	"tz_offset_min" integer,
	"sport" text NOT NULL,
	"name" text,
	"device" text,
	"distance_m" real NOT NULL,
	"elapsed_s" integer NOT NULL,
	"summary" jsonb NOT NULL,
	"summary_version" integer NOT NULL,
	"streams" jsonb,
	"import_error" text,
	"linked_run_id" uuid,
	"link_mode" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "run_history" ADD COLUMN "started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "run_history" ADD COLUMN "ended_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "run_history" ADD COLUMN "summary" jsonb;--> statement-breakpoint
ALTER TABLE "run_history" ADD COLUMN "summary_version" integer;--> statement-breakpoint
ALTER TABLE "external_activities" ADD CONSTRAINT "external_activities_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_activities" ADD CONSTRAINT "external_activities_linked_run_id_run_history_id_fk" FOREIGN KEY ("linked_run_id") REFERENCES "public"."run_history"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "external_activities_user_dedup_idx" ON "external_activities" USING btree ("user_id","dedup_key");--> statement-breakpoint
CREATE UNIQUE INDEX "external_activities_user_intervals_idx" ON "external_activities" USING btree ("user_id","intervals_id");--> statement-breakpoint
CREATE UNIQUE INDEX "external_activities_linked_run_idx" ON "external_activities" USING btree ("linked_run_id");--> statement-breakpoint
CREATE INDEX "external_activities_user_start_idx" ON "external_activities" USING btree ("user_id","start_time");--> statement-breakpoint
CREATE INDEX "run_history_user_started_idx" ON "run_history" USING btree ("user_id","started_at");