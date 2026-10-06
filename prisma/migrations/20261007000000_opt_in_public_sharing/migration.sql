-- Public sharing becomes opt-in. Before this, any workspace-visible decision
-- was readable by anyone who had its id at /share/<id>. Now a decision is
-- public only once someone creates a link for it, the link uses a random token
-- instead of the id, and it can be revoked. Admins can turn public links off
-- for the whole workspace.
--
-- Existing /share/<id> URLs stop working after this migration (by design).
ALTER TABLE "Workspace" ADD COLUMN "publicSharing" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Decision" ADD COLUMN "shareToken" TEXT;
CREATE UNIQUE INDEX "Decision_shareToken_key" ON "Decision"("shareToken");
