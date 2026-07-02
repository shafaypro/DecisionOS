-- CreateTable
CREATE TABLE "DecisionWatcher" (
    "id" TEXT NOT NULL,
    "decisionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisionWatcher_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DecisionWatcher_userId_idx" ON "DecisionWatcher"("userId");

-- CreateIndex
CREATE INDEX "DecisionWatcher_decisionId_idx" ON "DecisionWatcher"("decisionId");

-- CreateIndex
CREATE UNIQUE INDEX "DecisionWatcher_decisionId_userId_key" ON "DecisionWatcher"("decisionId", "userId");

-- AddForeignKey
ALTER TABLE "DecisionWatcher" ADD CONSTRAINT "DecisionWatcher_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "Decision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionWatcher" ADD CONSTRAINT "DecisionWatcher_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
