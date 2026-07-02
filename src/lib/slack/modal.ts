/**
 * Block Kit builders for the DecisionOS "Log a decision" modal.
 * https://api.slack.com/block-kit
 */

export interface PrivateMetadata {
  channelId?: string;
  messageTs?: string;
  messagePermalink?: string;
  triggerEmoji?: string;
  capturedVia: "slack_slash" | "slack_emoji";
}

export interface PrefillValues {
  title?: string;
  rationale?: string;
  chosenOption?: string;
}

export function buildLogDecisionModal(opts: {
  privateMetadata: PrivateMetadata;
  prefill?: PrefillValues;
}): Record<string, unknown> {
  const { privateMetadata, prefill = {} } = opts;

  return {
    type: "modal",
    callback_id: "decisionos_log_decision",
    private_metadata: JSON.stringify(privateMetadata),
    title: { type: "plain_text", text: "Log a decision" },
    submit: { type: "plain_text", text: "Log it" },
    close: { type: "plain_text", text: "Cancel" },
    blocks: [
      {
        type: "input",
        block_id: "title",
        label: { type: "plain_text", text: "What did you decide?" },
        element: {
          type: "plain_text_input",
          action_id: "value",
          placeholder: { type: "plain_text", text: "e.g. Move auth from Auth0 to Clerk" },
          initial_value: prefill.title ?? "",
          max_length: 200,
        },
      },
      {
        type: "input",
        block_id: "rationale",
        label: { type: "plain_text", text: "Why? (the 'because' - future you will thank you)" },
        element: {
          type: "plain_text_input",
          action_id: "value",
          multiline: true,
          placeholder: {
            type: "plain_text",
            text: "What problem does this solve? What were the key trade-offs?",
          },
          initial_value: prefill.rationale ?? "",
          max_length: 2000,
        },
      },
      {
        type: "input",
        block_id: "chosen_option",
        optional: true,
        label: { type: "plain_text", text: "What did you pick (vs. alternatives)?" },
        element: {
          type: "plain_text_input",
          action_id: "value",
          placeholder: { type: "plain_text", text: "Optional - e.g. 'Clerk over Auth0 and building in-house'" },
          initial_value: prefill.chosenOption ?? "",
          max_length: 500,
        },
      },
      {
        type: "input",
        block_id: "status",
        label: { type: "plain_text", text: "Status" },
        element: {
          type: "static_select",
          action_id: "value",
          initial_option: { text: { type: "plain_text", text: "Approved" }, value: "approved" },
          options: [
            { text: { type: "plain_text", text: "Proposed" }, value: "proposed" },
            { text: { type: "plain_text", text: "Approved" }, value: "approved" },
            { text: { type: "plain_text", text: "Superseded" }, value: "superseded" },
            { text: { type: "plain_text", text: "Archived" }, value: "archived" },
          ],
        },
      },
      {
        type: "input",
        block_id: "review_date",
        optional: true,
        label: { type: "plain_text", text: "Review on (optional)" },
        element: {
          type: "datepicker",
          action_id: "value",
          placeholder: { type: "plain_text", text: "Pick a date to revisit this decision" },
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: privateMetadata.messagePermalink
              ? `_Captured from <${privateMetadata.messagePermalink}|this Slack message>._`
              : "_Captured via `/decisionos log`._",
          },
        ],
      },
    ],
  };
}

interface ViewState {
  values: Record<string, Record<string, { value?: string; selected_option?: { value: string }; selected_date?: string }>>;
}

export function extractModalValues(view: { state: ViewState }): {
  title: string;
  rationale: string;
  chosenOption: string | null;
  status: string;
  reviewDate: Date | null;
} {
  const v = view.state.values;
  const title = v.title?.value?.value?.trim() ?? "";
  const rationale = v.rationale?.value?.value?.trim() ?? "";
  const chosenOption = v.chosen_option?.value?.value?.trim() || null;
  const status = v.status?.value?.selected_option?.value ?? "approved";
  const reviewDateStr = v.review_date?.value?.selected_date ?? null;
  const reviewDate = reviewDateStr ? new Date(reviewDateStr + "T12:00:00.000Z") : null;
  return { title, rationale, chosenOption, status, reviewDate };
}
