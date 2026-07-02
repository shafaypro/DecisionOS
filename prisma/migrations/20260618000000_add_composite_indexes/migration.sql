-- Migration: add_composite_indexes
-- Adds composite and missing single-column indexes identified during the
-- world-class backend audit. These reduce full-table scans on the most common
-- query patterns in the application.

-- Decision: composite for the common list-with-filter-and-sort query
CREATE INDEX IF NOT EXISTS "Decision_workspaceId_status_updatedAt_idx"
  ON "Decision"("workspaceId", "status", "updatedAt");

-- Decision: covers cron review-reminder queries (WHERE reviewDate < X AND status != 'archived')
CREATE INDEX IF NOT EXISTS "Decision_reviewDate_status_idx"
  ON "Decision"("reviewDate", "status");

-- DecisionEvent: activity feed by user
CREATE INDEX IF NOT EXISTS "DecisionEvent_userId_idx"
  ON "DecisionEvent"("userId");

CREATE INDEX IF NOT EXISTS "DecisionEvent_decisionId_userId_idx"
  ON "DecisionEvent"("decisionId", "userId");

-- DecisionNote: "did this user comment on this decision?"
CREATE INDEX IF NOT EXISTS "DecisionNote_decisionId_userId_idx"
  ON "DecisionNote"("decisionId", "userId");

-- DecisionTag: "all decisions with tag X"
CREATE INDEX IF NOT EXISTS "DecisionTag_tagId_idx"
  ON "DecisionTag"("tagId");

-- InAppNotification: paginated unread feed ordered by time
CREATE INDEX IF NOT EXISTS "InAppNotification_userId_isRead_createdAt_idx"
  ON "InAppNotification"("userId", "isRead", "createdAt");

-- AnalyticsEvent: cohort-level analysis by user
CREATE INDEX IF NOT EXISTS "AnalyticsEvent_userId_idx"
  ON "AnalyticsEvent"("userId");
