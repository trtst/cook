-- Remove preference fields for the retired food-expiry reminder feature.
ALTER TABLE "user_notification_settings"
  DROP COLUMN "fridge_enabled",
  DROP COLUMN "fridge_days",
  DROP COLUMN "reminder_dot_only";
