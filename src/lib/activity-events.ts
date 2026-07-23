/**
 * Shared, human-readable labels for the DecisionEvent audit trail. Used by the
 * /activity feed page (server) and its filter bar (client), so it carries no
 * server-only imports.
 */
export const ACTIVITY_EVENT_TYPES = [
  "created",
  "updated",
  "status_changed",
  "reviewed",
  "note_added",
  "note_replied",
  "link_added",
  "archived",
  "superseded",
] as const;

export type ActivityEventType = (typeof ACTIVITY_EVENT_TYPES)[number];

const LABELS: Record<string, string> = {
  created: "created",
  updated: "edited",
  status_changed: "changed the status of",
  reviewed: "reviewed",
  note_added: "added a note to",
  note_replied: "replied to a note on",
  link_added: "linked a resource to",
  archived: "archived",
  superseded: "superseded",
};

/** A verb phrase for a feed line: "<name> <verb> <decision>". */
export function activityEventVerb(eventType: string): string {
  return LABELS[eventType] ?? eventType.replace(/_/g, " ");
}

/** A short label for the filter dropdown. */
export function activityEventLabel(eventType: string): string {
  const v = activityEventVerb(eventType);
  return v.charAt(0).toUpperCase() + v.slice(1);
}
