-- garmin_id was read from the full Garmin account export's `<email>_<number>.fit` file names, but
-- that number identifies the uploaded file, not the activity: Garmin Connect can't open any of
-- them. The stored ids can't be told apart from correct ones, so all are cleared. They come back
-- from a re-import of the export (now read from its summarizedActivities JSON) and from
-- intervals.icu: resetting full_sync_done_at makes the next sync re-list the whole history once,
-- recording the Garmin id intervals.icu knows for each activity.
UPDATE "external_activities" SET "garmin_id" = NULL WHERE "garmin_id" IS NOT NULL;--> statement-breakpoint
UPDATE "user_integrations" SET "full_sync_done_at" = NULL WHERE "provider" = 'intervals';
