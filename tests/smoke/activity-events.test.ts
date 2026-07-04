import { assertEqual } from "./run";
import { activityEventVerb, activityEventLabel } from "../../src/lib/activity-events";

/**
 * Human-readable labels for the activity feed. Pure lookup + fallback logic;
 * cheap to test and easy to regress when new event types are added.
 */
export const activityEventsTests = {
  "known event types map to their verb phrase"() {
    assertEqual(activityEventVerb("status_changed"), "changed the status of");
    assertEqual(activityEventVerb("note_added"), "added a note to");
    assertEqual(activityEventVerb("updated"), "edited");
  },

  "unknown event types fall back to underscores-as-spaces"() {
    assertEqual(activityEventVerb("some_new_event"), "some new event");
    assertEqual(activityEventVerb("reopened"), "reopened");
  },

  "label capitalizes the first letter of the verb"() {
    assertEqual(activityEventLabel("created"), "Created");
    assertEqual(activityEventLabel("status_changed"), "Changed the status of");
    assertEqual(activityEventLabel("some_new_event"), "Some new event");
  },
};
