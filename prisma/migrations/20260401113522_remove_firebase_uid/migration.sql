/*
  Warnings:

  - You are about to drop the column `firebase_uid` on the `users` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "users_firebase_uid_key";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "firebase_uid";
