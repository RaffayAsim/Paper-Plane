import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Bot, RefreshCw, Search } from "lucide-react";

type AiLogItem = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  actor: {
    id: string;
    email: string;
    displayName: string;
  } | null;
};

function actionLabel(action: string) {
  if (action === "emails.human_review_requested") return "Human Review Requested";
  if (action === "emails.notify_assigned_user") return "Assigned User Notified";
  if (action === "emails.auto_reply.pause") return "Auto-Reply Paused";
  if (action === "emails.followup.schedule") return "Follow-Up Scheduled";
  if (action === "admin.task.create") return "Admin Task Created";
  return action;
}

function summarizeMetadata(metadata: Record<string, unknown> | null) {
  if (!metadata) return "No metadata";
  if (typeof metadata.summary === "string" && metadata.summary.trim()) return metadata.summary;
  if (typeof metadata.reason === "string" && metadata.reason.trim()) return metadata.reason;
  if (typeof metadata.title === "string" && metadata.title.trim()) return metadata.title;
  if (typeof metadata.threadId === "string" && metadata.threadId.trim()) return `Thread ${metadata.threadId}`;
  return "Structured AI activity log";
}

export default function AiLogsPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<AiLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<AiLogItem | null>(null);

  const fetchLogs = async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "initial") setLoading(true);
    if (mode === "refresh") setRefreshing(true);
    try {
      const data = await api.get<{ items: AiLogItem[] }>("/emails/ai-logs?limit=150");
      setItems(data.items || []);
      setSelected((current) => {
        if (!current) return data.items?.[0] ?? null;
        return data.items?.find((item) => item.id === current.id) ?? data.items?.[0] ?? null;
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load AI logs";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void fetchLogs();
  }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return items;
    return items.filter((item) => {
      const haystack = [
        item.action,
        item.entityType,
        item.entityId ?? "",
        item.actor?.email ?? "",
        item.actor?.displayName ?? "",
        summarizeMetadata(item.metadata),
        JSON.stringify(item.metadata ?? {}),
      ].join(" ").toLowerCase();
      return haystack.includes(query);
    });
  }, [items, search]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">AI Logs</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              View AI actions and human-in-the-loop activity related to your account.
            </p>
          </div>
          <Button variant="outline" onClick={() => void fetchLogs("refresh")} disabled={refreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        <Card className="glass-card border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Bot className="h-5 w-5 text-primary" />
              AI Activity Feed
            </CardTitle>
            <CardDescription>
              Logs are scoped to activity created by you or assigned to you.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search AI logs..."
                className="pl-10"
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
              <Card className="border-border/60">
                <CardContent className="p-0">
                  <ScrollArea className="h-[560px]">
                    {loading ? (
                      <div className="px-4 py-10 text-center text-sm text-muted-foreground">Loading AI logs...</div>
                    ) : filtered.length === 0 ? (
                      <div className="px-4 py-10 text-center text-sm text-muted-foreground">No AI logs found.</div>
                    ) : (
                      <div className="divide-y divide-border/60">
                        {filtered.map((item) => {
                          const active = selected?.id === item.id;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => setSelected(item)}
                              className={`w-full px-4 py-3 text-left transition-colors ${
                                active ? "bg-primary/5" : "hover:bg-muted/30"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium text-foreground">{actionLabel(item.action)}</p>
                                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                                    {summarizeMetadata(item.metadata)}
                                  </p>
                                </div>
                                <Badge variant="outline" className="shrink-0">
                                  {item.entityType}
                                </Badge>
                              </div>
                              <p className="mt-2 text-[11px] text-muted-foreground">
                                {format(new Date(item.createdAt), "PPp")}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card className="border-border/60">
                <CardContent className="p-5">
                  {selected ? (
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge>{actionLabel(selected.action)}</Badge>
                        <Badge variant="outline">{selected.entityType}</Badge>
                        {selected.entityId ? <Badge variant="secondary">{selected.entityId}</Badge> : null}
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">Created</p>
                          <p className="mt-1 text-sm text-foreground">{format(new Date(selected.createdAt), "PPpp")}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">Actor</p>
                          <p className="mt-1 text-sm text-foreground">
                            {selected.actor?.displayName || selected.actor?.email || "System"}
                          </p>
                        </div>
                      </div>

                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Summary</p>
                        <p className="mt-1 text-sm text-foreground">{summarizeMetadata(selected.metadata)}</p>
                      </div>

                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Metadata</p>
                        <pre className="mt-2 overflow-x-auto rounded-xl border border-border/60 bg-muted/30 p-4 text-xs text-foreground">
                          {JSON.stringify(selected.metadata ?? {}, null, 2)}
                        </pre>
                      </div>
                    </div>
                  ) : (
                    <div className="flex h-[560px] items-center justify-center text-sm text-muted-foreground">
                      Select a log entry to inspect its details.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
