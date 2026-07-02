import { PrismaClient } from "../src/generated/prisma/client.js";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  const passwordHash = await bcrypt.hash("password123", 12);

  const workspace = await prisma.workspace.upsert({
    where: { slug: "acme-demo" },
    update: {},
    create: { name: "Acme Demo", slug: "acme-demo" },
  });

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

  for (const [user, role] of [[admin, "admin"], [member1, "member"], [member2, "member"]] as [{ id: string }, string][]) {
    await prisma.workspaceMembership.upsert({
      where: { workspaceId_userId: { workspaceId: workspace.id, userId: user.id } },
      update: {},
      create: { workspaceId: workspace.id, userId: user.id, role },
    });
  }

  const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
  const threeMonthsAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  async function mkDecision(data: Parameters<typeof prisma.decision.create>[0]["data"]) {
    const d = await prisma.decision.create({ data: { workspaceId: workspace.id, ...data } });
    await prisma.decisionEvent.create({
      data: { decisionId: d.id, userId: data.createdByUserId as string, eventType: "created", newValueJson: JSON.stringify({ title: d.title }) },
    });
    return d;
  }

  const d1 = await mkDecision({
    title: "Migrate to PostgreSQL for production database",
    summary: "Replacing SQLite with PostgreSQL for production scalability",
    category: "engineering", status: "validated", outcomeStatus: "successful", impactLevel: "high",
    problemStatement: "Our SQLite database causes concurrency issues under load. We need a production-grade solution with concurrent writers, better indexing, and replication.",
    chosenOption: "Migrate to PostgreSQL on AWS RDS with read replicas for dashboard queries.",
    rationale: "PostgreSQL offers the relational model we need, excellent performance, proven reliability at scale, and strong ecosystem support. AWS RDS removes operational overhead.",
    alternativesConsidered: "1. MySQL - similar capabilities but PostgreSQL has better JSON support.\n2. PlanetScale - serverless MySQL but vendor lock-in concerns.\n3. MongoDB - schema flexibility not needed for our structured model.",
    assumptions: "Our team has sufficient PostgreSQL knowledge. AWS RDS cost fits within budget.",
    risks: "Migration of existing data may have schema differences. Performance regression during migration period.",
    createdByUserId: admin.id, ownerUserId: member1.id,
    decisionDate: sixMonthsAgo, reviewDate: threeMonthsAgo, reviewedAt: threeMonthsAgo,
  });

  await prisma.decisionReview.create({
    data: {
      decisionId: d1.id, reviewedByUserId: admin.id, outcomeStatus: "successful",
      summary: "Migration completed smoothly. P95 query latency dropped from 450ms to 85ms.",
      lessonsLearned: "Blue-green deployment made the migration zero-downtime. Apply this pattern to future migrations.",
      followUpAction: "Set up automated failover testing and document the runbook.",
    },
  });

  await prisma.decisionEvent.create({
    data: { decisionId: d1.id, userId: admin.id, eventType: "reviewed", newValueJson: JSON.stringify({ outcome: "successful" }) },
  });

  const d2 = await mkDecision({
    title: "Focus Q2 roadmap on decision review workflow",
    summary: "Prioritizing review and outcome tracking over AI capabilities",
    category: "product", status: "decided", outcomeStatus: "unknown", impactLevel: "high",
    problemStatement: "Two competing directions for Q2: (1) AI-powered decision drafting, or (2) review and outcome tracking. Must commit to one given resource constraints.",
    chosenOption: "Build the review workflow first - outcome tracking, review reminders, lessons learned, and review history UI.",
    rationale: "The core product promise is decision traceability. Without a review loop, decisions become archives. User interviews confirm teams forget to review because there's no structured prompt.",
    alternativesConsidered: "1. AI drafting first - attractive demo but doesn't drive retention.\n2. Build both - not feasible with current team.\n3. Wait for more data - risk losing early adopters.",
    assumptions: "Review workflow adoption will drive retention. Teams want to systematize their review cadences.",
    risks: "If teams don't adopt the review workflow, AI features were delayed unnecessarily.",
    createdByUserId: admin.id, ownerUserId: admin.id,
    decisionDate: oneMonthAgo, reviewDate: nextMonth,
  });

  const d3 = await mkDecision({
    title: "Hire senior backend engineer with distributed systems experience",
    summary: "Adding backend capacity for the data pipeline and API layer",
    category: "hiring", status: "proposed", outcomeStatus: "unknown", impactLevel: "high",
    problemStatement: "API response times are degrading as data volume grows. The founding team lacks distributed systems experience. We need to scale the data layer before launch.",
    chosenOption: "Hire one senior backend engineer (5+ years) with high-throughput data pipeline experience.",
    rationale: "A senior hire over mid-level gives us expertise we can't grow fast enough internally. Distributed systems experience is the specific gap.",
    alternativesConsidered: "1. Two mid-level engineers - more output but neither has the systems depth needed.\n2. Contractor - faster but no knowledge retention.\n3. Optimize existing code - buys 2-3 months but doesn't solve capacity.",
    assumptions: "We can attract senior talent at current compensation. Onboarding takes 4-6 weeks.",
    risks: "Long hiring cycle. Risk of poor culture fit at this early stage.",
    createdByUserId: member2.id, ownerUserId: member2.id,
    decisionDate: new Date(), reviewDate: nextMonth,
  });

  const d4 = await mkDecision({
    title: "Use Resend for transactional email instead of SendGrid",
    summary: "Switching email provider for better DX and cost",
    category: "business", status: "decided", outcomeStatus: "unknown", impactLevel: "low",
    problemStatement: "SendGrid's API is complex, pricing unpredictable at scale, and developer experience is outdated. We need transactional email for review reminders and notifications.",
    chosenOption: "Switch to Resend - modern API, React email templates, generous free tier, predictable pricing.",
    rationale: "Resend has significantly better developer experience, supports React Email templates, and has transparent pricing. The free tier covers our current volume.",
    alternativesConsidered: "1. Postmark - good deliverability but higher cost.\n2. AWS SES - cheap but requires operational setup.\n3. Mailgun - pricing concerns after recent changes.",
    createdByUserId: admin.id, ownerUserId: member1.id,
    decisionDate: oneMonthAgo, reviewDate: nextWeek,
  });

  const d5 = await mkDecision({
    title: "Implement weekly async decision review standup",
    summary: "Replacing monthly in-person reviews with async weekly check-ins",
    category: "operations", status: "under_review", outcomeStatus: "mixed", impactLevel: "medium",
    problemStatement: "Monthly review meetings are too infrequent - decisions go stale and team loses context. But daily meetings are too much overhead.",
    chosenOption: "Weekly async standup: each decision owner posts a 2-sentence update in Slack by Thursday EOD. Meeting only for escalations.",
    rationale: "Async respects deep work time, weekly cadence keeps decisions fresh, and written updates create a lightweight audit trail.",
    alternativesConsidered: "1. Bi-weekly in-person - more structured but hard to schedule.\n2. Daily async - too much overhead for non-critical decisions.",
    assumptions: "Team will maintain the async habit without external pressure.",
    risks: "Easy to skip when busy. May miss cross-decision dependencies.",
    createdByUserId: member1.id, ownerUserId: member1.id,
    decisionDate: threeMonthsAgo, reviewDate: lastWeek,
  });

  const d6 = await mkDecision({
    title: "Evaluate Vercel vs self-hosted deployment for production",
    summary: "Deciding where to host the production application",
    category: "engineering", status: "draft", outcomeStatus: "unknown", impactLevel: "medium",
    problemStatement: "As we approach production launch, we need to decide our hosting strategy. Vercel is faster to set up but self-hosting gives more control and cost predictability at scale.",
    chosenOption: "",
    rationale: "",
    alternativesConsidered: "Vercel, AWS ECS, Fly.io, Railway",
    assumptions: "Cost analysis needed before deciding.",
    risks: "Vendor lock-in with Vercel. Operational overhead with self-hosting.",
    createdByUserId: member2.id,
    decisionDate: new Date(), reviewDate: nextMonth,
  });

  // Decision graph - typed relations so /graph has structure out of the box.
  const seedRelations: { from: string; to: string; type: string }[] = [
    { from: d6.id, to: d1.id, type: "depends_on" },     // hosting choice depends on the database decision
    { from: d2.id, to: d3.id, type: "depends_on" },     // Q2 roadmap depends on the backend hire
    { from: d5.id, to: d2.id, type: "relates_to" },     // review standup supports the Q2 focus
    { from: d4.id, to: d6.id, type: "relates_to" },     // email provider ties into deployment platform
    { from: d3.id, to: d6.id, type: "conflicts_with" }, // hiring spend vs self-hosting ambitions
  ];
  for (const rel of seedRelations) {
    await prisma.decisionRelation.upsert({
      where: {
        fromDecisionId_toDecisionId_relationType: {
          fromDecisionId: rel.from,
          toDecisionId: rel.to,
          relationType: rel.type,
        },
      },
      update: {},
      create: {
        fromDecisionId: rel.from,
        toDecisionId: rel.to,
        relationType: rel.type,
        createdByUserId: admin.id,
      },
    });
  }

  await prisma.decisionNote.createMany({
    data: [
      { decisionId: d1.id, userId: member1.id, content: "Confirmed with DevOps - RDS Multi-AZ is available in our region. Adding read replica in us-east-1." },
      { decisionId: d1.id, userId: admin.id, content: "Schema migration script ready and tested in staging. Dry run showed zero data loss." },
      { decisionId: d2.id, userId: member2.id, content: "Spoke with 3 beta users. All confirmed they'd use review reminders. Strong signal." },
      { decisionId: d4.id, userId: member1.id, content: "Resend API key obtained. React Email templates integrated. Test emails sending correctly." },
      { decisionId: d5.id, userId: member1.id, content: "Week 1: 2 out of 3 owners posted updates. Sarah missed - reminded in DM." },
    ],
  });

  await prisma.decisionLink.createMany({
    data: [
      { decisionId: d1.id, label: "PostgreSQL Migration RFC", url: "https://example.com/rfc/postgres-migration", linkType: "doc", createdByUserId: admin.id },
      { decisionId: d1.id, label: "DB Performance PR #142", url: "https://example.com/pr/142", linkType: "pull_request", createdByUserId: member1.id },
      { decisionId: d2.id, label: "Q2 Roadmap Planning Doc", url: "https://example.com/docs/q2-roadmap", linkType: "doc", createdByUserId: admin.id },
      { decisionId: d5.id, label: "Standup Process Issue #89", url: "https://example.com/issues/89", linkType: "issue", createdByUserId: member1.id },
    ],
  });

  // Seed built-in templates
  const builtInTemplates = [
    {
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
      where: { id: `builtin-${template.category}-${template.name.toLowerCase().replace(/\s+/g, "-")}` },
      update: { description: template.description, defaultValues: template.defaultValues },
      create: {
        id: `builtin-${template.category}-${template.name.toLowerCase().replace(/\s+/g, "-")}`,
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
  console.log("Demo credentials:");
  console.log("  Email: admin@acme.demo");
  console.log("  Password: password123");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
