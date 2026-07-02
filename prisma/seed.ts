import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import bcrypt from "bcryptjs";

const DATABASE_URL = process.env.DATABASE_URL ?? "file:./dev.db";

// Pick the driver adapter by URL scheme, mirroring src/lib/prisma.ts, so the
// same `npm run seed` works against local SQLite and production Postgres.
function createSeedClient(): PrismaClient {
  if (DATABASE_URL.startsWith("postgresql://") || DATABASE_URL.startsWith("postgres://")) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Pool } = require("pg") as typeof import("pg");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaPg } = require("@prisma/adapter-pg") as typeof import("@prisma/adapter-pg");
    const adapter = new PrismaPg(new Pool({ connectionString: DATABASE_URL, max: 2 }));
    return new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaLibSql } = require("@prisma/adapter-libsql") as typeof import("@prisma/adapter-libsql");
  const adapter = new PrismaLibSql({ url: DATABASE_URL });
  return new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);
}

const prisma = createSeedClient();

async function main() {
  console.log("🌱 Seeding database...");

  const passwordHash = await bcrypt.hash("password123", 12);

  // Create workspace
  const workspace = await prisma.workspace.upsert({
    where: { slug: "acme-demo" },
    update: {},
    create: { name: "Acme Demo", slug: "acme-demo" },
  });

  // Create users
  const admin = await prisma.user.upsert({
    where: { email: "admin@acme.demo" },
    update: {},
    create: { name: "Alex Chen", email: "admin@acme.demo", passwordHash },
  });

  const member1 = await prisma.user.upsert({
    where: { email: "sarah@acme.demo" },
    update: {},
    create: { name: "Sarah Kim", email: "sarah@acme.demo", passwordHash },
  });

  const member2 = await prisma.user.upsert({
    where: { email: "james@acme.demo" },
    update: {},
    create: { name: "James Park", email: "james@acme.demo", passwordHash },
  });

  // Create memberships
  for (const [user, role] of [[admin, "admin"], [member1, "member"], [member2, "member"]] as const) {
    await prisma.workspaceMembership.upsert({
      where: { workspaceId_userId: { workspaceId: workspace.id, userId: user.id } },
      update: {},
      create: { workspaceId: workspace.id, userId: user.id, role },
    });
  }

  // Helper to create decision
  async function createDecision(data: {
    title: string;
    summary: string;
    category: string;
    status: string;
    outcomeStatus: string;
    impactLevel: string;
    problemStatement: string;
    chosenOption: string;
    rationale: string;
    alternativesConsidered: string;
    assumptions?: string;
    risks?: string;
    createdByUserId: string;
    ownerUserId?: string;
    decisionDate?: Date;
    reviewDate?: Date;
    reviewedAt?: Date;
  }) {
    const decision = await prisma.decision.create({
      data: {
        workspaceId: workspace.id,
        ...data,
      },
    });

    await prisma.decisionEvent.create({
      data: {
        decisionId: decision.id,
        userId: data.createdByUserId,
        eventType: "created",
        newValueJson: JSON.stringify({ title: data.title, status: data.status }),
      },
    });

    return decision;
  }

  const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
  const threeMonthsAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // 1. Architecture decision (validated)
  const d1 = await createDecision({
    title: "Migrate to PostgreSQL for production database",
    summary: "Replacing our SQLite development database with PostgreSQL for production scalability",
    category: "engineering",
    status: "validated",
    outcomeStatus: "successful",
    impactLevel: "high",
    problemStatement:
      "Our SQLite database is causing concurrency issues under load and we need a production-grade solution that supports multiple concurrent writers, better indexing, and replication for high availability.",
    chosenOption:
      "Migrate to PostgreSQL hosted on AWS RDS with read replicas for the dashboard queries.",
    rationale:
      "PostgreSQL offers the relational model we need, excellent performance, proven reliability at scale, and strong ecosystem support. AWS RDS removes operational overhead while read replicas solve our dashboard performance bottleneck.",
    alternativesConsidered:
      "1. MySQL: Similar capabilities but PostgreSQL has better JSON support and JSONB indexing which we rely on for our event model.\n2. PlanetScale: Serverless MySQL with branching, but vendor lock-in concerns and less flexibility.\n3. MongoDB: Schema flexibility not needed for our structured decision model. Adds operational complexity.",
    assumptions: "Our team has sufficient PostgreSQL operational knowledge. AWS RDS cost fits within our infrastructure budget.",
    risks: "Migration of existing data may have schema differences. Performance regression during initial migration period.",
    createdByUserId: admin.id,
    ownerUserId: member1.id,
    decisionDate: sixMonthsAgo,
    reviewDate: threeMonthsAgo,
    reviewedAt: threeMonthsAgo,
  });

  await prisma.decisionReview.create({
    data: {
      decisionId: d1.id,
      reviewedByUserId: admin.id,
      outcomeStatus: "successful",
      summary: "Migration completed smoothly. Database performance improved significantly. P95 query latency dropped from 450ms to 85ms.",
      lessonsLearned: "Blue-green deployment made the migration zero-downtime. Should apply this pattern to future migrations.",
      followUpAction: "Set up automated failover testing and document the migration runbook for future reference.",
    },
  });

  // 2. Product strategy decision (decided)
  const d2 = await createDecision({
    title: "Focus Q2 roadmap on decision review workflow",
    summary: "Prioritizing the review and outcome tracking features over new AI capabilities",
    category: "product",
    status: "decided",
    outcomeStatus: "unknown",
    impactLevel: "high",
    problemStatement:
      "We have two competing roadmap directions: (1) add AI-powered decision drafting, or (2) build the review and outcome tracking workflow. We need to commit to one for Q2 given resource constraints.",
    chosenOption:
      "Build the review workflow first - outcome tracking, review reminders, lessons learned capture, and the review history UI.",
    rationale:
      "The core product promise is decision traceability. Without a review loop, decisions become archives rather than operational tools. User interviews confirmed that teams forget to review decisions because there's no structured prompt. AI drafting is a nice-to-have but doesn't address the core usage gap.",
    alternativesConsidered:
      "1. AI drafting first: Attractive demo feature but doesn't drive retention or product differentiation.\n2. Build both: Not feasible with current team size without quality suffering.\n3. Wait for more user data: Risk of losing early adopters due to incomplete core workflow.",
    assumptions: "Review workflow adoption will drive retention. Teams have review cadences they want to systematize.",
    risks: "If teams don't adopt the review workflow, we've delayed AI features unnecessarily.",
    createdByUserId: admin.id,
    ownerUserId: admin.id,
    decisionDate: oneMonthAgo,
    reviewDate: nextMonth,
  });

  // 3. Hiring decision (proposed)
  const d3 = await createDecision({
    title: "Hire a senior backend engineer with distributed systems experience",
    summary: "Adding backend engineering capacity for the data pipeline and API layer",
    category: "hiring",
    status: "proposed",
    outcomeStatus: "unknown",
    impactLevel: "high",
    problemStatement:
      "Our API response times are degrading as data volume grows. The founding team doesn't have deep distributed systems experience. We need to scale the data layer before launch.",
    chosenOption: "Hire one senior backend engineer (5+ years) with specific experience in high-throughput data pipelines.",
    rationale:
      "A senior hire over mid-level gives us expertise we can't grow fast enough internally. Distributed systems experience is the specific gap.",
    alternativesConsidered:
      "1. Two mid-level engineers: More output but neither has the systems depth we need right now.\n2. Contractor: Faster but no knowledge retention.\n3. Optimize existing code: Buys 2-3 months but doesn't solve the fundamental capacity issue.",
    assumptions: "We can attract senior talent at our current compensation band. Onboarding takes 4-6 weeks.",
    risks: "Long hiring cycle. Risk of poor culture fit at this stage.",
    createdByUserId: member2.id,
    ownerUserId: member2.id,
    decisionDate: new Date(),
    reviewDate: nextMonth,
  });

  // 4. Business/vendor decision (decided)
  const d4 = await createDecision({
    title: "Use Resend for transactional email instead of SendGrid",
    summary: "Switching email provider for better developer experience and cost",
    category: "business",
    status: "decided",
    outcomeStatus: "unknown",
    impactLevel: "low",
    problemStatement:
      "SendGrid's API is complex, pricing is unpredictable at scale, and their developer experience is outdated. We need transactional email for review reminders and notifications.",
    chosenOption: "Switch to Resend - modern API, React email templates, generous free tier, predictable pricing.",
    rationale:
      "Resend has a significantly better developer experience, supports React Email templates that match our codebase, and has transparent pricing. The free tier covers our current volume.",
    alternativesConsidered:
      "1. Postmark: Good deliverability but higher cost for our volume.\n2. AWS SES: Cheap but requires significant operational setup.\n3. Mailgun: Pricing concerns after recent changes.",
    createdByUserId: admin.id,
    ownerUserId: member1.id,
    decisionDate: oneMonthAgo,
    reviewDate: nextWeek,
  });

  // 5. Operations decision (under_review)
  const d5 = await createDecision({
    title: "Implement weekly async decision review standup",
    summary: "Replacing monthly in-person review meetings with async weekly check-ins",
    category: "operations",
    status: "under_review",
    outcomeStatus: "mixed",
    impactLevel: "medium",
    problemStatement:
      "Monthly review meetings are too infrequent - decisions go stale and team loses context. But daily meetings are too much overhead for a small team.",
    chosenOption:
      "Weekly async standup: each decision owner posts a 2-sentence update in Slack by Thursday EOD. Meeting only for escalations.",
    rationale:
      "Async respects deep work time, weekly cadence keeps decisions fresh, and written updates create a lightweight audit trail.",
    alternativesConsidered:
      "1. Bi-weekly in-person: More structured but hard to schedule and decisions still go stale.\n2. Daily async: Too much overhead for non-critical decisions.",
    assumptions: "Team will maintain the async habit without external pressure.",
    risks: "Easy to skip when busy. May miss cross-decision dependencies.",
    createdByUserId: member1.id,
    ownerUserId: member1.id,
    decisionDate: threeMonthsAgo,
    reviewDate: lastWeek,
  });

  // 6. Draft decision
  const d6 = await createDecision({
    title: "Evaluate Vercel vs self-hosted deployment for production",
    summary: "Deciding where to host the production application",
    category: "engineering",
    status: "draft",
    outcomeStatus: "unknown",
    impactLevel: "medium",
    problemStatement:
      "As we approach production launch, we need to decide our hosting strategy. Vercel is faster to set up but self-hosting gives more control and cost predictability at scale.",
    chosenOption: "",
    rationale: "",
    alternativesConsidered: "Vercel, AWS ECS, Fly.io, Railway",
    assumptions: "Cost analysis needed before deciding.",
    risks: "Vendor lock-in with Vercel. Operational overhead with self-hosting.",
    createdByUserId: member2.id,
    decisionDate: new Date(),
    reviewDate: nextMonth,
  });

  // Add notes to decisions
  await prisma.decisionNote.createMany({
    data: [
      {
        decisionId: d1.id,
        userId: member1.id,
        content: "Just confirmed with DevOps - RDS Multi-AZ is available in our region. Adding read replica in us-east-1.",
      },
      {
        decisionId: d1.id,
        userId: admin.id,
        content: "Schema migration script is ready and tested in staging. Dry run showed zero data loss.",
      },
      {
        decisionId: d2.id,
        userId: member2.id,
        content: "Spoke with 3 beta users. All confirmed they'd use review reminders if we built them. Strong signal.",
      },
      {
        decisionId: d4.id,
        userId: member1.id,
        content: "Resend API key obtained. React Email templates integrated. Test emails sending correctly.",
      },
    ],
  });

  // Add links
  await prisma.decisionLink.createMany({
    data: [
      {
        decisionId: d1.id,
        label: "PostgreSQL Migration RFC",
        url: "https://example.com/rfc/postgres-migration",
        linkType: "doc",
        createdByUserId: admin.id,
      },
      {
        decisionId: d1.id,
        label: "DB Performance PR #142",
        url: "https://example.com/pr/142",
        linkType: "pull_request",
        createdByUserId: member1.id,
      },
      {
        decisionId: d2.id,
        label: "Q2 Roadmap Planning Doc",
        url: "https://example.com/docs/q2-roadmap",
        linkType: "doc",
        createdByUserId: admin.id,
      },
      {
        decisionId: d5.id,
        label: "Standup Process Issue #89",
        url: "https://example.com/issues/89",
        linkType: "issue",
        createdByUserId: member1.id,
      },
    ],
  });

  // Typed relations between decisions - drives the decision graph
  // d1 Migrate to PostgreSQL · d2 Q2 review workflow · d3 Hire backend eng
  // d4 Resend email · d5 Async review standup · d6 Vercel vs self-hosted
  await prisma.decisionRelation.createMany({
    data: [
      // The async review standup operationalizes the Q2 review-workflow bet.
      {
        fromDecisionId: d5.id,
        toDecisionId: d2.id,
        relationType: "depends_on",
        createdByUserId: member1.id,
      },
      // Resend's review reminders only matter once the review workflow exists.
      {
        fromDecisionId: d4.id,
        toDecisionId: d2.id,
        relationType: "depends_on",
        createdByUserId: admin.id,
      },
      // Scaling the data pipeline (the hire) builds on the Postgres migration.
      {
        fromDecisionId: d3.id,
        toDecisionId: d1.id,
        relationType: "depends_on",
        createdByUserId: member2.id,
      },
      // Hosting choice and the production database are intertwined.
      {
        fromDecisionId: d6.id,
        toDecisionId: d1.id,
        relationType: "relates_to",
        createdByUserId: member2.id,
      },
      // Self-hosting on Vercel pulls against the managed-RDS direction.
      {
        fromDecisionId: d6.id,
        toDecisionId: d3.id,
        relationType: "conflicts_with",
        createdByUserId: admin.id,
      },
    ],
  });

  // Seed built-in templates
  const builtInTemplates = [
    {
      id: "builtin-engineering-adr",
      name: "Engineering ADR",
      category: "engineering",
      description: "Architecture Decision Record - documents the context and consequences of an architectural choice.",
      defaultValues: JSON.stringify({
        impactLevel: "high",
        problemStatement: "We need to make an architectural decision that will affect the system's design and future evolution.",
        alternativesConsidered: "• Option A - [describe]\n• Option B - [describe]\n• Option C - [describe]",
        assumptions: "• The system will evolve beyond its current scale\n• Team has capacity to implement and maintain the chosen approach",
        risks: "• Technical debt if the wrong option is chosen\n• Migration cost if we need to change course later",
      }),
    },
    {
      id: "builtin-hiring-rubric",
      name: "Hiring Rubric",
      category: "hiring",
      description: "Structured hiring decision with candidate evaluation criteria.",
      defaultValues: JSON.stringify({
        impactLevel: "high",
        problemStatement: "We have an open position that needs to be filled to meet team capacity or capability goals.",
        alternativesConsidered: "• Hire senior IC - more expensive, faster ramp\n• Hire mid-level IC - lower cost, longer ramp\n• Contractor - no knowledge retention\n• Redistribute work internally - may cause burnout",
        assumptions: "• Compensation package is competitive\n• Onboarding takes 4-8 weeks",
        risks: "• Culture fit risk in early stage\n• Long hiring cycle may delay roadmap\n• Mis-hire is expensive to correct",
      }),
    },
    {
      id: "builtin-product-rfc",
      name: "Product RFC",
      category: "product",
      description: "Request for Comments - propose and validate a product direction before committing.",
      defaultValues: JSON.stringify({
        impactLevel: "high",
        problemStatement: "We have identified a user problem or opportunity that requires a product decision.",
        alternativesConsidered: "• Build it now - [tradeoffs]\n• Defer to next quarter - [tradeoffs]\n• Third-party solution - [tradeoffs]",
        assumptions: "• User interviews have validated the problem exists\n• We have engineering capacity to implement",
        risks: "• Feature may not drive measurable retention improvement\n• Scope creep during implementation",
      }),
    },
    {
      id: "builtin-business-go-no-go",
      name: "Business Go/No-Go",
      category: "business",
      description: "Evaluate whether to proceed with a business initiative, partnership, or investment.",
      defaultValues: JSON.stringify({
        impactLevel: "high",
        problemStatement: "We are evaluating whether to proceed with a business initiative that requires commitment of resources.",
        alternativesConsidered: "• Go - proceed with full commitment\n• No-Go - decline or defer\n• Pilot - limited trial before full commitment",
        assumptions: "• Market conditions remain stable\n• Internal resources are available as projected",
        risks: "• Opportunity cost if we proceed and it fails\n• Missed opportunity if we decline",
      }),
    },
    {
      id: "builtin-operations-process",
      name: "Operations Process",
      category: "operations",
      description: "Document a new or changed operational process or policy.",
      defaultValues: JSON.stringify({
        impactLevel: "medium",
        problemStatement: "We have identified an operational problem or inefficiency that a process change can address.",
        alternativesConsidered: "• Change the process - [describe new process]\n• Automate it - [feasibility]\n• Keep current process - [why insufficient]",
        assumptions: "• Team will adopt the new process with appropriate training\n• Process can be reviewed and adjusted after 30 days",
        risks: "• Resistance to change from team members\n• Edge cases not covered by the new process",
      }),
    },
  ];

  for (const template of builtInTemplates) {
    await prisma.decisionTemplate.upsert({
      where: { id: template.id },
      update: { description: template.description, defaultValues: template.defaultValues },
      create: {
        id: template.id,
        workspaceId: null,
        name: template.name,
        category: template.category,
        description: template.description,
        defaultValues: template.defaultValues,
        isBuiltIn: true,
      },
    });
  }

  console.log("✅ Seed complete!");
  console.log("");
  console.log("Demo login:");
  console.log("  Email: admin@acme.demo");
  console.log("  Password: password123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
