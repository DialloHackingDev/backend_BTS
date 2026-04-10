-- AlterTable
ALTER TABLE "conferences" ADD COLUMN     "is_recording" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "recording_resource_id" TEXT,
ADD COLUMN     "recording_sid" TEXT,
ADD COLUMN     "recording_uid" INTEGER,
ADD COLUMN     "recording_stopped_at" TIMESTAMP(3);
