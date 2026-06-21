import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import {
  Bell,
  BellRing,
  ExternalLink,
  Mail,
  RefreshCw,
  Sparkles,
  User,
  Building2,
  Globe,
  Clock,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

type NotificationItem = {
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

type ParsedNotification = {
  id: string;
  leadBusiness: string;
  leadName: string;
  leadEmail: string;
  leadPhone: string;
  leadIndustry: string;
  leadLocation: string;
  summary: string;
  reason: string;
  fromEmail: string;
  toEmail: string;
  createdAt: Date;
  raw: NotificationItem;
};

function parseNotification(item: NotificationItem): ParsedNotification {
  const meta = item.metadata ?? {};
  const innerMeta =
    (typeof meta.metadata === "object" && meta.metadata !== null && !Array.isArray(meta.metadata)
      ? meta.metadata
      : {}) as Record<string, unknown>;

  const leadContext =
    (typeof innerMeta.leadContext === "object" && innerMeta.leadContext !== null
      ? innerMeta.leadContext
      : typeof meta.leadContext === "object" && meta.leadContext !== null
        ? meta.leadContext
        : {}) as Record<string, unknown>;

  const lead =
    (typeof leadContext.lead === "object" && leadContext.lead !== null
      ? leadContext.lead
      : {}) as Record<string, unknown>;

  return {
    id: item.id,
    leadBusiness:
      (lead.business as string) ||
      (innerMeta.fromEmail as string) ||
      (meta.fromEmail as string) ||
      "Unknown Business",
    leadName: (lead.name as string) || "",
    leadEmail:
      (lead.email as string) ||
      (innerMeta.fromEmail as string) ||
      (meta.fromEmail as string) ||
      "",
    leadPhone: (lead.phone as string) || "",
    leadIndustry: (lead.industry as string) || "",
    leadLocation: (lead.location as string) || "",
    summary: (meta.summary as string) || (innerMeta.summary as string) || "",
    reason: (meta.reason as string) || (innerMeta.reason as string) || "",
    fromEmail: (innerMeta.fromEmail as string) || (meta.fromEmail as string) || "",
    toEmail: (innerMeta.toEmail as string) || (meta.toEmail as string) || "",
    createdAt: new Date(item.createdAt),
    raw: item,
  };
}

export default function NotificationsPage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const prevCountRef = useRef<number | null>(null);

  const fetchNotifications = useCallback(
    async (mode: "initial" | "refresh" | "poll" = "initial") => {
      if (mode === "initial") setLoading(true);
      if (mode === "refresh") setRefreshing(true);

      try {
        const data = await api.get<{ items: NotificationItem[] }>("/emails/ai-logs?limit=100");
        const reviewRequests = (data.items || []).filter(
          (item) => item.action === "emails.human_review_requested"
        );
        setItems(reviewRequests);

        // Toast on new notifications during polling
        if (mode === "poll" && prevCountRef.current !== null) {
          if (reviewRequests.length > prevCountRef.current) {
            const newest = reviewRequests[0];
            const parsed = parseNotification(newest);
            toast({
              title: "🔥 New Interested Lead!",
              description: `${parsed.leadBusiness} — ${parsed.summary || "Intent detected"}`,
              variant: "default",
            });
          }
        }
        prevCountRef.current = reviewRequests.length;
      } catch (err) {
        if (mode !== "poll") {
          const message = err instanceof Error ? err.message : "Failed to load notifications";
          toast({ title: "Error", description: message, variant: "destructive" });
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    void fetchNotifications("initial");

    const interval = setInterval(() => {
      void fetchNotifications("poll");
    }, 15000);

    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const notifications = useMemo(() => items.map(parseNotification), [items]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <BellRing className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                  Notifications
                </h1>
                <p className="text-sm text-muted-foreground">
                  Intent-based lead alerts & AI escalations
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {notifications.length > 0 && (
              <Badge
                variant="secondary"
                className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
              >
                {notifications.length} alert{notifications.length !== 1 ? "s" : ""}
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => void fetchNotifications("refresh")}
              disabled={refreshing}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Empty state */}
        {!loading && notifications.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card rounded-xl p-12 text-center"
          >
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted/50">
              <Bell className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-foreground">No notifications yet</h3>
            <p className="mt-1 text-sm text-muted-foreground max-w-md mx-auto">
              When the AI identifies an interested or high-intent lead from your email campaigns,
              you'll see notifications here with full lead details.
            </p>
          </motion.div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass-card rounded-xl p-6 animate-pulse">
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-lg bg-muted" />
                  <div className="flex-1 space-y-3">
                    <div className="h-4 w-1/3 rounded bg-muted" />
                    <div className="h-3 w-2/3 rounded bg-muted" />
                    <div className="h-3 w-1/2 rounded bg-muted" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Notifications list */}
        <AnimatePresence mode="popLayout">
          <div className="space-y-4">
            {notifications.map((notif, index) => (
              <motion.div
                key={notif.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ delay: index * 0.04 }}
              >
                <Card className="glass-card border-emerald-500/15 hover:border-emerald-500/30 transition-all duration-300 overflow-hidden group">
                  {/* Top accent bar */}
                  <div className="h-0.5 bg-gradient-to-r from-emerald-500/60 via-emerald-400/40 to-transparent" />
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      {/* Icon */}
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 group-hover:bg-emerald-500/15 transition-colors">
                        <Sparkles className="h-5 w-5 text-emerald-500" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        {/* Header row */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="text-sm font-semibold text-foreground truncate">
                              {notif.leadBusiness}
                            </h3>
                            {notif.leadName && (
                              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                                <User className="h-3 w-3 shrink-0" />
                                {notif.leadName}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge
                              variant="outline"
                              className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px] font-semibold"
                            >
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Hot Lead
                            </Badge>
                          </div>
                        </div>

                        {/* Summary */}
                        {notif.summary && (
                          <p className="mt-2 text-xs text-foreground/80 bg-emerald-500/5 border border-emerald-500/10 rounded-lg px-3 py-2 line-clamp-2">
                            {notif.summary}
                          </p>
                        )}

                        {/* Details grid */}
                        <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-3 lg:grid-cols-4">
                          {notif.leadEmail && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
                              <Mail className="h-3 w-3 shrink-0 text-muted-foreground/60" />
                              <span className="truncate font-mono text-[11px]">
                                {notif.leadEmail}
                              </span>
                            </div>
                          )}
                          {notif.leadIndustry && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
                              <Building2 className="h-3 w-3 shrink-0 text-muted-foreground/60" />
                              <span className="truncate capitalize">{notif.leadIndustry}</span>
                            </div>
                          )}
                          {notif.leadLocation && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
                              <Globe className="h-3 w-3 shrink-0 text-muted-foreground/60" />
                              <span className="truncate">{notif.leadLocation}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
                            <Clock className="h-3 w-3 shrink-0 text-muted-foreground/60" />
                            <span className="truncate">
                              {formatDistanceToNow(notif.createdAt, { addSuffix: true })}
                            </span>
                          </div>
                        </div>

                        {/* Reason */}
                        {notif.reason && (
                          <div className="mt-2 flex items-start gap-1.5">
                            <CheckCircle2 className="h-3 w-3 shrink-0 text-muted-foreground/60 mt-0.5" />
                            <span className="text-[11px] text-muted-foreground italic line-clamp-1">
                              Reason: {notif.reason}
                            </span>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="mt-3 flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate("/email")}
                            className="h-7 text-xs text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 font-medium"
                          >
                            <Mail className="h-3.5 w-3.5 mr-1.5" />
                            Open Inbox
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate("/ai-logs")}
                            className="h-7 text-xs text-muted-foreground hover:text-foreground font-medium"
                          >
                            <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                            View Full Log
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}
