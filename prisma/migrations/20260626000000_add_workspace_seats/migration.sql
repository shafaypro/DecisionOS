-- Migration: add_workspace_seats
-- Tracks the seat quantity last reconciled to the Stripe subscription so that
-- member add/remove can keep per-seat billing in sync without redundant Stripe
-- API calls. Both columns are nullable: existing rows reconcile lazily on the
-- next membership change.
ALTER TABLE "Workspace" ADD COLUMN "seats" INTEGER;
ALTER TABLE "Workspace" ADD COLUMN "seatsSyncedAt" TIMESTAMP(3);
