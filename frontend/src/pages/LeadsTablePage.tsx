import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Mail,
  RefreshCw,
  Search,
  Star,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { LeadImportWorkspace } from "./CreateLeadsPage";
import { INDUSTRIES } from "@/lib/company-profile-options";
import { createCheckoutSession, getBillingPlans, type BillingPlan } from "@/lib/billing";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Lead {
  id: string;
  campaignId?: string | null;
  name: string;
  business: string;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  industry?: string | null;
  location?: string | null;
  status: string;
  createdAt?: string;
  outreachEnabled?: boolean;
  interestScore?: number | null;
  metadata?: Record<string, unknown> | null;
  emailStatus?: {
    sent: boolean;
    sentCount: number;
    lastSentAt: string | null;
  };
}

interface CampaignRecord {
  id: string;
  source: "google_maps" | "yelp" | "yellow_pages" | "custom";
  businessType: string;
  location: string;
  status: string;
  createdAt?: string;
}

// Voice call history removed

type DatePreset = "all" | "today" | "last_7_days" | "last_2_weeks" | "last_month" | "last_6_months" | "last_1_year" | "custom";

const PAGE_SIZE = 10;

type LeadFormState = {
  name: string;
  business: string;
  email: string;
  phone: string;
  website: string;
  industry: string;
  location: string;
  interestScore: string;
};

function LeadsTable() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { subscriptionPlan, role } = useAuth();
  const [search, setSearch] = useState("");
  const [campaignFilter, setCampaignFilter] = useState("all");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [industryFilter, setIndustryFilter] = useState("all");
  const [interestFilter, setInterestFilter] = useState("all");
  const [emailCountFilter, setEmailCountFilter] = useState("all");
  const [profileIndustries, setProfileIndustries] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [billingPlans, setBillingPlans] = useState<BillingPlan[]>([]);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [billingLoading, setBillingLoading] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [leadForm, setLeadForm] = useState<LeadFormState | null>(null);
  const [savingLead, setSavingLead] = useState(false);
  const [totalLeads, setTotalLeads] = useState(0);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [emailDetailLead, setEmailDetailLead] = useState<Lead | null>(null);
  const [emailDetailMessages, setEmailDetailMessages] = useState<Array<{
    id: string; subject: string; body: string; fromEmail: string; toEmail: string;
    direction: string; createdAt: string; isRead: boolean;
  }>>([]);
  const [emailDetailLoading, setEmailDetailLoading] = useState(false);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  useEffect(() => {
    const loadBillingPlans = async () => {
      try {
        const items = await getBillingPlans();
        setBillingPlans(items);
      } catch (err) {
        console.error("Error fetching billing plans:", err);
      }
    };

    void loadBillingPlans();
  }, []);

  const getDateRange = () => {
    if (datePreset === "all") {
      return { from: "", to: "" };
    }

    if (datePreset === "custom") {
      return { from: dateFrom, to: dateTo };
    }

    const now = new Date();
    const end = new Date(now);
    const start = new Date(now);

    if (datePreset === "today") {
      // keep start as today
    } else if (datePreset === "last_7_days") {
      start.setDate(start.getDate() - 7);
    } else if (datePreset === "last_2_weeks") {
      start.setDate(start.getDate() - 14);
    } else if (datePreset === "last_month") {
      start.setMonth(start.getMonth() - 1);
    } else if (datePreset === "last_6_months") {
      start.setMonth(start.getMonth() - 6);
    } else if (datePreset === "last_1_year") {
      start.setFullYear(start.getFullYear() - 1);
    }

    const toInputDate = (value: Date) => value.toISOString().slice(0, 10);
    return { from: toInputDate(start), to: toInputDate(end) };
  };

  const fetchLeads = async () => {
    setIsRefreshing(true);
    try {
      const { from, to } = getDateRange();
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
        engagedOnly: "true",
      });
      if (campaignFilter !== "all") params.set("campaignId", campaignFilter);
      if (from) params.set("dateFrom", from);
      if (to) params.set("dateTo", to);
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
      if (industryFilter !== "all") params.set("industry", industryFilter);
      if (interestFilter === "high") { params.set("minInterestScore", "7"); }
      else if (interestFilter === "medium") { params.set("minInterestScore", "4"); params.set("maxInterestScore", "6"); }
      else if (interestFilter === "low") { params.set("maxInterestScore", "3"); }
      // Email count filter — server-side via minEmailCount/maxEmailCount
      if (emailCountFilter === "none") { params.set("minEmailCount", "0"); params.set("maxEmailCount", "0"); }
      else if (emailCountFilter === "1-3") { params.set("minEmailCount", "1"); params.set("maxEmailCount", "3"); }
      else if (emailCountFilter === "4+") { params.set("minEmailCount", "4"); }
      const data = await api.get<{ items: Lead[]; total: number }>(`/leads?${params.toString()}`);
      setLeads(data.items || []);
      setTotalLeads(data.total || 0);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch leads";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setIsRefreshing(false);
      setLoading(false);
    }
  };

  const fetchCampaigns = async () => {
    try {
      const data = await api.get<{ items: CampaignRecord[] }>("/leads/campaigns/list");
      setCampaigns(data.items || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch campaigns";
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  const fetchProfileIndustries = async () => {
    try {
      const data = await api.get<{ item: { industry?: string } | null }>("/settings/ai-brand-profile");
      const raw = data.item?.industry ?? "";
      const parsed = raw.split(",").map((s) => s.trim()).filter(Boolean);
      setProfileIndustries(parsed);
    } catch {
      setProfileIndustries([]);
    }
  };

  useEffect(() => {
    void fetchLeads();
  }, [campaignFilter, datePreset, dateFrom, dateTo, page, debouncedSearch, industryFilter, interestFilter, emailCountFilter]);

  useEffect(() => {
    setCampaignFilter("all");
    setDatePreset("all");
    setDateFrom("");
    setDateTo("");
    setPage(1);
    void fetchCampaigns();
    void fetchProfileIndustries();
  }, []);

  const paginated = leads;

  const handleUpgradeToAiLeadGen = async () => {
    const aiLeadGenPlan = billingPlans.find((item) => item.planName === "ai_lead_gen");
    if (!aiLeadGenPlan?.priceId) {
      toast({
        title: "Billing plan not configured",
        description: "AI Lead Gen billing is not configured yet.",
        variant: "destructive",
      });
      return;
    }

    setBillingLoading(true);
    try {
      const url = await createCheckoutSession(aiLeadGenPlan.priceId);
      window.location.href = url;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to start checkout";
      toast({ title: "Checkout failed", description: message, variant: "destructive" });
      setBillingLoading(false);
    }
  };

  const canSendEmail = (lead: Lead) =>
    Boolean(lead.email) &&
    (role === "super_admin" || subscriptionPlan === "ai_lead_gen");

  const getActionState = (lead: Lead) => {
    if (!lead.email) return { label: "No Email", className: "border-slate-700 text-slate-500", disabled: true };
    const status = lead.status.toLowerCase();
    if (status === "converted") return { label: "Email Complete", className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400", disabled: false };
    if (lead.emailStatus?.sent) return { label: "Send Again", className: "border-amber-500/30 bg-amber-500/10 text-amber-400", disabled: false };
    return { label: "Pending", className: "border-yellow-500/40 bg-yellow-500/15 text-yellow-400", disabled: true };
  };

  const totalPages = Math.ceil(totalLeads / PAGE_SIZE);
  const leadsWithEmail = leads.filter((l) => l.email).length;
  const leadsContacted = leads.filter((l) => ["contacted", "qualified", "converted"].includes((l.status || "").toLowerCase())).length;
  const canExport = role === "super_admin" || subscriptionPlan === "ai_lead_gen";

  const handleExport = async (format: "csv" | "json") => {
    if (!canExport) {
      setUpgradeOpen(true);
      return;
    }

    try {
      const { from, to } = getDateRange();
      const params = new URLSearchParams({ format });

      if (search.trim()) {
        params.set("search", search.trim());
      }

      if (campaignFilter !== "all") {
        params.set("campaignId", campaignFilter);
      }

      if (from) {
        params.set("dateFrom", from);
      }

      if (to) {
        params.set("dateTo", to);
      }

      const blob = await api.download(`/leads/export?${params.toString()}`);
      const downloadUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");

      anchor.href = downloadUrl;
      anchor.download = `contacts-${timestamp}.${format}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(downloadUrl);

      toast({
        title: `${format.toUpperCase()} export started`,
        description: "Your leads file is downloading.",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : `Failed to export ${format.toUpperCase()}`;
      toast({ title: "Export failed", description: message, variant: "destructive" });
    }
  };

  const openComposeForLead = (lead: Lead) => {
    if (!lead.email) return;

    const params = new URLSearchParams({
      compose: "new",
      to: lead.email,
      subject: `Regarding ${lead.business || lead.name}`,
    });

    navigate(`/email?${params.toString()}`);
  };

  const openEmailDetail = async (lead: Lead) => {
    if (!lead.email) return;
    setEmailDetailLead(lead);
    setEmailDetailMessages([]);
    setEmailDetailLoading(true);
    try {
      const data = await api.get<{ items: Array<{ id: string; subject: string; body: string; fromEmail: string; toEmail: string; direction: string; createdAt: string; isRead: boolean }> }>(`/emails/lead-history?email=${encodeURIComponent(lead.email)}`);
      setEmailDetailMessages(data.items || []);
    } catch (err) {
      setEmailDetailMessages([]);
      const message = err instanceof Error ? err.message : "Failed to load email history";
      toast({ title: "Email history unavailable", description: message, variant: "destructive" });
    } finally {
      setEmailDetailLoading(false);
    }
  };



  const openLeadEditor = (lead: Lead) => {
    setEditingLead(lead);
    setLeadForm({
      name: lead.name,
      business: lead.business,
      email: lead.email ?? "",
      phone: lead.phone ?? "",
      website: lead.website ?? "",
      industry: lead.industry ?? "",
      location: lead.location ?? "",
      interestScore: lead.interestScore != null ? String(lead.interestScore) : "",
    });
  };

  const closeLeadEditor = () => {
    setEditingLead(null);
    setLeadForm(null);
  };

  const updateLeadForm = <K extends keyof LeadFormState>(field: K, value: LeadFormState[K]) => {
    setLeadForm((current) => (current ? { ...current, [field]: value } : current));
  };

  const handleSaveLead = async () => {
    if (!editingLead || !leadForm) return;

    const scoreRaw = leadForm.interestScore.trim();
    const interestScore = scoreRaw !== "" ? Math.min(10, Math.max(0, parseInt(scoreRaw, 10))) : null;

    const normalizedPayload = {
      name: leadForm.name.trim(),
      business: leadForm.business.trim(),
      email: leadForm.email.trim() || null,
      phone: leadForm.phone.trim() || null,
      website: leadForm.website.trim() || null,
      industry: leadForm.industry.trim() || null,
      location: leadForm.location.trim() || null,
      interestScore: Number.isNaN(interestScore) ? null : interestScore,
    };

    if (!normalizedPayload.name || !normalizedPayload.business) {
      toast({
        title: "Missing details",
        description: "Name and business are required.",
        variant: "destructive",
      });
      return;
    }

    setSavingLead(true);
    try {
      const { item } = await api.patch<{ item: Lead }>(`/leads/${editingLead.id}`, normalizedPayload);

      setLeads((current) => current.map((lead) => (lead.id === item.id ? { ...lead, ...item } : lead)));
      closeLeadEditor();
      toast({
        title: "Lead updated",
        description: "Lead details were saved.",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update lead";
      toast({ title: "Update failed", description: message, variant: "destructive" });
    } finally {
      setSavingLead(false);
    }
  };



  return (
    <>
      <div className="space-y-6">
        {/* Summary stats bar */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          {loading ? (
            <span className="text-sm text-muted-foreground">Loading contacts...</span>
          ) : (
            <>
              <span className="font-semibold text-foreground">{totalLeads.toLocaleString()}</span>
              <span>contacts</span>
              <span className="text-border">·</span>
              <span className="font-semibold text-foreground">{leadsWithEmail.toLocaleString()}</span>
              <span>have email</span>
              <span className="text-border">·</span>
              <span className="font-semibold text-foreground">{leadsContacted.toLocaleString()}</span>
              <span>contacted</span>
            </>
          )}
        </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void fetchLeads()} disabled={isRefreshing}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel p-4 border border-orange-500/10 shadow-[0_8px_32px_rgba(255,102,0,0.04)]"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search leads..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-10"
              />
            </div>
            <Select
              value={datePreset}
              onValueChange={(value: DatePreset) => {
                setDatePreset(value);
                if (value !== "custom") {
                  setDateFrom("");
                  setDateTo("");
                }
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-[220px]">
                <SelectValue placeholder="Date Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Dates</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="last_7_days">Last 7 Days</SelectItem>
                <SelectItem value="last_2_weeks">Last 2 Weeks</SelectItem>
                <SelectItem value="last_month">Last Month</SelectItem>
                <SelectItem value="last_6_months">Last 6 Months</SelectItem>
                <SelectItem value="last_1_year">Last 1 Year</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={campaignFilter}
              onValueChange={(value) => {
                setCampaignFilter(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-[260px]">
                <SelectValue placeholder="Campaign" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Campaigns</SelectItem>
                {campaigns.map((campaign) => (
                  <SelectItem key={campaign.id} value={campaign.id}>
                    {campaign.businessType} - {campaign.location}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {datePreset === "custom" ? (
              <>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    setPage(1);
                  }}
                  className="w-full sm:w-[180px]"
                />
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value);
                    setPage(1);
                  }}
                  className="w-full sm:w-[180px]"
                />
              </>
            ) : null}
          </div>
          {/* Second filter row */}
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Select
              value={industryFilter}
              onValueChange={(value) => {
                setIndustryFilter(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-[220px]">
                <SelectValue placeholder="Industry" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Industries</SelectItem>
                {profileIndustries.length > 0
                  ? profileIndustries.map((industry) => (
                    <SelectItem key={industry} value={industry}>{industry}</SelectItem>
                  ))
                  : null}
              </SelectContent>
            </Select>
            <Select
              value={interestFilter}
              onValueChange={(value) => {
                setInterestFilter(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Interest Score" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Interest Levels</SelectItem>
                <SelectItem value="high">High (7–10)</SelectItem>
                <SelectItem value="medium">Medium (4–6)</SelectItem>
                <SelectItem value="low">Low (0–3)</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={emailCountFilter}
              onValueChange={(value) => {
                setEmailCountFilter(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Email Count" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Email Counts</SelectItem>
                <SelectItem value="none">No emails sent</SelectItem>
                <SelectItem value="1-3">1–3 emails</SelectItem>
                <SelectItem value="4+">4+ emails</SelectItem>
              </SelectContent>
            </Select>
            {(industryFilter !== "all" || interestFilter !== "all" || emailCountFilter !== "all") && (
              <button
                type="button"
                className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                onClick={() => {
                  setIndustryFilter("all");
                  setInterestFilter("all");
                  setEmailCountFilter("all");
                  setPage(1);
                }}
              >
                Clear filters
              </button>
            )}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-panel overflow-hidden border border-orange-500/10 shadow-[0_8px_32px_rgba(255,102,0,0.04)]"
        >
          <div className="max-h-[60vh] overflow-x-auto overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="sticky top-0 z-10 border-b border-orange-500/10 bg-[#FAF9F6]">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Business</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Industry</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Email</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Phone No</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Location</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Interest</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Email Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                      Loading leads...
                    </td>
                  </tr>
                ) : paginated.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                      No leads found
                    </td>
                  </tr>
                ) : (
                  paginated.map((lead) => {
                    const emailAction = getActionState(lead);
                    const emailAllowed = canSendEmail(lead);

                    return (
                      <tr key={lead.id} className="border-b border-border/50 transition-colors hover:bg-muted/20">
                        <td className="px-4 py-3 text-muted-foreground">
                          <button
                            type="button"
                            className="w-full text-left hover:text-foreground hover:underline"
                            onClick={() => openLeadEditor(lead)}
                          >
                            <span className="font-medium text-foreground">{lead.name}</span>
                          </button>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          <button
                            type="button"
                            className="w-full text-left hover:text-foreground hover:underline"
                            onClick={() => openLeadEditor(lead)}
                          >
                            {lead.business}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          <button
                            type="button"
                            className="w-full text-left hover:text-foreground hover:underline"
                            onClick={() => openLeadEditor(lead)}
                          >
                            {lead.industry || "-"}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          <button
                            type="button"
                            className="w-full text-left hover:text-foreground hover:underline"
                            onClick={() => openLeadEditor(lead)}
                          >
                            {lead.email || "-"}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          <button
                            type="button"
                            className="w-full text-left hover:text-foreground hover:underline"
                            onClick={() => openLeadEditor(lead)}
                          >
                            {lead.phone || "-"}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          <button
                            type="button"
                            className="w-full text-left hover:text-foreground hover:underline"
                            onClick={() => openLeadEditor(lead)}
                          >
                            {lead.location || "-"}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          {lead.interestScore != null ? (
                            <div className="flex items-center gap-1">
                              <Star className="h-3.5 w-3.5 text-orange-500 fill-orange-500 animate-pulse" />
                              <span className={`text-sm font-bold ${lead.interestScore >= 7 ? "text-orange-600" : lead.interestScore >= 4 ? "text-orange-400" : "text-muted-foreground"}`}>
                                {lead.interestScore}/10
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground/50">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={emailAction.disabled}
                            className={emailAllowed ? emailAction.className : "border-orange-500/30 bg-orange-500/10 text-orange-600 border border-orange-500/20 font-bold"}
                            onClick={() => {
                              if (!emailAllowed) { if (lead.email) setUpgradeOpen(true); return; }
                              if (lead.emailStatus?.sentCount && lead.emailStatus.sentCount > 0) {
                                void openEmailDetail(lead);
                              } else {
                                openComposeForLead(lead);
                              }
                            }}
                          >
                            <Mail className="h-4 w-4" />
                            {emailAllowed
                              ? lead.emailStatus?.sentCount && lead.emailStatus.sentCount > 0
                                ? `See Details · ${lead.emailStatus.sentCount}`
                                : emailAction.label
                              : lead.email ? "Upgrade to Email" : emailAction.label}
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <p className="text-sm text-muted-foreground">Page {page} of {totalPages || 1}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage(page - 1)} disabled={page <= 1}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPage(page + 1)} disabled={page >= totalPages}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </motion.div>
      </div>

      <Dialog open={upgradeOpen} onOpenChange={setUpgradeOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Unlock Emailing</DialogTitle>
            <DialogDescription>
              Email sending is disabled on the Base plan. Upgrade to the Paper Plan AI Outreach plan to unlock emailing from your leads list.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUpgradeOpen(false)}>
              Close
            </Button>
            <Button onClick={() => void handleUpgradeToAiLeadGen()} disabled={billingLoading}>
              {billingLoading ? "Redirecting..." : "Upgrade to AI Outreach"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>



      <Dialog
        open={Boolean(editingLead && leadForm)}
        onOpenChange={(open) => {
          if (!open) {
            closeLeadEditor();
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Lead Details</DialogTitle>
            <DialogDescription>
              {editingLead ? `Update details for ${editingLead.business || editingLead.name}.` : "Update lead details."}
            </DialogDescription>
          </DialogHeader>
          {leadForm ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="lead-name">Name</label>
                <Input id="lead-name" value={leadForm.name} onChange={(event) => updateLeadForm("name", event.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="lead-business">Business</label>
                <Input id="lead-business" value={leadForm.business} onChange={(event) => updateLeadForm("business", event.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="lead-email">Email</label>
                <Input id="lead-email" type="email" value={leadForm.email} onChange={(event) => updateLeadForm("email", event.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="lead-phone">Phone</label>
                <Input id="lead-phone" value={leadForm.phone} onChange={(event) => updateLeadForm("phone", event.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="lead-website">Website</label>
                <Input id="lead-website" value={leadForm.website} onChange={(event) => updateLeadForm("website", event.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="lead-industry">Industry</label>
                <Input id="lead-industry" value={leadForm.industry} onChange={(event) => updateLeadForm("industry", event.target.value)} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <label className="text-sm font-medium text-foreground" htmlFor="lead-location">Location</label>
                <Input id="lead-location" value={leadForm.location} onChange={(event) => updateLeadForm("location", event.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="lead-interest-score">Interest Score (0–10)</label>
                <Input
                  id="lead-interest-score"
                  type="number"
                  min={0}
                  max={10}
                  placeholder="e.g. 7"
                  value={leadForm.interestScore}
                  onChange={(event) => updateLeadForm("interestScore", event.target.value)}
                />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={closeLeadEditor} disabled={savingLead}>
              Cancel
            </Button>
            <Button onClick={() => void handleSaveLead()} disabled={savingLead || !leadForm}>
              {savingLead ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={Boolean(emailDetailLead)} onOpenChange={(open) => { if (!open) setEmailDetailLead(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle className="flex items-center gap-2 text-lg">
              <Mail className="h-5 w-5 text-muted-foreground" />
              Email History
            </SheetTitle>
          </SheetHeader>

          {emailDetailLead && (
            <div className="space-y-5">
              {/* Lead summary card */}
              <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-foreground">{emailDetailLead.name}</p>
                    <p className="text-sm text-muted-foreground">{emailDetailLead.business}</p>
                    <p className="text-xs text-muted-foreground/70 mt-0.5">{emailDetailLead.email}</p>
                  </div>
                  {emailDetailLead.interestScore != null && (
                    <div className="flex flex-col items-center gap-0.5 shrink-0">
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        <span className={`text-base font-bold ${emailDetailLead.interestScore >= 7 ? "text-emerald-400" : emailDetailLead.interestScore >= 4 ? "text-yellow-400" : "text-red-400"}`}>
                          {emailDetailLead.interestScore}/10
                        </span>
                      </div>
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Interest</span>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Badge variant="outline" className="text-xs capitalize">{emailDetailLead.status}</Badge>
                  {emailDetailLead.emailStatus?.sentCount ? (
                    <Badge variant="outline" className="text-xs border-violet-500/40 text-violet-400">
                      {emailDetailLead.emailStatus.sentCount} email{emailDetailLead.emailStatus.sentCount > 1 ? "s" : ""} sent
                    </Badge>
                  ) : null}
                  {emailDetailLead.emailStatus?.lastSentAt ? (
                    <Badge variant="outline" className="text-xs text-muted-foreground">
                      Last: {new Date(emailDetailLead.emailStatus.lastSentAt).toLocaleDateString()}
                    </Badge>
                  ) : null}
                </div>
              </div>

              {/* Action button */}
              <Button size="sm" className="w-full" onClick={() => { setEmailDetailLead(null); openComposeForLead(emailDetailLead); }}>
                <Mail className="mr-2 h-4 w-4" />
                Compose New Email
              </Button>

              {/* Email thread */}
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Thread</p>
                {emailDetailLoading ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">Loading emails…</div>
                ) : emailDetailMessages.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">No emails found for this lead.</div>
                ) : (
                  emailDetailMessages.map((msg) => (
                    <div key={msg.id} className={`rounded-xl border p-3 space-y-1.5 ${msg.direction === "outgoing" ? "border-violet-500/20 bg-violet-500/5" : "border-sky-500/20 bg-sky-500/5"}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full ${msg.direction === "outgoing" ? "bg-violet-500/15 text-violet-400" : "bg-sky-500/15 text-sky-400"}`}>
                          {msg.direction === "outgoing" ? "Sent" : "Received"}
                        </span>
                        <span className="text-xs text-muted-foreground">{new Date(msg.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="text-sm font-medium text-foreground truncate">{msg.subject}</p>
                      <p className="text-xs text-muted-foreground/80 line-clamp-3 whitespace-pre-wrap">{msg.body}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

export default function LeadsTablePage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Contacts</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage engaged leads, active conversations, and communication history from one table.</p>
        </div>
        <LeadsTable />
      </div>
    </DashboardLayout>
  );
}