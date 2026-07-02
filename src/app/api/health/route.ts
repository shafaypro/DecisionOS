import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

type DepStatus = "up" | "down" | "unconfigured";

async function checkDatabase(): Promise<DepStatus> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return "up";
  } catch {
    return "down";
  }
}

async function checkRedis(): Promise<DepStatus> {
  const url = process.env.REDIS_URL;
  if (!url) return "unconfigured";
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Redis = require("ioredis");
    const client = new Redis(url, { maxRetriesPerRequest: 1, connectTimeout: 2_000 });
    await client.ping();
    await client.quit();
    return "up";
  } catch {
    return "down";
  }
}

export async function GET() {
  const startedAt = Date.now();

  const [database, redis] = await Promise.all([checkDatabase(), checkRedis()]);

  const latencyMs = Date.now() - startedAt;

  // Liveness: any required dependency being down makes us unhealthy.
  // Redis is optional - its absence never makes the service unhealthy.
  const healthy = database === "up";

  if (!healthy) {
    logger.error("health check: required dependency is down", { database, redis, latencyMs });
  }

  return NextResponse.json(
    {
      ok: healthy,
      service: "decisionos",
      time: new Date().toISOString(),
      latencyMs,
      dependencies: { database, redis },
    },
    { status: healthy ? 200 : 503 }
  );
}
