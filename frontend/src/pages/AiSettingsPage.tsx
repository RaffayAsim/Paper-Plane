import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Bot, CheckCircle2, Save } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type AiProvider = "openai" | "anthropic" | "gemini" | "openai_compatible";

type AiConfig = {
  provider: AiProvider;
  apiKey: string;
  model: string;
  baseUrl?: string;
  temperature?: number;
  isActive: boolean;
  updatedAt?: string;
};

const providerModels: Record<AiProvider, Array<{ value: string; label: string }>> = {
  openai: [
    { value: "gpt-5-mini", label: "GPT-5 Mini" },
    { value: "gpt-4.1-mini", label: "GPT-4.1 Mini" },
    { value: "gpt-4.1", label: "GPT-4.1" },
  ],
  anthropic: [
    { value: "claude-3-5-sonnet-latest", label: "Claude 3.5 Sonnet" },
    { value: "claude-3-7-sonnet-latest", label: "Claude 3.7 Sonnet" },
    { value: "claude-3-5-haiku-latest", label: "Claude 3.5 Haiku" },
  ],
  gemini: [
    { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
    { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro" },
    { value: "gemini-1.5-flash", label: "Gemini 1.5 Flash" },
  ],
  openai_compatible: [
    { value: "gpt-4.1-mini", label: "GPT-4.1 Mini Compatible" },
    { value: "gpt-4.1", label: "GPT-4.1 Compatible" },
    { value: "gpt-5-mini", label: "GPT-5 Mini Compatible" },
  ],
};

const defaultForm: AiConfig = {
  provider: "openai",
  apiKey: "",
  model: providerModels.openai[0].value,
  baseUrl: "",
  temperature: 0.7,
  isActive: true,
};

export default function AiSettingsPage({ isEmbedded }: { isEmbedded?: boolean }) {
  const { toast } = useToast();
  const [form, setForm] = useState<AiConfig>(defaultForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.get<{ item: AiConfig | null }>("/settings/ai-settings");
      setForm(data.item ? { ...defaultForm, ...data.item, baseUrl: data.item.baseUrl || "" } : defaultForm);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load AI settings";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (form.provider === "openai_compatible") {
      return;
    }

    const availableModels = providerModels[form.provider];
    if (!availableModels.some((item) => item.value === form.model)) {
      setForm((prev) => ({ ...prev, model: availableModels[0].value }));
    }
  }, [form.provider, form.model]);

  const save = async () => {
    setSaving(true);
    try {
      const data = await api.put<{ item: AiConfig }>("/settings/ai-settings", form);
      setForm({ ...data.item, baseUrl: data.item.baseUrl || "" });
      toast({ title: "AI settings saved" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save AI settings";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const content = (
    <div className="max-w-3xl space-y-6">
      {!isEmbedded && (
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">AI Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure the provider used for AI email drafting in automation campaigns.
          </p>
        </div>
      )}

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-primary/20 bg-primary/5 p-6"
        >
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Supported providers</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                OpenAI, Claude, Gemini, and OpenAI-compatible APIs are supported. If AI is unavailable, automation falls back to the existing webhook or internal template.
              </p>
            </div>
          </div>
        </motion.div>

        <div className="glass-card rounded-2xl p-6 space-y-5">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading AI settings...</p>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Provider</Label>
                  <Select value={form.provider} onValueChange={(value) => setForm((prev) => ({ ...prev, provider: value as AiProvider }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="openai">OpenAI</SelectItem>
                      <SelectItem value="anthropic">Claude / Anthropic</SelectItem>
                      <SelectItem value="gemini">Gemini</SelectItem>
                      <SelectItem value="openai_compatible">OpenAI Compatible</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Model</Label>
                  {form.provider === "openai_compatible" ? (
                    <Input
                      value={form.model}
                      onChange={(e) => setForm((prev) => ({ ...prev, model: e.target.value }))}
                      placeholder="Enter the exact model name exposed by your compatible API"
                    />
                  ) : (
                    <Select value={form.model} onValueChange={(value) => setForm((prev) => ({ ...prev, model: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a model" />
                      </SelectTrigger>
                      <SelectContent>
                        {providerModels[form.provider].map((model) => (
                          <SelectItem key={model.value} value={model.value}>
                            {model.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>API Key</Label>
                <Input type="password" value={form.apiKey} onChange={(e) => setForm((prev) => ({ ...prev, apiKey: e.target.value }))} placeholder="Paste provider API key" />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Base URL</Label>
                  <Input value={form.baseUrl || ""} onChange={(e) => setForm((prev) => ({ ...prev, baseUrl: e.target.value }))} placeholder="Optional for OpenAI-compatible or custom gateway" />
                </div>
                <div className="space-y-2">
                  <Label>Temperature</Label>
                  <Input type="number" min="0" max="2" step="0.1" value={form.temperature ?? 0.7} onChange={(e) => setForm((prev) => ({ ...prev, temperature: Number(e.target.value) }))} />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
                <div>
                  <p className="text-sm font-medium">Active</p>
                  <p className="text-xs text-muted-foreground">Use this provider for AI email drafting</p>
                </div>
                <Switch checked={form.isActive} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, isActive: checked }))} />
              </div>

              {form.updatedAt ? (
                <p className="text-xs text-muted-foreground">
                  Last updated {new Date(form.updatedAt).toLocaleString()}
                </p>
              ) : null}

              <Button onClick={() => void save()} disabled={saving} className="w-full">
                {saving ? (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Save AI Settings
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </div>
  );

  if (isEmbedded) return content;
  return <DashboardLayout>{content}</DashboardLayout>;
}
