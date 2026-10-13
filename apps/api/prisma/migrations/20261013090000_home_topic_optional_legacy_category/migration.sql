-- Preserve existing category values as inert legacy data while allowing new weekly issues to omit them.
ALTER TABLE "home_topics" ALTER COLUMN "rec_type" DROP NOT NULL;
