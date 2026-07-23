import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  const existing = await prisma.workspace.findUnique({ where: { slug: "acme-demo" } });
  if (existing) {
    return NextResponse.json({ message: "Already seeded" });
  }

  const passwordHash = await bcrypt.hash("password123", 12);

  const workspace = await prisma.workspace.create({
    data: { name: "Acme Demo", slug: "acme-demo" },
  });

  const admin = await prisma.user.create({
    data: { name: "Alex Chen", email: "admin@acme.demo", passwordHash },
  });
  const member1 = await prisma.user.create({
    data: { name: "Sarah Kim", email: "sarah@acme.demo", passwordHash },
  });
  const member2 = await prisma.user.create({
    data: { name: "James Park", email: "james@acme.demo", passwordHash },
  });

  await prisma.workspaceMembership.createMany({
    data: [
      { workspaceId: workspace.id, userId: admin.id, role: "admin" },
      { workspaceId: workspace.id, userId: member1.id, role: "member" },
      { workspaceId: workspace.id, userId: member2.id, role: "member" },
    ],
  });

  const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
  const threeMonthsAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const d1 = await prisma.decision.create({
    data: {
      workspaceId: workspace.id, createdByUserId: admin.id, ownerUserId: member1.id,
      title: "Migrate to PostgreSQL for production database",
      summary: "Replacing SQLite with PostgreSQL for production scalability",
      category: "engineering", status: "validated", outcomeStatus: "successful", impactLevel: "high",
      problemStatement: "Our SQLite database causes concurrency issues under load. We need a production-grade solution with concurrent writers, better indexing, and replication.",
      chosenOption: "Migrate to PostgreSQL on AWS RDS with read replicas for dashboard queries.",
      rationale: "PostgreSQL offers the relational model we need, excellent performance, proven reliability at scale, and strong ecosystem support. AWS RDS removes operational overhead.",
      alternativesConsidered: "1. MySQL - similar capabilities but PostgreSQL has better JSON support.\n2. PlanetScale - serverless MySQL but vendor lock-in concerns.\n3. MongoDB - schema flexibility not needed.",
      assumptions: "Our team has sufficient PostgreSQL knowledge. AWS RDS cost fits within budget.",
      risks: "Migration of existing data may have schema differences. Performance regression during migration period.",
      decisionDate: sixMonthsAgo, reviewDate: threeMonthsAgo, reviewedAt: threeMonthsAgo,
    },
  });

  await prisma.decisionReview.create({
    data: {
      decisionId: d1.id, reviewedByUserId: admin.id, outcomeStatus: "successful",
      summary: "Migration completed smoothly. P95 query latency dropped from 450ms to 85ms.",
      lessonsLearned: "Blue-green deployment made the migration zero-downtime. Apply this pattern to future migrations.",
      followUpAction: "Set up automated failover testing and document the runbook.",
    },
  });

  const d2 = await prisma.decision.create({
    data: {
      workspaceId: workspace.id, createdByUserId: admin.id, ownerUserId: admin.id,
      title: "Focus Q2 roadmap on decision review workflow",
      summary: "Prioritizing review and outcome tracking over AI capabilities",
      category: "product", status: "decided", outcomeStatus: "unknown", impactLevel: "high",
      problemStatement: "Two competing Q2 directions: AI-powered drafting vs review and outcome tracking. Must commit to one.",
      chosenOption: "Build the review workflow first - outcome tracking, review reminders, lessons learned, and review history UI.",
      rationale: "The core product promise is decision traceability. Without a review loop, decisions become archives. User interviews confirm teams forget to review.",
      alternativesConsidered: "1. AI drafting first - attractive demo but doesn't drive retention.\n2. Build both - not feasible.\n3. Wait for more data - risk losing early adopters.",
      assumptions: "Review workflow adoption will drive retention.",
      risks: "If teams don't adopt the review workflow, AI features were delayed unnecessarily.",
      decisionDate: oneMonthAgo, reviewDate: nextMonth,
    },
  });

  const d3 = await prisma.decision.create({
    data: {
      workspaceId: workspace.id, createdByUserId: member2.id, ownerUserId: member2.id,
      title: "Hire senior backend engineer with distributed systems experience",
      summary: "Adding backend capacity for the data pipeline and API layer",
      category: "hiring", status: "proposed", outcomeStatus: "unknown", impactLevel: "high",
      problemStatement: "API response times are degrading as data volume grows. We lack distributed systems expertise.",
      chosenOption: "Hire one senior backend engineer (5+ years) with high-throughput data pipeline experience.",
      rationale: "A senior hire gives us expertise we can't grow fast enough internally.",
      alternativesConsidered: "1. Two mid-level engineers.\n2. Contractor.\n3. Optimize existing code.",
      assumptions: "We can attract senior talent at current compensation.",
      risks: "Long hiring cycle. Risk of poor culture fit.",
      decisionDate: new Date(), reviewDate: nextMonth,
    },
  });

  const d4 = await prisma.decision.create({
    data: {
      workspaceId: workspace.id, createdByUserId: admin.id, ownerUserId: member1.id,
      title: "Use Resend for transactional email instead of SendGrid",
      summary: "Switching email provider for better DX and cost",
      category: "business", status: "decided", outcomeStatus: "unknown", impactLevel: "low",
      problemStatement: "SendGrid's API is complex, pricing unpredictable at scale, and DX is outdated.",
      chosenOption: "Switch to Resend - modern API, React email templates, generous free tier.",
      rationale: "Significantly better developer experience, React Email support, transparent pricing.",
      alternativesConsidered: "1. Postmark.\n2. AWS SES.\n3. Mailgun.",
      decisionDate: oneMonthAgo, reviewDate: nextWeek,
    },
  });

  const d5 = await prisma.decision.create({
    data: {
      workspaceId: workspace.id, createdByUserId: member1.id, ownerUserId: member1.id,
      title: "Implement weekly async decision review standup",
      summary: "Replacing monthly in-person reviews with async weekly check-ins",
      category: "operations", status: "under_review", outcomeStatus: "mixed", impactLevel: "medium",
      problemStatement: "Monthly review meetings are too infrequent. Daily meetings too much overhead.",
      chosenOption: "Weekly async standup: owners post 2-sentence updates in Slack by Thursday EOD.",
      rationale: "Async respects deep work time, weekly keeps decisions fresh.",
      alternativesConsidered: "1. Bi-weekly in-person.\n2. Daily async.",
      assumptions: "Team will maintain the async habit.",
      risks: "Easy to skip when busy.",
      decisionDate: threeMonthsAgo, reviewDate: lastWeek,
    },
  });

  const d6 = await prisma.decision.create({
    data: {
      workspaceId: workspace.id, createdByUserId: member2.id,
      title: "Evaluate Vercel vs self-hosted deployment for production",
      summary: "Deciding where to host the production application",
      category: "engineering", status: "draft", outcomeStatus: "unknown", impactLevel: "medium",
      problemStatement: "Approaching production launch - need to decide hosting strategy.",
      chosenOption: "",
      rationale: "",
      alternativesConsidered: "Vercel, AWS ECS, Fly.io, Railway",
      assumptions: "Cost analysis needed before deciding.",
      risks: "Vendor lock-in with Vercel. Operational overhead with self-hosting.",
      decisionDate: new Date(), reviewDate: nextMonth,
    },
  });

  // Notes
  await prisma.decisionNote.createMany({
    data: [
      { decisionId: d1.id, userId: member1.id, content: "Confirmed with DevOps - RDS Multi-AZ available in our region. Adding read replica in us-east-1." },
      { decisionId: d1.id, userId: admin.id, content: "Schema migration script ready and tested in staging. Dry run showed zero data loss." },
      { decisionId: d2.id, userId: member2.id, content: "Spoke with 3 beta users. All confirmed they'd use review reminders. Strong signal." },
      { decisionId: d4.id, userId: member1.id, content: "Resend API key obtained. React Email templates integrated. Test emails sending correctly." },
      { decisionId: d5.id, userId: member1.id, content: "Week 1: 2 out of 3 owners posted updates. Sarah missed - reminded in DM." },
    ],
  });

  // Threaded replies on the RDS note so the demo shows a conversation
  const rdsNote = await prisma.decisionNote.findFirst({
    where: { decisionId: d1.id, userId: member1.id },
  });
  if (rdsNote) {
    await prisma.noteReply.createMany({
      data: [
        { noteId: rdsNote.id, userId: admin.id, content: "Nice - does replica lag stay acceptable during peak traffic?" },
        { noteId: rdsNote.id, userId: member1.id, content: "Yes, load test showed ~200ms p99 lag. Full numbers are in the migration RFC." },
      ],
    });
  }

  // Links
  await prisma.decisionLink.createMany({
    data: [
      { decisionId: d1.id, label: "PostgreSQL Migration RFC", url: "https://example.com/rfc/postgres-migration", linkType: "doc", createdByUserId: admin.id },
      { decisionId: d1.id, label: "DB Performance PR #142", url: "https://example.com/pr/142", linkType: "pull_request", createdByUserId: member1.id },
      { decisionId: d2.id, label: "Q2 Roadmap Planning Doc", url: "https://example.com/docs/q2-roadmap", linkType: "doc", createdByUserId: admin.id },
      { decisionId: d5.id, label: "Standup Process Issue #89", url: "https://example.com/issues/89", linkType: "issue", createdByUserId: member1.id },
    ],
  });

  // Typed relations between decisions - drives the decision graph.
  // d1 Postgres · d2 Q2 review workflow · d3 Hire backend eng
  // d4 Resend · d5 Async review standup · d6 Vercel vs self-hosted
  await prisma.decisionRelation.createMany({
    data: [
      { fromDecisionId: d5.id, toDecisionId: d2.id, relationType: "depends_on", createdByUserId: member1.id },
      { fromDecisionId: d4.id, toDecisionId: d2.id, relationType: "depends_on", createdByUserId: admin.id },
      { fromDecisionId: d3.id, toDecisionId: d1.id, relationType: "depends_on", createdByUserId: member2.id },
      { fromDecisionId: d6.id, toDecisionId: d1.id, relationType: "relates_to", createdByUserId: member2.id },
      { fromDecisionId: d6.id, toDecisionId: d3.id, relationType: "conflicts_with", createdByUserId: admin.id },
    ],
  });

  // Audit events
  for (const [d, userId] of [[d1, admin.id], [d2, admin.id], [d4, admin.id], [d5, member1.id]] as [{ id: string }, string][]) {
    await prisma.decisionEvent.create({
      data: { decisionId: d.id, userId, eventType: "created", newValueJson: JSON.stringify({ action: "created" }) },
    });
  }

  return NextResponse.json({
    success: true,
    message: "Database seeded! Login with admin@acme.demo / password123",
  });
}
