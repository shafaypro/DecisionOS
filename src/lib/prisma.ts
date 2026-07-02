import { PrismaClient } from "@/generated/prisma/client";
import { getDatabaseUrl } from "./env";

function createPrismaClient(): PrismaClient {
  const url = getDatabaseUrl();

  // PostgreSQL / Supabase / PlanetScale (postgres:// or postgresql://)
  if (url.startsWith("postgresql://") || url.startsWith("postgres://")) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Pool } = require("pg") as typeof import("pg");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaPg } = require("@prisma/adapter-pg") as typeof import("@prisma/adapter-pg");
    // Keep the pool small per instance: serverless/containers multiply replicas,
    // so a managed pooler (RDS Proxy / Cloud SQL connector / PgBouncer) should sit
    // in front for high fan-out. Override with DATABASE_POOL_MAX.
    const max = Number(process.env.DATABASE_POOL_MAX ?? 5) || 5;
    const pool = new Pool({ connectionString: url, max });
    const adapter = new PrismaPg(pool);
    return new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);
  }

  // Default: libsql / SQLite (file: or libsql://)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaLibSql } = require("@prisma/adapter-libsql") as typeof import("@prisma/adapter-libsql");
  const adapter = new PrismaLibSql({ url });
  return new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };
export const prisma = globalForPrisma.prisma ?? createPrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
