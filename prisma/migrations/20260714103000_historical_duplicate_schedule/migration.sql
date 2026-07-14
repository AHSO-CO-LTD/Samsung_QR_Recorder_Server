-- CreateEnum
CREATE TYPE "HistoricalDuplicateJobTrigger" AS ENUM ('MANUAL_RANGE', 'MANUAL_FULL', 'SCHEDULED_FULL');

-- CreateEnum
CREATE TYPE "HistoricalDuplicateScheduleFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- AlterTable
ALTER TABLE "historical_duplicate_jobs"
ADD COLUMN "trigger_type" "HistoricalDuplicateJobTrigger" NOT NULL DEFAULT 'MANUAL_RANGE';

-- CreateTable
CREATE TABLE "historical_duplicate_schedules" (
    "id" SERIAL NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "frequency" "HistoricalDuplicateScheduleFrequency" NOT NULL DEFAULT 'DAILY',
    "run_time" TEXT NOT NULL DEFAULT '00:00',
    "day_of_week" INTEGER NOT NULL DEFAULT 1,
    "day_of_month" INTEGER NOT NULL DEFAULT 1,
    "last_run_at" TIMESTAMP(3),
    "next_run_at" TIMESTAMP(3),
    "updated_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "historical_duplicate_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "historical_duplicate_jobs_trigger_type_created_at_idx" ON "historical_duplicate_jobs"("trigger_type", "created_at");

-- CreateIndex
CREATE INDEX "historical_duplicate_schedules_enabled_next_run_at_idx" ON "historical_duplicate_schedules"("enabled", "next_run_at");

-- AddForeignKey
ALTER TABLE "historical_duplicate_schedules"
ADD CONSTRAINT "historical_duplicate_schedules_updated_by_fkey"
FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
