-- Migration: remove_billing
-- DecisionOS is open source with no paid plans. Drop all billing/plan columns
-- from Workspace: there are no more tiers, no per-seat billing, and no Stripe
-- linkage. Unique indexes on the Stripe id columns go with them.

-- DropIndex (unique constraints on the Stripe id columns, if present)
DROP INDEX IF EXISTS "Workspace_stripeCustomerId_key";
DROP INDEX IF EXISTS "Workspace_stripeSubscriptionId_key";

-- AlterTable
ALTER TABLE "Workspace" DROP COLUMN IF EXISTS "plan";
ALTER TABLE "Workspace" DROP COLUMN IF EXISTS "stripeCustomerId";
ALTER TABLE "Workspace" DROP COLUMN IF EXISTS "stripeSubscriptionId";
ALTER TABLE "Workspace" DROP COLUMN IF EXISTS "planRenewsAt";
ALTER TABLE "Workspace" DROP COLUMN IF EXISTS "seats";
ALTER TABLE "Workspace" DROP COLUMN IF EXISTS "seatsSyncedAt";
