import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AlertTriangle, CheckCircle2, ChevronDown, Clock3, Mail, RefreshCw, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { useNavigate } from "react-router-dom";

const sourceLabels: Record<string, string> = {
  google_maps: "Google Maps",
  yelp: "Yelp Leads",
  yellow_pages: "Yellow Pages",
  custom: "Imported Leads",
};

type CampaignRecord = {
  id: string;
  source: string;
  status: string;
  leadCount: number;
  errorMessage?: string | null;
  createdAt: string;
  externalResponse?: {
    totalSelected?: number;
    processedCount?: number;
    sentCount?: number;
    failedCount?: number;
    pitch?: string;
    queuedAt?: string;
    startedAt?: string;
    completedAt?: string;
    lastProcessedAt?: string;
    failures?: Array<{
      leadId: string;
      email: string;
      error: string;
    }>;
  } | null;
};

function getStatusTone(status: string) {
  if (status === "completed") return "secondary" as const;
  if (status === "failed") return "destructive" as const;
  return "outline" as const;
}

function getStatusSummary(campaign: CampaignRecord) {
  if (campaign.status === "failed") {
    return campaign.errorMessage || "This campaign stopped before any emails were sent.";
  }

  if (campaign.status === "completed") {
    const sent = campaign.externalResponse?.sentCount ?? 0;
    const failed = campaign.externalResponse?.failedCount ?? 0;
    return failed > 0
      ? `Completed with ${sent} sent and ${failed} failed.`
      : `Completed successfully with ${sent} emails sent.`;
  }

  if (campaign.status === "processing") {
    const processed = campaign.externalResponse?.processedCount ?? 0;
    const total = campaign.externalResponse?.totalSelected ?? campaign.leadCount;
    return `Currently processing ${processed} of ${total} selected leads.`;
  }

  return "Queued and waiting for automation to begin.";
}

export default function MessageCampaignsPage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [items, setItems] = useState<CampaignRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.get<{ items: CampaignRecord[] }>("/leads/message-campaigns");
      setItems(data.items ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load campaigns";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const hasActiveCampaign = items.some((item) => item.status === "pending" || item.status === "processing");
    if (!hasActiveCampaign) return;

    const interval = setInterval(() => {
      void load();
    }, 10000);

    return () => clearInterval(interval);
  }, [items]);

  const handleCancelCampaign = async (campaignId: string) => {
    setCancellingId(campaignId);
    try {
      await api.patch(`/leads/message-campaigns/${campaignId}/cancel`, {});
      toast({ title: "Campaign cancelled", description: "The campaign has been stopped." });
      void load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to cancel campaign";
      toast({ title: "Cancel failed", description: message, variant: "destructive" });
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-5xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Campaign History</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Track all your email campaigns and their delivery progress.
            </p>
          </div>
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        <div className="space-y-4">
          {loading && items.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card p-8 text-center space-y-2">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Loading campaigns...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card p-8 text-center space-y-4">
              <Mail className="h-10 w-10 mx-auto text-muted-foreground/40" />
              <div>
                <p className="text-sm font-medium text-foreground">No campaigns yet</p>
                <p className="text-xs text-muted-foreground mt-1">Go to Contacts, select leads, and click "Send Campaign" to get started.</p>
              </div>
              <Button size="sm" onClick={() => navigate("/leads")} className="mx-auto">
                Go to Contacts
              </Button>
            </div>
          ) : (
            items.map((campaign) => (
              <div key={campaign.id} className="rounded-2xl border border-border bg-card p-5 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                      <Mail className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h2 className="font-semibold text-foreground">
                        {sourceLabels[campaign.source] ?? campaign.source}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        Created {new Date(campaign.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {(campaign.status === "pending" || campaign.status === "processing") && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void handleCancelCampaign(campaign.id)}
                        disabled={cancellingId === campaign.id}
                        className="gap-1.5 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/5 text-xs h-8"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        {cancellingId === campaign.id ? "Cancelling..." : "Cancel"}
                      </Button>
                    )}
                    <Badge variant={getStatusTone(campaign.status)}>
                      {campaign.status}
                    </Badge>
                  </div>
                </div>

                <div
                  className={`rounded-xl border p-4 ${
                    campaign.status === "failed"
                      ? "border-destructive/30 bg-destructive/5"
                      : campaign.status === "completed"
                        ? "border-primary/20 bg-primary/5"
                        : "border-border bg-background"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg ${
                        campaign.status === "failed"
                          ? "bg-destructive/10 text-destructive"
                          : campaign.status === "completed"
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {campaign.status === "failed" ? (
                        <AlertTriangle className="h-4 w-4" />
                      ) : campaign.status === "completed" ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <Clock3 className="h-4 w-4" />
                      )}
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">
                        {campaign.status === "failed"
                          ? "Campaign failed"
                          : campaign.status === "completed"
                            ? "Campaign finished"
                            : campaign.status === "processing"
                              ? "Campaign in progress"
                              : "Campaign queued"}
                      </p>
                      <p className="text-sm text-muted-foreground">{getStatusSummary(campaign)}</p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-4">
                  <div className="rounded-xl border border-border p-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Contacts</p>
                    <p className="mt-1 text-lg font-semibold text-foreground">
                      {campaign.externalResponse?.totalSelected ?? campaign.leadCount}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border p-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Attempted</p>
                    <p className="mt-1 text-lg font-semibold text-foreground">
                      {campaign.externalResponse?.processedCount ?? 0}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border p-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Sent</p>
                    <p className="mt-1 text-lg font-semibold text-foreground">
                      {campaign.externalResponse?.sentCount ?? 0}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border p-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Failed</p>
                    <p className="mt-1 text-lg font-semibold text-foreground">
                      {campaign.externalResponse?.failedCount ?? 0}
                    </p>
                  </div>
                </div>

                {/* Progress bar for in-progress campaigns */}
                {campaign.status === "processing" && (() => {
                  const total = campaign.externalResponse?.totalSelected ?? campaign.leadCount;
                  const done = campaign.externalResponse?.processedCount ?? 0;
                  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                  return (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Sending in progress...</span>
                        <span>{pct}% ({done} of {total})</span>
                      </div>
                      <div className="relative h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="absolute inset-y-0 left-0 rounded-full bg-primary transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })()}

                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="group w-full justify-between rounded-xl border border-border px-4">
                      <span>Show Details</span>
                      <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-4 pt-4">
                    {campaign.externalResponse?.pitch ? (
                      <div className="rounded-xl border border-border bg-background p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Campaign Brief</p>
                        <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
                          {campaign.externalResponse.pitch}
                        </p>
                      </div>
                    ) : null}

                    {(campaign.errorMessage || campaign.externalResponse?.failures?.length) ? (
                      <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 space-y-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Failure Details</p>
                        {campaign.errorMessage ? (
                          <div>
                            <p className="text-sm font-medium text-foreground">Primary Error</p>
                            <p className="mt-1 text-sm text-muted-foreground">{campaign.errorMessage}</p>
                          </div>
                        ) : null}

                        {campaign.externalResponse?.failures?.length ? (
                          <div className="space-y-2">
                            <p className="text-sm font-medium text-foreground">Recent Failed Recipients</p>
                            <div className="space-y-2">
                              {campaign.externalResponse.failures.slice(0, 5).map((failure) => (
                                <div key={`${failure.leadId}-${failure.email}`} className="rounded-lg border border-border bg-background p-3">
                                  <p className="text-sm font-medium text-foreground">{failure.email}</p>
                                  <p className="mt-1 text-sm text-muted-foreground">{failure.error}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-xl border border-border p-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Queued</p>
                        <p className="mt-1 text-sm text-foreground">
                          {campaign.externalResponse?.queuedAt
                            ? new Date(campaign.externalResponse.queuedAt).toLocaleString()
                            : "N/A"}
                        </p>
                      </div>
                      <div className="rounded-xl border border-border p-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Started</p>
                        <p className="mt-1 text-sm text-foreground">
                          {campaign.externalResponse?.startedAt
                            ? new Date(campaign.externalResponse.startedAt).toLocaleString()
                            : "N/A"}
                        </p>
                      </div>
                      <div className="rounded-xl border border-border p-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Last Update</p>
                        <p className="mt-1 text-sm text-foreground">
                          {campaign.externalResponse?.lastProcessedAt
                            ? new Date(campaign.externalResponse.lastProcessedAt).toLocaleString()
                            : "N/A"}
                        </p>
                      </div>
                      <div className="rounded-xl border border-border p-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Completed</p>
                        <p className="mt-1 text-sm text-foreground">
                          {campaign.externalResponse?.completedAt
                            ? new Date(campaign.externalResponse.completedAt).toLocaleString()
                            : "N/A"}
                        </p>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
