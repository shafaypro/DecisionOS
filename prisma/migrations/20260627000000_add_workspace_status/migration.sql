-- Migration: add_workspace_status
-- Adds a lifecycle status to workspaces, controlled by the platform (provider)
-- console. A "suspended" workspace is locked out for its own members while still
-- reachable by platform admins. Defaults to "active" so existing rows are
-- unaffected.
ALTER TABLE "Workspace" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active';
