-- AlterTable
ALTER TABLE "library" ADD COLUMN     "category" TEXT DEFAULT 'premium',
ADD COLUMN     "description" TEXT,
ADD COLUMN     "thumbnail_url" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "role" TEXT NOT NULL DEFAULT 'USER',
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'active';
