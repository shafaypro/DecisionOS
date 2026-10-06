/**
 * Built-in decision templates - plain data with no imports, so both the app and
 * the standalone seed script can use it.
 *
 * They ship with the code so every deployment has them, not only ones that ran
 * the demo seed: the seed scripts upsert them as rows (so admins see them in
 * Settings → Templates), and `listTemplates` in ./templates merges in any that
 * are missing from the database.
 */
export interface BuiltinTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  /** JSON-encoded subset of the decision form's fields. */
  defaultValues: string;
}

export const BUILTIN_TEMPLATES: readonly BuiltinTemplate[] = [
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
