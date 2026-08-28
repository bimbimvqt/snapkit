ALTER TABLE "User"
ADD COLUMN "googleSubject" TEXT,
ADD COLUMN "avatarUrl" TEXT;

CREATE UNIQUE INDEX "User_googleSubject_key" ON "User"("googleSubject");
