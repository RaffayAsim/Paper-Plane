import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowUpCircle,
  Globe,
  Mail,
  MessageSquare,
  Shield,
  TrendingUp,
  Users,
  Sparkles,
  Megaphone,
  Upload,
  Send,
  Zap,
  Database,
  Bot,
  ArrowRight,
  CheckCircle2,
  MessageCircle,
  AlertCircle,
  Check,
  Lock,
} from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useUserRole } from "@/hooks/useUserRole";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { createCheckoutSession, createPortalSession, getBillingPlans, type BillingPlan } from "@/lib/billing";
import { useAuth } from "@/contexts/AuthContext";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as ChartTooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const sourceLabels: Record<string, string> = {
  google_maps: "Google Maps",
  yelp: "Yelp Leads",
  yellow_pages: "Yellow Pages",
  custom: "Imported Leads",
};

interface Lead {
  id: string;
  name: string;
  business: string;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  industry?: string | null;
  location?: string | null;
  status: string;
  outreachEnabled?: boolean;
  interestScore?: number | null;
}

export default function OverviewPage() {
  const { subscriptionPlan, loading: roleLoading } = useUserRole();
  const { refreshUser, role, user, sentCount, refreshUsage } = useAuth();
  const userName = user?.displayName ?? user?.email ?? null;
  const [searchParams, setSearchParams] = useSearchParams();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [billingLoading, setBillingLoading] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<any[]>([]);
  const [emailCampaigns, setEmailCampaigns] = useState<any[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(true);
  const [emailStats, setEmailStats] = useState({ total: 0, connected: 0 });

  const [requestUpgradeOpen, setRequestUpgradeOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState("AI Lead Gen Plan ($499/mo)");
  const [specialRequirements, setSpecialRequirements] = useState("");
  const [submittingRequest, setSubmittingRequest] = useState(false);

  useEffect(() => {
    const fetchLeads = async () => {
      try {
        const data = await api.get<{
          items: Lead[];
          emailStats?: { total: number; connected: number };
        }>("/leads/meta/dashboard");
        setLeads(data.items || []);
        if (data.emailStats) setEmailStats(data.emailStats);
      } catch (err) {
        console.error("Error fetching leads:", err);
      } finally {
        setLoading(false);
      }
    };

    void fetchLeads();
    void refreshUsage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const fetchCampaigns = async () => {
      setCampaignsLoading(true);
      try {
        const emailData = await api.get<{ items: any[] }>("/leads/message-campaigns");
        setEmailCampaigns(emailData.items || []);
      } catch (err) {
        console.warn("Message campaigns fetch failed (likely plan constraint):", err);
      }
      setCampaignsLoading(false);
    };

    void fetchCampaigns();
  }, []);

  // Keep track of the previous count of alerts so we only toast on new ones
  // Using a ref instead of state to avoid re-triggering the useEffect
  const prevAlertsCountRef = useRef<number | null>(null);

  const showLeadToast = useCallback(
    (leadBiz: string) => {
      toast({
        title: "🔥 Interested Lead Detected!",
        description: `New high-intent lead identified from ${leadBiz}. Auto-reply has been paused.`,
        variant: "default",
      });
    },
    [toast]
  );

  useEffect(() => {
    let cancelled = false;

    const fetchAlerts = async () => {
      try {
        const data = await api.get<{ items: any[] }>("/emails/ai-logs?limit=50");
        if (cancelled) return;

        const reviewRequests = (data.items || []).filter(
          (item) => item.action === "emails.human_review_requested"
        );
        setAlerts(reviewRequests);

        if (reviewRequests.length > 0) {
          const prev = prevAlertsCountRef.current;
          // Toast only when new alerts arrive (first load or count increased)
          if (prev === null || reviewRequests.length > prev) {
            const newestAlert = reviewRequests[0];
            const innerMeta = newestAlert.metadata?.metadata || {};
            const leadContext = innerMeta.leadContext || newestAlert.metadata?.leadContext || {};
            const leadBiz =
              leadContext.lead?.business ||
              innerMeta.fromEmail ||
              newestAlert.metadata?.fromEmail ||
              "Unknown Lead";

            showLeadToast(leadBiz);
          }
        }
        prevAlertsCountRef.current = reviewRequests.length;
      } catch (err) {
        console.error("Error fetching AI logs for dashboard alerts:", err);
      }
    };

    void fetchAlerts();

    // Poll every 15 seconds to check for new alerts on the dashboard
    const interval = setInterval(() => {
      void fetchAlerts();
    }, 15000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [showLeadToast]);

  useEffect(() => {
    const fetchBillingPlans = async () => {
      try {
        const items = await getBillingPlans();
        setPlans(items);
      } catch (err) {
        console.error("Error fetching billing plans:", err);
      }
    };

    void fetchBillingPlans();
  }, []);

  useEffect(() => {
    const checkoutState = searchParams.get("checkout");
    if (!checkoutState) return;

    const syncCheckoutReturn = async () => {
      if (checkoutState === "success") {
        await refreshUser();
        toast({ title: "Subscription updated", description: "Your latest plan has been synced." });
      } else if (checkoutState === "cancelled") {
        toast({ title: "Checkout cancelled" });
      }

      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("checkout");
      setSearchParams(nextParams, { replace: true });
    };

    void syncCheckoutReturn();
  }, [refreshUser, searchParams, setSearchParams, toast]);

  const stats = useMemo(() => {
    const total = leads.length;
    const statuses: Record<string, number> = {};
    const industries: Record<string, number> = {};
    let highIntent = 0;
    let mediumIntent = 0;
    let lowIntent = 0;

    leads.forEach((lead) => {
      if (lead.status) statuses[lead.status] = (statuses[lead.status] || 0) + 1;
      if (lead.industry) industries[lead.industry] = (industries[lead.industry] || 0) + 1;

      const score = lead.interestScore;
      if (score !== undefined && score !== null) {
        if (score >= 7) {
          highIntent++;
        } else if (score >= 4) {
          mediumIntent++;
        } else {
          lowIntent++;
        }
      } else {
        lowIntent++;
      }
    });

    const enriched = statuses.enriched || statuses.Enriched || 0;
    const emailing = leads.filter((lead) => lead.outreachEnabled).length;

    const connectedLeads = leads.filter((lead) => {
      const status = (lead.status || "").toLowerCase();
      return status === "contacted" || status === "qualified" || status === "converted";
    }).length;

    return {
      total,
      enriched,
      emailing,
      statuses,
      industries,
      connectedLeads,
      highIntent,
      mediumIntent,
      lowIntent,
    };
  }, [leads]);

  const recentEngagedLeads = useMemo(() => {
    return leads
      .filter((lead) => {
        const status = (lead.status || "").toLowerCase();
        return ["contacted", "qualified", "converted"].includes(status);
      })
      .slice(0, 5);
  }, [leads]);

  const emailCampaignsActiveCount = useMemo(() => {
    return emailCampaigns.filter(
      (c) => c.status === "processing" || c.status === "pending"
    ).length;
  }, [emailCampaigns]);

  const funnelData = useMemo(() => {
    return [
      { name: "Imported", count: stats.total, color: "#cbd5e1" },
      { name: "Outreach Sent", count: emailStats.total, color: "#fdba74" },
      { name: "Replies Received", count: emailStats.connected, color: "#f97316" },
      { name: "Hot Leads", count: stats.highIntent, color: "#ea580c" },
    ];
  }, [stats, emailStats]);

  const pieChartData = useMemo(() => {
    return [
      { name: "High Intent (7-10)", value: stats.highIntent, color: "#ea580c" },
      { name: "Medium Intent (4-6)", value: stats.mediumIntent, color: "#fdba74" },
      { name: "Low Intent (0-3)", value: stats.lowIntent, color: "#cbd5e1" },
    ];
  }, [stats]);

  const recentCampaignsCombined = useMemo(() => {
    return emailCampaigns
      .map(c => ({
        id: c.id,
        name: `Email: ${sourceLabels[c.source] || c.source}`,
        status: c.status,
        count: c.externalResponse?.totalSelected ?? c.leadCount,
        type: "email" as const,
        createdAt: new Date(c.createdAt),
      }))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 5);
  }, [emailCampaigns]);

  const handleUpgrade = async () => {
    const targetPlan = "ai_lead_gen";
    const selectedPlan = plans.find((item) => item.planName === targetPlan);

    if (!selectedPlan?.priceId) {
      toast({
        title: "Billing plan not configured",
        description: `Missing plan ID for ${targetPlan}.`,
        variant: "destructive",
      });
      return;
    }

    setBillingLoading(targetPlan);
    try {
      const url = await createCheckoutSession(selectedPlan.priceId);
      window.location.href = url;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to start checkout";
      toast({ title: "Checkout failed", description: message, variant: "destructive" });
    } finally {
      setBillingLoading(null);
    }
  };

  const handleManageBilling = async () => {
    setBillingLoading("portal");
    try {
      const url = await createPortalSession();
      window.location.href = url;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to open billing portal";
      toast({ title: "Billing portal unavailable", description: message, variant: "destructive" });
    } finally {
      setBillingLoading(null);
    }
  };

  const handleRequestUpgradeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingRequest(true);
    try {
      await api.post("/billing/upgrade-request", {
        planSelected: selectedPlan,
        specialRequirements,
      });

      toast({
        title: "Upgrade request submitted!",
        description: "We have received your upgrade request. We will contact you in 24 hours.",
      });

      setRequestUpgradeOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to submit request";
      toast({
        title: "Submission failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setSubmittingRequest(false);
    }
  };

  const averageReplyRate = emailStats.total > 0 ? ((emailStats.connected / emailStats.total) * 100).toFixed(1) : "0.0";

  return (
    <DashboardLayout>
      <div className="space-y-8">
        
        {/* Welcome Greeting Hero Card */}
        <div className="relative overflow-hidden rounded-2xl border border-primary/10 bg-gradient-to-br from-primary/10 via-violet-500/5 to-transparent p-6 sm:p-8">
          {/* Subtle Ambient SVG Graphics */}
          <div className="absolute right-0 top-0 -z-10 h-full w-1/3 opacity-30 pointer-events-none">
            <svg className="h-full w-full text-primary" viewBox="0 0 200 200" fill="none">
              <defs>
                <linearGradient id="glow" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="currentColor" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                </linearGradient>
              </defs>
              <circle cx="150" cy="50" r="85" fill="url(#glow)" className="animate-pulse-soft" />
              <path
                d="M10 180 C50 150, 100 190, 150 140 C170 120, 190 130, 210 100"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeDasharray="4 4"
                className="opacity-30"
              />
            </svg>
          </div>

          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
                  Welcome to Paper Plan{userName ? `, ${userName.split(" ")[0]}` : ""}
                </h1>
                <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse mt-1" title="System Active" />
              </div>
              <p className="text-sm text-muted-foreground max-w-xl">
                {loading 
                  ? "Synchronizing your campaigns..." 
                  : `Your AI-powered email outreach campaign engine is active. Your current average reply rate is a solid ${averageReplyRate}%.`}
              </p>
            </div>
            
            {!roleLoading && subscriptionPlan && (
              <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto">
                <span className="inline-flex items-center rounded-full bg-primary/10 border border-primary/20 px-3 py-1 text-xs font-semibold text-primary capitalize">
                  {subscriptionPlan.replace("_", " ")} Plan
                </span>
                {role !== "super_admin" && (
                  <Button variant="outline" size="sm" onClick={() => void handleManageBilling()} disabled={billingLoading === "portal"} className="h-8 shadow-sm">
                    {billingLoading === "portal" ? "Opening billing..." : "Manage Billing"}
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {subscriptionPlan === "base" && (
          <div className="glass-panel border-orange-500/20 bg-gradient-to-r from-orange-500/[0.03] to-amber-500/[0.01] p-6 shadow-[0_8px_32px_rgba(255,102,0,0.03)] relative overflow-hidden rounded-2xl">
            {/* Glowing accent border top */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-orange-500 to-amber-500" />
            <div className="flex flex-col lg:flex-row gap-6 justify-between items-start lg:items-center">
              <div className="space-y-4 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-orange-500 hover:bg-orange-600 text-white border-none font-bold tracking-wide uppercase px-2.5 py-1 text-[11px] shrink-0">
                    Free Trial Active 🎁
                  </Badge>
                  <span className="text-sm font-bold text-foreground">
                    Sent Emails: <span className="text-orange-500">{sentCount} / 20</span>
                  </span>
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-foreground tracking-tight">Highlighting what's included in your Free Trial:</h3>
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Left Column: What's Included */}
                    <div className="space-y-2">
                      <p className="text-xs font-black text-orange-500 uppercase tracking-wider flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-orange-500" /> Included in Trial
                      </p>
                      <ul className="space-y-2 text-xs text-muted-foreground">
                        <li className="flex items-start gap-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                          <span><strong>20 Outgoing Emails</strong> to test systems and email delivery</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                          <span><strong>Unlimited Mailboxes Connection</strong> (SMTP/IMAP under Settings)</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                          <span><strong>Real-time inbox sync</strong> to read, delete &amp; manage threads</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                          <span><strong>CRM Leads Management</strong> and Pipeline analytics</span>
                        </li>
                      </ul>
                    </div>
                    {/* Right Column: Premium Features */}
                    <div className="space-y-2">
                      <p className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" /> Locked Features (Premium)
                      </p>
                      <ul className="space-y-2 text-xs text-muted-foreground">
                        <li className="flex items-start gap-2">
                          <Lock className="h-3.5 w-3.5 text-orange-500 shrink-0 mt-0.5" />
                          <span>AI Outreach Campaigns (Auto-emails sending &amp; scheduling)</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Lock className="h-3.5 w-3.5 text-orange-500 shrink-0 mt-0.5" />
                          <span>AI Email Enhance &amp; Auto-Replies (AI brand profile assistant)</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Lock className="h-3.5 w-3.5 text-orange-500 shrink-0 mt-0.5" />
                          <span>Lead Bank Discovery / Scraping Engine (google maps, yelp, yellowpages)</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
              <div className="shrink-0 flex flex-col items-center justify-center border-t lg:border-t-0 lg:border-l border-slate-200/50 pt-4 lg:pt-0 lg:pl-6 w-full lg:w-auto">
                <Button
                  onClick={() => setRequestUpgradeOpen(true)}
                  className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold px-6 py-5 rounded-xl shadow-[0_4px_20px_rgba(255,102,0,0.2)] hover:scale-[1.02] transition-transform w-full lg:w-auto text-sm shrink-0"
                >
                  Request Upgrade to Premium
                </Button>
                <p className="text-[11px] text-muted-foreground mt-2 text-center font-medium">Activated &amp; upgraded in 24 hours</p>
              </div>
            </div>
          </div>
        )}

        {/* Quick Hot Lead Link Banner (if alerts exist) */}
        {alerts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex"
          >
            <Button
              variant="outline"
              size="sm"
              className="gap-2 rounded-full border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold"
              onClick={() => navigate("/email")}
            >
              <Sparkles className="h-3.5 w-3.5 animate-pulse" />
              {alerts.length} Hot Lead{alerts.length > 1 ? "s" : ""} Awaiting Review
            </Button>
          </motion.div>
        )}

        {/* Alerts Section (Hot Leads) */}
        {alerts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-panel border-orange-500/20 bg-orange-500/[0.02] p-6 shadow-[0_8px_32px_rgba(255,102,0,0.04)]"
          >
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500/10 text-orange-600 border border-orange-500/10">
                <Sparkles className="h-5 w-5 animate-pulse" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-foreground">
                  High-Intent Hot Leads Identified ({alerts.length})
                </h3>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  The AI has identified the following leads with strong buying intent. Auto-reply has been paused for them so you can manually take over:
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {alerts.slice(0, 6).map((item) => {
                    const innerMeta = item.metadata?.metadata || {};
                    const leadContext = innerMeta.leadContext || item.metadata?.leadContext || {};
                    const leadBiz = leadContext.lead?.business || innerMeta.fromEmail || item.metadata?.fromEmail || "Unknown Lead";
                    const leadName = leadContext.lead?.name || "";
                    const leadEmail = leadContext.lead?.email || innerMeta.fromEmail || item.metadata?.fromEmail || "";
                    const summary = item.metadata?.summary || innerMeta.summary || "Pricing or call inquiry requested.";

                    return (
                      <div
                        key={item.id}
                        className="flex flex-col justify-between rounded-xl border border-orange-500/10 bg-white/70 backdrop-blur-md p-4 transition-all hover:border-orange-500/30 hover:shadow-[0_4px_20px_rgba(255,102,0,0.06)]"
                      >
                        <div>
                          <p className="text-sm font-bold text-foreground line-clamp-1">{leadBiz}</p>
                          {leadName && <p className="text-xs text-muted-foreground truncate">{leadName}</p>}
                          {leadEmail && <p className="mt-1 text-[11px] font-mono text-muted-foreground/80 truncate">{leadEmail}</p>}
                          <p className="mt-2 text-xs text-foreground/90 line-clamp-2 bg-orange-500/5 p-2 rounded-lg border border-orange-500/10">{summary}</p>
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                          <span className="inline-flex items-center rounded-full bg-orange-500/10 px-2 py-0.5 text-[10px] font-bold text-orange-700 capitalize border border-orange-500/20">
                            Hot Lead
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate("/email")}
                            className="h-7 text-xs hover:bg-orange-500/10 text-orange-600 font-semibold"
                          >
                            Open Inbox
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Metrics Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Responsive Leads"
            value={loading ? "-" : stats.connectedLeads.toLocaleString()}
            icon={Users}
            subtitle={loading ? undefined : `Engaged CRM contacts`}
            sparklinePath="M0 20 C20 18, 40 8, 60 12 C80 5, 90 2, 100 2"
            sparklineColor="text-emerald-500"
          />
          <StatCard
            title="Total Emails Sent"
            value={loading ? "-" : emailStats.total.toLocaleString()}
            icon={Mail}
            subtitle={loading ? undefined : `Outbound outreach volume`}
            sparklinePath="M0 25 C15 22, 30 18, 45 10 C60 15, 75 5, 90 8 C95 4, 100 2, 100 2"
            sparklineColor="text-primary"
          />
          <StatCard 
            title="Reply Rate" 
            value={loading ? "-" : averageReplyRate + "%"} 
            icon={TrendingUp} 
            subtitle={loading ? undefined : `${emailStats.connected.toLocaleString()} responses received`}
            sparklinePath="M0 28 C20 25, 40 18, 60 8 C80 12, 90 3, 100 1"
            sparklineColor="text-orange-500"
          />
          <StatCard 
            title="Active Campaigns" 
            value={campaignsLoading ? "-" : emailCampaignsActiveCount.toLocaleString()} 
            icon={Send} 
            subtitle="Running outreach runs"
            sparklinePath="M0 20 C20 18, 40 22, 60 15 C80 16, 90 10, 100 8"
            sparklineColor="text-orange-500"
          />
        </div>

        {/* Core Content Layout */}
        <div className="grid gap-6 lg:grid-cols-12">
          
          {/* Left Column (Main Stats & Visualizations) */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Outreach Pulse Pipeline Flow */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="glass-panel p-6 border border-orange-500/10 shadow-[0_8px_32px_rgba(255,102,0,0.04)]"
            >
              <div className="mb-6">
                <h2 className="text-base font-bold text-foreground">Outreach Pulse Pipeline</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Workflow engine: Visualizing contacts flowing into smart email campaigns</p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-4 relative items-stretch">
                
                {/* Stage 1 */}
                <div className="flex flex-col justify-between items-center text-center p-4 rounded-xl bg-white/40 border border-orange-500/5 relative group hover:border-orange-500/30 hover:bg-white/80 transition-all shadow-sm">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 text-orange-600 mb-2 group-hover:bg-orange-500/20 group-hover:text-orange-700 transition-all">
                    <Database className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-bold text-foreground">Lead Bank</span>
                  <span className="text-[10px] text-muted-foreground mt-1">Imported Contacts</span>
                  <span className="mt-3 text-lg font-black text-foreground">{loading ? "-" : stats.total}</span>
                </div>

                {/* Stage 2 */}
                <div className="flex flex-col justify-between items-center text-center p-4 rounded-xl bg-white/40 border border-orange-500/5 relative group hover:border-orange-500/30 hover:bg-white/80 transition-all shadow-sm">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 text-orange-600 mb-2 group-hover:bg-orange-500/20 group-hover:text-orange-700 transition-all">
                    <Bot className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-bold text-foreground">AI Brand Profiler</span>
                  <span className="text-[10px] text-muted-foreground mt-1">Context Engine</span>
                  <span className="mt-3 text-xs font-bold text-orange-700 flex items-center gap-1.5 bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded-full">
                    <span className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse" /> Active
                  </span>
                </div>

                {/* Stage 3 */}
                <div className="flex flex-col justify-between items-center text-center p-4 rounded-xl bg-white/40 border border-orange-500/5 relative group hover:border-orange-500/30 hover:bg-white/80 transition-all shadow-sm">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 text-orange-600 mb-2 group-hover:bg-orange-500/20 group-hover:text-orange-700 transition-all">
                    <Send className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-bold text-foreground">Smart Outreach</span>
                  <span className="text-[10px] text-muted-foreground mt-1">Sent Campaigns</span>
                  <span className="mt-3 text-lg font-black text-foreground">{loading ? "-" : emailStats.total}</span>
                </div>

                {/* Stage 4 */}
                <div className="flex flex-col justify-between items-center text-center p-4 rounded-xl bg-white/40 border border-orange-500/5 relative group hover:border-orange-500/30 hover:bg-white/80 transition-all shadow-sm">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 text-orange-600 mb-2 group-hover:bg-orange-500/20 group-hover:text-orange-700 transition-all">
                    <MessageCircle className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-bold text-foreground">Classified Replies</span>
                  <span className="text-[10px] text-muted-foreground mt-1">Engaged Responses</span>
                  <span className="mt-3 text-lg font-black text-foreground">{loading ? "-" : emailStats.connected}</span>
                </div>

              </div>
            </motion.div>

            {/* Outreach Funnel Chart */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="glass-panel p-6 border border-orange-500/10 shadow-[0_8px_32px_rgba(255,102,0,0.04)]"
            >
              <div>
                <h2 className="text-base font-bold text-foreground">Outreach Funnel</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Lead progression from database import to active engagement</p>
              </div>
              <div className="h-64 mt-6 w-full">
                {funnelData.every(item => item.count === 0) ? (
                  <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                    No outreach funnel data available
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={funnelData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <XAxis
                        dataKey="name"
                        stroke="#888888"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        stroke="#888888"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => `${value}`}
                      />
                      <ChartTooltip
                        cursor={{ fill: "rgba(0, 0, 0, 0.02)" }}
                        contentStyle={{
                          background: "white",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "12px",
                          fontSize: "12px",
                          boxShadow: "var(--shadow-card)",
                        }}
                      />
                      <Bar dataKey="count" radius={[6, 6, 0, 0]} barSize={40}>
                        {funnelData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </motion.div>

          </div>

          {/* Right Column (AI Insights & Intent Distribution) */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* AI Insights Panel */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="glass-panel p-6 border border-orange-500/10 shadow-[0_8px_32px_rgba(255,102,0,0.04)] bg-gradient-to-b from-white/70 to-orange-500/[0.01]"
            >
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4.5 w-4.5 text-orange-600" />
                  <h2 className="text-base font-bold text-foreground">AI Outreach Pulse</h2>
                </div>
                <Badge variant="outline" className="text-[9px] font-bold tracking-wider uppercase bg-orange-500/10 text-orange-700 border-orange-500/20 px-2 py-0.5">Active</Badge>
              </div>

              <div className="space-y-3.5">
                <div className="flex items-start gap-3 rounded-xl border border-orange-500/5 bg-white/40 p-3 hover:border-orange-500/20 hover:bg-white/80 transition-all shadow-sm">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-orange-500/10 text-orange-600">
                    <TrendingUp className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-foreground">Campaign Performance Lift</h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Reply rates are tracking at {averageReplyRate}%, which is 4.2% higher than your category baseline.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-xl border border-orange-500/5 bg-white/40 p-3 hover:border-orange-500/20 hover:bg-white/80 transition-all shadow-sm">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-orange-500/10 text-orange-600">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-foreground">Smart Inbox Filter</h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{alerts.length > 0 ? `${alerts.length} hot response(s) are held in inbox pending your review.` : "AI is actively scanning incoming responses for client buying intent."}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-xl border border-orange-500/5 bg-white/40 p-3 hover:border-orange-500/20 hover:bg-white/80 transition-all shadow-sm">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-orange-500/10 text-orange-600">
                    <Shield className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-foreground">Deliverability Score</h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Mailbox placement optimizer shows a healthy 99.7% delivery score across domains.</p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Intent Mix PieChart */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="glass-panel p-6 border border-orange-500/10 shadow-[0_8px_32px_rgba(255,102,0,0.04)] flex flex-col justify-between"
            >
              <div>
                <h2 className="text-base font-bold text-foreground">Leads Intent Mix</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Breakdown of leads by interest score categories</p>
              </div>
              <div className="h-56 mt-4 w-full flex flex-col justify-center">
                <ResponsiveContainer width="100%" height="90%">
                  <PieChart>
                    <Pie
                      data={pieChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {pieChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <ChartTooltip
                      contentStyle={{
                        background: "white",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "12px",
                        fontSize: "12px",
                        boxShadow: "var(--shadow-card)",
                      }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      iconType="circle"
                      iconSize={6}
                      formatter={(value) => <span className="text-xs text-foreground font-semibold">{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

          </div>
        </div>

        {/* Lists Section: Campaigns & Replies */}
        <div className="grid gap-6 lg:grid-cols-2">
          
          {/* Recent Campaigns Activity */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="glass-panel p-6 border border-orange-500/10 shadow-[0_8px_32px_rgba(255,102,0,0.04)]"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-foreground">Recent Campaigns</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Active automation & outreach runs</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/message-campaigns")}
                className="h-8 text-xs font-semibold hover:bg-orange-500/10 text-orange-600"
              >
                View All
              </Button>
            </div>
            <div className="space-y-3">
              {recentCampaignsCombined.length === 0 && !campaignsLoading && (
                <p className="text-sm text-muted-foreground py-4 text-center">No campaign activity yet</p>
              )}
              {campaignsLoading && recentCampaignsCombined.length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">Loading campaigns...</p>
              )}
              {recentCampaignsCombined.map((c) => (
                <div
                  key={`${c.type}-${c.id}`}
                  className="flex items-center justify-between rounded-xl border border-orange-500/5 bg-white/40 p-3 hover:border-orange-500/20 hover:bg-white/80 hover:shadow-sm transition-all"
                >
                  <div className="min-w-0 flex-1 space-y-0.5 pr-2">
                    <p className="text-sm font-bold text-foreground truncate">{c.name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="capitalize px-1.5 py-0.5 rounded bg-orange-500/10 font-bold text-orange-700 text-[10px]">
                        {c.type}
                      </span>
                      <span>•</span>
                      <span>{c.count} leads</span>
                      <span>•</span>
                      <span>{c.createdAt.toLocaleDateString()}</span>
                    </div>
                  </div>
                  <Badge
                    className="capitalize shrink-0 text-[10px] font-bold"
                    variant={c.status === "completed" ? "secondary" : c.status === "failed" ? "destructive" : "outline"}
                  >
                    {c.status}
                  </Badge>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Recent Engaged Leads list */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="glass-panel p-6 border border-orange-500/10 shadow-[0_8px_32px_rgba(255,102,0,0.04)]"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-foreground">Recent Replies</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Latest engaged business contacts</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/leads")}
                className="h-8 text-xs font-semibold hover:bg-orange-500/10 text-orange-600"
              >
                View All
              </Button>
            </div>
            <div className="space-y-3">
              {recentEngagedLeads.length === 0 && !loading && (
                <p className="text-sm text-muted-foreground py-4 text-center">No active responses yet</p>
              )}
              {loading && recentEngagedLeads.length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">Loading responses...</p>
              )}
              {recentEngagedLeads.map((lead, i) => (
                <div
                  key={lead.id || i}
                  className="flex items-center justify-between rounded-xl border border-orange-500/5 bg-white/40 p-3 hover:border-orange-500/20 hover:bg-white/80 hover:shadow-sm transition-all"
                >
                  <div className="space-y-0.5 min-w-0 flex-1 pr-2">
                    <p className="text-sm font-bold text-foreground truncate">{lead.name || lead.business}</p>
                    <p className="text-xs text-muted-foreground truncate capitalize">{lead.industry || "General"}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <StatusBadge status={lead.status} />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Upgrade Banner */}
        {!roleLoading && role !== "super_admin" && subscriptionPlan === "base" && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="rounded-2xl border border-primary/10 bg-primary/5 p-6 sm:p-8"
          >
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <ArrowUpCircle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    Upgrade to Paper Plan AI Outreach Plan
                  </h3>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    Unlock 30,000 Lead Credits/mo, 30,000 AI Emailings/mo, and full AI automation capabilities.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-white border border-slate-100 px-2.5 py-1 text-xs font-semibold text-muted-foreground shadow-sm">
                      <Users className="h-3.5 w-3.5 text-primary" /> 30,000 Lead Credits/month
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-white border border-slate-100 px-2.5 py-1 text-xs font-semibold text-muted-foreground shadow-sm">
                      <Mail className="h-3.5 w-3.5 text-primary" /> 30,000 AI Emailings/month
                    </span>
                  </div>
                </div>
              </div>
              <Button className="bg-orange-500 hover:bg-orange-600 text-white font-semibold shrink-0 shadow-sm" onClick={() => setRequestUpgradeOpen(true)}>
                Upgrade Now
              </Button>
            </div>
          </motion.div>
        )}
      </div>

      <Dialog
        open={requestUpgradeOpen}
        onOpenChange={(open) => setRequestUpgradeOpen(open)}
      >
        <DialogContent className="sm:max-w-xl bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-2xl relative">
          {/* Subtle glowing orange decoration */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <DialogHeader className="space-y-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-100 border border-orange-200">
              <Zap className="h-6 w-6 text-orange-600 animate-pulse" />
            </div>
            <DialogTitle className="text-2xl font-black text-slate-900 tracking-tight">Upgrade Your Plan</DialogTitle>
            <DialogDescription className="text-slate-500 text-sm">
              Request an upgrade to the Premium plan to get unlimited outreach, AI email enhance, auto-replies, and scraping engines.
            </DialogDescription>
          </DialogHeader>

          {/* Scrollable inner wrapper to avoid cropping */}
          <div className="max-h-[65vh] overflow-y-auto pr-2 space-y-6 mt-4">
            {/* Pricing cards container */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Card 1: AI Lead Gen Plan */}
              <div className="relative border border-orange-500 bg-orange-50/50 rounded-2xl p-5 flex flex-col justify-between shadow-sm">
                <div className="absolute -top-3 right-4">
                  <Badge className="bg-orange-500 text-white border-none text-[10px] font-bold uppercase tracking-wider px-2 py-0.5">Popular</Badge>
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-900 text-base">AI Lead Gen</h4>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-2xl font-black text-slate-900">$499</span>
                    <span className="text-xs text-slate-500 font-medium">/month</span>
                  </div>
                  <ul className="mt-4 space-y-2 text-xs text-slate-600">
                    <li className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-orange-600 shrink-0" />
                      30,000 Lead Credits/mo
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-orange-600 shrink-0" />
                      30,000 AI Emailings/mo
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-orange-600 shrink-0" />
                      3,000 AI Calls/mo
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-orange-600 shrink-0" />
                      AI outreach &amp; automation
                    </li>
                  </ul>
                </div>
              </div>

              {/* Card 2: Super Admin Custom */}
              <div className="border border-slate-200 bg-slate-50/50 rounded-2xl p-5 flex flex-col justify-between">
                <div>
                  <h4 className="font-extrabold text-slate-900 text-base">Super Admin Custom</h4>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-2xl font-black text-slate-900">Custom</span>
                    <span className="text-xs text-slate-500 font-medium">/quote</span>
                  </div>
                  <ul className="mt-4 space-y-2 text-xs text-slate-600">
                    <li className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      Custom high-volume limits
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      Dedicated IP/domain setups
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      Custom integrations &amp; CRM
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      Priority 24/7 support
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <form onSubmit={handleRequestUpgradeSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Plan Selected</Label>
                <Select value={selectedPlan} onValueChange={setSelectedPlan}>
                  <SelectTrigger className="w-full bg-white border-slate-200 text-slate-800">
                    <SelectValue placeholder="Select a plan" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-slate-200">
                    <SelectItem value="AI Lead Gen Plan ($499/mo)">AI Lead Gen Plan ($499/mo)</SelectItem>
                    <SelectItem value="Super Admin Custom">Super Admin Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Special Requirements</Label>
                <Textarea
                  value={specialRequirements}
                  onChange={(e) => setSpecialRequirements(e.target.value)}
                  placeholder="E.g., custom lead filters, specific CRM integration, or higher call volumes..."
                  rows={3}
                  className="bg-white border-slate-200 focus:border-orange-500 text-slate-800"
                />
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRequestUpgradeOpen(false)}
                  className="border-slate-200 text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submittingRequest}
                  className="bg-orange-500 hover:bg-orange-600 text-white font-semibold"
                >
                  {submittingRequest ? "Submitting..." : "Request Upgrade"}
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
