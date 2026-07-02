"use client";

import { useState, useTransition, type ComponentType } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import {
  AlertCircle, Check, Trash2,
  Sparkles, MessageSquare, Users, Hash, Webhook,
  type LucideProps,
} from "lucide-react";

interface Integration {
  id: string;
  type: string;
  isActive: boolean;
  config: Record<string, unknown>;
}

interface IntegrationsFormProps {
  initialIntegrations: Integration[];
}

type SaveFn = (type: string, config: Record<string, string>, isActive: boolean) => void;

/* ─── Panel (replaces the old Card primitive) ─── */

function Panel({ active, className, children }: { active?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-xs border border-slate-200 bg-white shadow-soft transition-all duration-200",
        active && "border-blue-200",
        className,
      )}
    >
      {children}
    </div>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "text-xs rounded-full px-2 py-0.5 font-medium",
        active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500",
      )}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

/* ─── Webhook channels (Slack / Teams / Discord / generic) ─── */

interface ChannelDef {
  id: string;
  label: string;
  color: string;
  icon: ComponentType<LucideProps>;
  placeholder: string;
  help: React.ReactNode;
}

const CHANNELS: ChannelDef[] = [
  {
    id: "slack",
    label: "Slack",
    color: "#4A154B",
    icon: MessageSquare,
    placeholder: "https://hooks.slack.com/services/T.../B.../...",
    help: (
      <>In your Slack workspace go to <Text as="strong">Apps → Incoming Webhooks</Text> and copy the URL.</>
    ),
  },
  {
    id: "teams",
    label: "Microsoft Teams",
    color: "#4B53BC",
    icon: Users,
    placeholder: "https://prod-00.westus.logic.azure.com:443/workflows/...",
    help: (
      <>
        In Teams, add a <Text as="strong">Workflows</Text> flow for &ldquo;Post to a channel when a webhook
        request is received&rdquo;, then copy its URL. (Posts as an Adaptive Card.)
      </>
    ),
  },
  {
    id: "discord",
    label: "Discord",
    color: "#5865F2",
    icon: Hash,
    placeholder: "https://discord.com/api/webhooks/.../...",
    help: (
      <>
        In Discord: <Text as="strong">Channel → Edit → Integrations → Webhooks → New Webhook</Text>, then
        Copy Webhook URL.
      </>
    ),
  },
  {
    id: "webhook",
    label: "Webhook",
    color: "#475569",
    icon: Webhook,
    placeholder: "https://your-service.example.com/hooks/decisionos",
    help: (
      <>
        Any HTTPS endpoint. We <Text as="code">POST</Text>{" "}
        <Text as="code">{`{ "text": "…" }`}</Text> on each
        notification. Works with Zapier, Make, n8n, or a custom receiver.
      </>
    ),
  },
];

function WebhookForm({
  channel,
  existing,
  onSave,
  pending,
}: {
  channel: ChannelDef;
  existing?: Integration;
  onSave: SaveFn;
  pending: boolean;
}) {
  const [webhookUrl, setWebhookUrl] = useState((existing?.config.webhookUrl as string) ?? "");
  const [isActive, setIsActive] = useState(existing?.isActive ?? true);
  return (
    <div className="space-y-4">
      <Input
        label="Incoming Webhook URL"
        value={webhookUrl}
        onChange={(e) => setWebhookUrl(e.target.value)}
        placeholder={channel.placeholder}
        type="url"
        hint={<>{channel.help} Used to send overdue review reminders to your team.</>}
      />
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          className="rounded-xs"
        />
        <Text as="span">Active: send review reminders to this channel</Text>
      </label>
      <Button
        size="sm"
        disabled={pending || !webhookUrl.trim()}
        onClick={() => onSave(channel.id, { webhookUrl }, isActive)}
      >
        Save {channel.label}
      </Button>
    </div>
  );
}

/* ─── AI / Anthropic form ─── */

const ANTHROPIC_MODELS = [
  { value: "claude-haiku-4-5",  label: "Claude Haiku 4.5: fastest, lowest cost" },
  { value: "claude-sonnet-4-5", label: "Claude Sonnet 4.5: balanced" },
  { value: "claude-opus-4-5",   label: "Claude Opus 4.5: most capable" },
] as const;

const CUSTOM_MODEL = "__custom__";
const PRESET_MODELS = ANTHROPIC_MODELS.map((m) => m.value) as readonly string[];

function AnthropicForm({
  existing,
  onSave,
  pending,
}: {
  existing?: Integration;
  onSave: SaveFn;
  pending: boolean;
}) {
  const cfg = existing?.config as Record<string, string> | undefined;
  const savedModel = cfg?.model ?? "claude-haiku-4-5";
  const savedIsPreset = PRESET_MODELS.includes(savedModel);

  const [apiKey, setApiKey] = useState(cfg?.apiKey === "••••••••" ? "" : (cfg?.apiKey ?? ""));
  const [modelChoice, setModelChoice] = useState(savedIsPreset ? savedModel : CUSTOM_MODEL);
  const [customModel, setCustomModel] = useState(savedIsPreset ? "" : savedModel);
  const [baseUrl, setBaseUrl] = useState(cfg?.baseUrl ?? "");
  const [isActive, setIsActive] = useState(existing?.isActive ?? true);
  const hasExisting = !!existing;

  const isCustomModel = modelChoice === CUSTOM_MODEL;
  const effectiveModel = (isCustomModel ? customModel : modelChoice).trim();
  const usingCustomEndpoint = baseUrl.trim().length > 0;
  // A base URL alone is enough (local gateways need no key); otherwise a key is
  // required the first time. Editing an existing config can leave the key blank.
  const needsKey = !usingCustomEndpoint && !hasExisting;
  const canSave =
    !pending && effectiveModel.length > 0 && (!needsKey || apiKey.trim().length > 0);

  return (
    <div className="space-y-4">
      <Input
        label={
          <>
            API Key{" "}
            {usingCustomEndpoint && (
              <Text as="span" color="subtle" weight="normal">(optional for self-hosted)</Text>
            )}
          </>
        }
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        type="password"
        placeholder={
          hasExisting
            ? "Leave blank to keep existing key"
            : usingCustomEndpoint
              ? "Leave blank if your endpoint needs no key"
              : "sk-ant-api03-..."
        }
        className="font-mono"
        hint={
          <>
            For Anthropic, get a key at{" "}
            <Text
              as="a"
              href="https://console.anthropic.com/settings/keys"
              target="_blank"
              rel="noopener noreferrer"
              color="brand"
            >
              console.anthropic.com
            </Text>
            . The key is encrypted with AES-256-GCM before storage and never exposed in the UI.
          </>
        }
      />

      <div>
        <NativeSelect
          label="Model"
          value={modelChoice}
          onChange={(e) => setModelChoice(e.target.value)}
        >
          {ANTHROPIC_MODELS.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
          <option value={CUSTOM_MODEL}>Custom model (self-hosted / other provider)…</option>
        </NativeSelect>
        {isCustomModel && (
          <Input
            value={customModel}
            onChange={(e) => setCustomModel(e.target.value)}
            placeholder="e.g. claude-3-5-sonnet-local, llama-3.1-70b, my-model"
            className="font-mono mt-2"
          />
        )}
      </div>

      <Input
        label={<>API Base URL <Text as="span" color="subtle" weight="normal">(optional)</Text></>}
        value={baseUrl}
        onChange={(e) => setBaseUrl(e.target.value)}
        type="url"
        placeholder="https://api.anthropic.com (default)"
        className="font-mono"
        hint={
          <>
            Point at a self-hosted or Anthropic-compatible endpoint, e.g. a local gateway, an
            OpenAI-compatible proxy (LiteLLM, vLLM), or another provider. Leave blank to use
            Anthropic&apos;s API.
          </>
        }
      />

      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          className="rounded-xs"
        />
        <Text as="span">
          Enable AI features (decision drafting + Ask DecisionOS) for this workspace
        </Text>
      </label>

      <Button
        size="sm"
        disabled={!canSave}
        onClick={() => onSave("anthropic", { apiKey, model: effectiveModel, baseUrl }, isActive)}
        icon={<Sparkles className="h-3.5 w-3.5" />}
      >
        Save AI Settings
      </Button>
    </div>
  );
}

/* ─── Tab layout ─── */

type Tab = string;

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  ...CHANNELS.map((c) => ({ id: c.id, label: c.label, icon: <c.icon className="h-4 w-4" /> })),
  { id: "ai", label: "AI Models", icon: <Sparkles className="h-4 w-4" /> },
];

/* ─── Main component ─── */

export function IntegrationsForm({ initialIntegrations }: IntegrationsFormProps) {
  const [integrations, setIntegrations] = useState(initialIntegrations);
  const [activeTab, setActiveTab] = useState<Tab>("slack");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>();
  const [success, setSuccess] = useState<string | undefined>();

  function get(type: string) {
    return integrations.find((i) => i.type === type);
  }

  function save(type: string, config: Record<string, string>, isActive: boolean) {
    setError(undefined);
    setSuccess(undefined);
    startTransition(async () => {
      const res = await fetch("/api/integrations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, config, isActive }),
      });
      const json = await res.json();
      if (json.error) { setError(json.error); return; }
      const listRes = await fetch("/api/integrations");
      const listData = await listRes.json();
      setIntegrations(listData.integrations ?? []);
      const label = TABS.find((t) => t.id === type)?.label ?? type;
      setSuccess(`${label} settings saved.`);
    });
  }

  async function remove(type: string) {
    const label = TABS.find((t) => t.id === type)?.label ?? type;
    if (!confirm(`Remove ${label} integration?`)) return;
    setError(undefined);
    const res = await fetch("/api/integrations", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type }),
    });
    const json = await res.json();
    if (json.error) { setError(json.error); return; }
    setIntegrations((prev) => prev.filter((i) => i.type !== type));
    setSuccess(`${label} integration removed.`);
  }

  const activeChannel = CHANNELS.find((c) => c.id === activeTab);
  const anthropicIntegration = get("anthropic");

  return (
    <div className="flex gap-8">
      {/* Sidebar tabs */}
      <div className="w-44 flex-shrink-0">
        <nav className="space-y-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setSuccess(undefined); setError(undefined); }}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 rounded-xs transition-colors",
                activeTab === tab.id
                  ? "bg-blue-50 text-blue-700 border border-blue-200"
                  : "text-slate-600 hover:bg-slate-100",
              )}
            >
              {tab.icon}
              <Text as="span">{tab.label}</Text>
            </button>
          ))}
        </nav>
      </div>

      {/* Content panel */}
      <div className="flex-1 min-w-0 space-y-6">
        {/* Global status banners */}
        {error && (
          <div className="flex items-center gap-2 rounded-xs bg-red-50 border border-red-200 px-4 py-3">
            <AlertCircle className="h-4 w-4 flex-shrink-0 text-red-700" />
            <Text color="danger">{error}</Text>
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 rounded-xs bg-green-50 border border-green-200 px-4 py-3">
            <Check className="h-4 w-4 flex-shrink-0 text-green-700" />
            <Text color="success">{success}</Text>
          </div>
        )}

        {/* ── WEBHOOK CHANNEL TABS (Slack / Teams / Discord / Webhook) ── */}
        {activeChannel && (() => {
          const integration = get(activeChannel.id);
          const Icon = activeChannel.icon;
          return (
            <>
              <div className="mb-2">
                <Text as="h2">{activeChannel.label} Integration</Text>
                <Text as="p">
                  Connect DecisionOS to {activeChannel.label}. Configure an incoming webhook to receive
                  overdue review reminders in your channel.
                </Text>
              </div>

              <Panel active={integration?.isActive}>
                <div className="flex flex-col space-y-1.5 p-6 pb-3">
                  <div className="flex items-center justify-between">
                    <Text as="h3" className="flex items-center gap-2">
                      <Icon className="h-5 w-5" style={{ color: activeChannel.color }} />
                      {activeChannel.label} Webhook
                      {integration && <StatusBadge active={integration.isActive} />}
                    </Text>
                    {integration && (
                      <button
                        onClick={() => remove(activeChannel.id)}
                        className="text-slate-400 hover:text-red-500 p-1.5 rounded-xs hover:bg-red-50 transition-colors"
                        title={`Remove ${activeChannel.label} integration`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <Text as="p">
                    Sends overdue review reminders to {activeChannel.label} via an incoming webhook.
                  </Text>
                </div>
                <div className="p-6 pt-0">
                  <WebhookForm channel={activeChannel} existing={integration} onSave={save} pending={pending} />
                </div>
              </Panel>
            </>
          );
        })()}

        {/* ── AI TAB ── */}
        {activeTab === "ai" && (
          <>
            <div className="mb-2">
              <Text as="h2">AI Models (Claude &amp; compatible)</Text>
              <Text as="p">
                Powers AI-assisted decision drafting and <Text as="strong">Ask DecisionOS</Text>. Use
                Anthropic&apos;s API, or bring your own model: pick a preset, enter a custom model id,
                and optionally point at a self-hosted or compatible endpoint. Turn it on or off per
                workspace.
              </Text>
            </div>

            <Panel active={anthropicIntegration?.isActive}>
              <div className="flex flex-col space-y-1.5 p-6 pb-3">
                <div className="flex items-center justify-between">
                  <Text as="h3" className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-blue-600" />
                    Anthropic (Claude)
                    {anthropicIntegration && <StatusBadge active={anthropicIntegration.isActive} />}
                  </Text>
                  {anthropicIntegration && (
                    <button
                      onClick={() => remove("anthropic")}
                      className="text-slate-400 hover:text-red-500 p-1.5 rounded-xs hover:bg-red-50 transition-colors"
                      title="Remove AI integration"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <Text as="p">
                  Your API key is encrypted with AES-256-GCM before storage and never exposed in the UI.
                </Text>
              </div>
              <div className="p-6 pt-0">
                <AnthropicForm existing={anthropicIntegration} onSave={save} pending={pending} />
              </div>
            </Panel>

            {!anthropicIntegration && (
              <Panel className="border-dashed border-slate-300 bg-slate-50">
                <div className="p-4 flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-slate-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <Text weight="medium" color="secondary">AI is not yet configured</Text>
                    <Text as="p">
                      Add an API key (or a custom endpoint) above. Alternatively, set the{" "}
                      <Text as="code">ANTHROPIC_API_KEY</Text>{" "}
                      (and optional <Text as="code">ANTHROPIC_BASE_URL</Text>){" "}
                      environment variables on your server, and the app will fall back to them automatically.
                    </Text>
                  </div>
                </div>
              </Panel>
            )}
          </>
        )}
      </div>
    </div>
  );
}
