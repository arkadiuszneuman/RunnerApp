CREATE TABLE "user_integrations" (
	"user_id" text NOT NULL,
	"provider" text NOT NULL,
	"secret" text NOT NULL,
	"key_hint" text NOT NULL,
	"athlete_id" text,
	"athlete_name" text,
	"status" text DEFAULT 'ok' NOT NULL,
	"last_error" text,
	"last_synced_at" timestamp with time zone,
	"full_sync_done_at" timestamp with time zone,
	"sync_lock_until" timestamp with time zone,
	"retry_after" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_integrations_user_id_provider_pk" PRIMARY KEY("user_id","provider")
);
--> statement-breakpoint
ALTER TABLE "user_integrations" ADD CONSTRAINT "user_integrations_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;