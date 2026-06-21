import { useEffect, useMemo, useState, ComponentType } from "react";
import { NavLink as RouterNavLink, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowUpCircle,
  Bell,
  ChevronLeft,
  ChevronRight,
  Menu,
  LayoutDashboard,
  Lock,
  LogOut,
  Mail,
  BotMessageSquare,
  MessageSquare,
  ListChecks,
  CreditCard,
  Search,
  Settings,
  Table2,
  Send,
  PlugZap,
  Bot,
  User,
  Users,
  Zap,
  Sparkles,
  X,
  ChevronDown,
  Undo2,
  Check,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { createCheckoutSession, getBillingPlans, type BillingPlan } from "@/lib/billing";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { api } from "@/lib/api";

const DashboardIcon = ({ className }: { className?: string }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" className={cn("w-5 h-5 shrink-0", className)} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <defs>
      <linearGradient id="dbGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="hsl(24, 100%, 50%)" stopOpacity="0.3" />
        <stop offset="100%" stopColor="hsl(36, 100%, 55%)" stopOpacity="0.05" />
      </linearGradient>
    </defs>
    <rect x="3" y="3" width="7" height="9" rx="1.5" fill="url(#dbGrad)" strokeWidth="2" />
    <rect x="14" y="3" width="7" height="5" rx="1.5" fill="none" strokeWidth="2" />
    <rect x="14" y="11" width="7" height="10" rx="1.5" fill="url(#dbGrad)" strokeWidth="2" />
    <rect x="3" y="15" width="7" height="6" rx="1.5" fill="none" strokeWidth="2" />
  </svg>
);

const ContactsIcon = ({ className }: { className?: string }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" className={cn("w-5 h-5 shrink-0", className)} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <defs>
      <linearGradient id="contactsGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="hsl(24, 100%, 50%)" stopOpacity="0.25" />
        <stop offset="100%" stopColor="hsl(36, 100%, 55%)" stopOpacity="0.02" />
      </linearGradient>
    </defs>
    <rect x="3" y="4" width="18" height="16" rx="2" fill="url(#contactsGrad)" strokeWidth="2" />
    <line x1="3" y1="9" x2="21" y2="9" strokeWidth="1.5" />
    <circle cx="8" cy="14" r="1.5" fill="currentColor" />
    <circle cx="16" cy="14" r="1.5" fill="currentColor" />
    <line x1="7" y1="17" x2="11" y2="17" strokeWidth="1.5" />
    <line x1="13" y1="17" x2="17" y2="17" strokeWidth="1.5" />
  </svg>
);

const InboxIcon = ({ className }: { className?: string }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" className={cn("w-5 h-5 shrink-0", className)} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <defs>
      <linearGradient id="inboxGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="hsl(24, 100%, 50%)" stopOpacity="0.3" />
        <stop offset="100%" stopColor="hsl(36, 100%, 55%)" stopOpacity="0.05" />
      </linearGradient>
    </defs>
    <path d="M4 4h16v4H4V4z" fill="url(#inboxGrad)" strokeWidth="1.5" />
    <path d="M22 12h-6l-2 3H10l-2-3H2" />
    <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" fill="url(#inboxGrad)" strokeWidth="2" />
  </svg>
);

const ImportContactsIcon = ({ className }: { className?: string }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" className={cn("w-5 h-5 shrink-0", className)} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <defs>
      <linearGradient id="importGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="hsl(24, 100%, 50%)" stopOpacity="0.2" />
        <stop offset="100%" stopColor="hsl(36, 100%, 55%)" stopOpacity="0.01" />
      </linearGradient>
    </defs>
    <ellipse cx="12" cy="5" rx="9" ry="3" fill="url(#importGrad)" strokeWidth="2" />
    <path d="M3 5v6c0 1.66 4 3 9 3s9-1.34 9-3V5" strokeWidth="2" />
    <path d="M3 11v6c0 1.66 4 3 9 3s9-1.34 9-3v-6" fill="url(#importGrad)" strokeWidth="2" />
    <path d="M12 2v8M9 7l3 3 3-3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CampaignGroupIcon = ({ className }: { className?: string }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" className={cn("w-5 h-5 shrink-0", className)} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <defs>
      <linearGradient id="campGroupGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="hsl(24, 100%, 50%)" stopOpacity="0.25" />
        <stop offset="100%" stopColor="hsl(36, 100%, 55%)" stopOpacity="0.05" />
      </linearGradient>
    </defs>
    <rect x="2" y="4" width="20" height="16" rx="2" fill="url(#campGroupGrad)" strokeWidth="2" />
    <path d="M22 7l-8.97 5.7a1.9 1.9 0 0 1-2.06 0L2 7" strokeWidth="2" />
    <path d="M12 18h8M15 15h5" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const NewCampaignIcon = ({ className }: { className?: string }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" className={cn("w-5 h-5 shrink-0", className)} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <defs>
      <linearGradient id="rocketGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="hsl(24, 100%, 50%)" stopOpacity="0.35" />
        <stop offset="100%" stopColor="hsl(36, 100%, 55%)" stopOpacity="0.05" />
      </linearGradient>
    </defs>
    <path d="M4.5 16.5c-1.5 1.5-2.5 3.5-2.5 5.5C4 22 6 21 7.5 19.5" strokeWidth="2" />
    <path d="M12 12A15.9 15.9 0 0 0 3 15c0 0 .5-3 2.5-5a15.9 15.9 0 0 0 6.5-6.5C14 1.5 17 2 17 2s.5 3-1.5 5A15.9 15.9 0 0 0 9 13.5z" fill="url(#rocketGrad)" strokeWidth="2" />
    <path d="M12 2l2 2-2-2zM22 2l-6 6M20 4l-4 4" strokeWidth="2" />
  </svg>
);

const CampaignHistoryIcon = ({ className }: { className?: string }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" className={cn("w-5 h-5 shrink-0", className)} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <defs>
      <linearGradient id="histGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="hsl(24, 100%, 50%)" stopOpacity="0.25" />
        <stop offset="100%" stopColor="hsl(36, 100%, 55%)" stopOpacity="0.05" />
      </linearGradient>
    </defs>
    <rect x="3" y="3" width="18" height="18" rx="2" fill="url(#histGrad)" strokeWidth="2" />
    <path d="M7 8h10M7 12h10M7 16h6" strokeWidth="2" strokeLinecap="round" />
    <circle cx="17" cy="16" r="1" fill="currentColor" />
  </svg>
);

const SettingsIcon = ({ className }: { className?: string }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" className={cn("w-5 h-5 shrink-0", className)} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <defs>
      <linearGradient id="settingsGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="hsl(24, 100%, 50%)" stopOpacity="0.3" />
        <stop offset="100%" stopColor="hsl(36, 100%, 55%)" stopOpacity="0.05" />
      </linearGradient>
    </defs>
    <circle cx="12" cy="12" r="3" fill="url(#settingsGrad)" strokeWidth="2" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51-1z" strokeWidth="2" />
  </svg>
);

interface NavItem {
  title: string;
  path: string;
  icon: ComponentType<any>;
  adminOnly?: boolean;
  hideForAdmin?: boolean;
}

const primaryNavItems: readonly NavItem[] = [
  { title: "Dashboard", path: "/dashboard", icon: DashboardIcon, adminOnly: false },
  { title: "Contacts", path: "/leads", icon: ContactsIcon, adminOnly: false },
  { title: "Inbox", path: "/email", icon: InboxIcon, adminOnly: false },
  { title: "Import Contacts", path: "/create", icon: ImportContactsIcon, adminOnly: true },
];

const emailCampaignNavItems = [
  { title: "New Campaign", path: "/message", icon: NewCampaignIcon },
  { title: "Campaign History", path: "/message-campaigns", icon: CampaignHistoryIcon },
] as const;

function PaperPlanLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8 text-primary shrink-0 filter drop-shadow-[0_0_8px_rgba(255,102,0,0.35)]" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2.01 21L23 12L2.01 3L2 10L17 12L2 14L2.01 21Z" fill="currentColor" fillOpacity="0.12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}



type UpgradeDialogState = {
  open: boolean;
  feature: string;
  tierLabel: string;
  planKey: BillingPlan["planName"] | null;
  isAdminOnly: boolean;
};

const initialDialogState: UpgradeDialogState = {
  open: false,
  feature: "",
  tierLabel: "",
  planKey: null,
  isAdminOnly: false,
};

function getUpgradeDetails(path: string) {
  const isFeature = [
    "/create",
    "/leads",
    "/email",
    "/ai-logs",
    "/email-settings",
    "/message",
    "/message-campaigns",
    "/voice",
    "/voice-campaigns",
    "/company-profile"
  ].includes(path);

  if (isFeature) {
    return { tierLabel: "AI Lead Gen", planKey: "ai_lead_gen" as const, isAdminOnly: false };
  }
  if (path === "/subscription" || path === "/ai-settings" || path === "/users") {
    return { tierLabel: "Super Admin", planKey: null, isAdminOnly: true };
  }
  return { tierLabel: "", planKey: null, isAdminOnly: false };
}

export function DashboardSidebar() {
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  const [upgradeDialog, setUpgradeDialog] = useState<UpgradeDialogState>(initialDialogState);
  const [billingPlans, setBillingPlans] = useState<BillingPlan[]>([]);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  // Real unread email count (shown as badge)
  const [unreadEmailCount, setUnreadEmailCount] = useState(0);
  // Hot lead AI alert count (shown as a subtle dot indicator)
  const [hotLeadAlertCount, setHotLeadAlertCount] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { hasAccess, role, subscriptionPlan, loading } = useUserRole();
  const { user, signOut, isImpersonating, stopImpersonation, onboardingStatus, sentCount, refreshUsage } = useAuth();
  const isReviewing = onboardingStatus === "setup_in_progress";

  const isLocked = subscriptionPlan === "base" && sentCount >= 20;

  const isPathLocked = (path: string) => {
    if (!isLocked) return false;
    return path !== "/dashboard" && path !== "/email" && path !== "/settings";
  };

  const [requestUpgradeOpen, setRequestUpgradeOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState("AI Lead Gen Plan ($499/mo)");
  const [specialRequirements, setSpecialRequirements] = useState("");
  const [submittingRequest, setSubmittingRequest] = useState(false);

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

  const emailCampaignAccessible = (loading || hasAccess("/message")) && !isPathLocked("/message");
  const emailCampaignGroupActive = (location.pathname === "/message" || location.pathname === "/message-campaigns") && !isPathLocked("/message");
  // unified settings page route active state check directly on location path
  const settingsGroupActive = location.pathname.startsWith("/settings") && !isPathLocked("/settings");


  useEffect(() => {
    setUserName(user?.displayName ?? user?.email ?? null);
  }, [user]);

  useEffect(() => {
    // Fetch real unread email count from the inbox
    const fetchUnreadCount = async () => {
      try {
        const data = await api.get<{ items: Array<{ isRead: boolean; unreadCount?: number }> }>("/emails?folder=inbox");
        const count = (data.items || []).filter((item) => !item.isRead || (item.unreadCount ?? 0) > 0).length;
        setUnreadEmailCount(count);
      } catch {
        // fail silently
      }
    };

    // Separately track hot-lead AI alerts count (for the dot indicator only)
    const fetchHotLeadAlerts = async () => {
      try {
        const data = await api.get<{ items: any[] }>("/emails/ai-logs?limit=50");
        const count = (data.items || []).filter(
          (item) => item.action === "emails.human_review_requested"
        ).length;
        setHotLeadAlertCount(count);
      } catch {
        // fail silently
      }
    };

    void fetchUnreadCount();
    void fetchHotLeadAlerts();

    const interval = setInterval(() => {
      void fetchUnreadCount();
      void fetchHotLeadAlerts();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

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

  useEffect(() => {
    if (!isMobile) {
      setMobileOpen(false);
    }
  }, [isMobile]);

  useEffect(() => {
    if (isMobile) {
      setMobileOpen(false);
    }
  }, [isMobile, location.pathname]);

  const currentPlanLabel = useMemo(() => {
    if (role === "super_admin") return "Super Admin";
    if (subscriptionPlan === "ai_lead_gen") return "AI Lead Gen Plan";
    return "Base Plan";
  }, [role, subscriptionPlan]);

  const handleLockedClick = (item: { title: string; path: string }) => {
    if (isPathLocked(item.path)) {
      setSelectedPlan("AI Lead Gen Plan ($499/mo)");
      setSpecialRequirements("");
      setRequestUpgradeOpen(true);
      return;
    }
    const details = getUpgradeDetails(item.path);
    setUpgradeDialog({
      open: true,
      feature: item.title,
      tierLabel: details.tierLabel,
      planKey: details.planKey,
      isAdminOnly: details.isAdminOnly,
    });
  };

  const handleUpgrade = async () => {
    if (!upgradeDialog.planKey) {
      setUpgradeDialog((prev) => ({ ...prev, open: false }));
      return;
    }

    const selectedPlan = billingPlans.find((item) => item.planName === upgradeDialog.planKey);
    if (!selectedPlan?.priceId) {
      toast({
        title: "Square plan not configured",
        description: `Missing plan variation ID for ${upgradeDialog.tierLabel}. Add it in server/.env first.`,
        variant: "destructive",
      });
      return;
    }

    setUpgradeLoading(true);
    try {
      const url = await createCheckoutSession(selectedPlan.priceId);
      window.location.href = url;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to start checkout";
      toast({ title: "Checkout failed", description: message, variant: "destructive" });
      setUpgradeLoading(false);
    }
  };

  return (
    <>
      {isMobile ? (
        <>
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={() => setMobileOpen(true)}
            className="fixed left-4 top-4 z-50 h-11 w-11 rounded-xl bg-background/95 shadow-md backdrop-blur"
          >
            <Menu className="h-5 w-5" />
          </Button>
          {mobileOpen ? (
            <button
              type="button"
              aria-label="Close sidebar overlay"
              className="fixed inset-0 z-40 bg-black/45"
              onClick={() => setMobileOpen(false)}
            />
          ) : null}
        </>
      ) : null}

      <aside
        className={cn(
          "flex min-h-0 flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300 ease-in-out",
          isMobile
            ? cn(
                "fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] shadow-xl",
                mobileOpen ? "translate-x-0" : "-translate-x-full",
              )
            : collapsed
              ? "w-16"
              : "w-64",
        )}
      >
        <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-4 bg-background/20 backdrop-blur-md">
          <PaperPlanLogo />
          {(!collapsed || isMobile) && (
            <span className="text-lg font-extrabold tracking-tight bg-gradient-to-r from-primary to-orange-600 bg-clip-text text-transparent filter drop-shadow-[0_1px_2px_rgba(255,102,0,0.05)]">
              Paper Plan
            </span>
          )}
          {isMobile ? (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => setMobileOpen(false)}
              className="ml-auto"
            >
              <X className="h-5 w-5" />
            </Button>
          ) : null}
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          <TooltipProvider delayDuration={100}>
            {primaryNavItems.map((item) => {
              if (item.adminOnly && role !== "super_admin") return null;
              if (item.hideForAdmin && role === "super_admin") return null;

              const accessible = (loading || hasAccess(item.path)) && !isPathLocked(item.path);
              const isActive = item.path === "/integrations"
                ? location.pathname === item.path || location.pathname.startsWith("/integrations/")
                : location.pathname === item.path;

              if (accessible) {
                const linkEl = (
                  <RouterNavLink
                    key={item.path}
                    to={isReviewing ? "#" : item.path}
                    onClick={(e) => {
                      if (isReviewing) {
                        e.preventDefault();
                        return;
                      }
                      if (isMobile) {
                        setMobileOpen(false);
                      }
                    }}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-300 relative border border-transparent hover:scale-[1.02]",
                      isReviewing && "pointer-events-none opacity-50 cursor-not-allowed",
                      isActive && !isReviewing
                        ? "bg-gradient-to-r from-primary/10 to-primary/[0.02] text-primary border-primary/25 shadow-[inset_0_1px_1px_rgba(255,255,255,0.7),0_4px_12px_rgba(255,102,0,0.06)] rounded-xl font-bold"
                        : "text-sidebar-foreground hover:bg-primary/5 hover:text-primary",
                      collapsed && !isMobile && "justify-center"
                    )}
                  >
                    <item.icon className="h-5 w-5 shrink-0" />
                    {(!collapsed || isMobile) ? (
                      <span className="flex-1 flex justify-between items-center">
                        <span>{item.title}</span>
                        {/* Real unread email badge on Inbox */}
                        {item.title === "Inbox" && unreadEmailCount > 0 && (
                          <Badge variant="destructive" className="h-5 min-w-5 justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 border-none px-1 text-[10px]">
                            {unreadEmailCount}
                          </Badge>
                        )}
                      </span>
                    ) : (
                      item.title === "Inbox" && unreadEmailCount > 0 && (
                        <span className="absolute right-2 top-2 flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                        </span>
                      )
                    )}
                    {/* Subtle hot-lead dot indicator (separate from unread badge) */}
                    {item.title === "Inbox" && hotLeadAlertCount > 0 && unreadEmailCount === 0 && (!collapsed || isMobile) && (
                      <span className="flex h-2 w-2 ml-1">
                        <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-orange-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                      </span>
                    )}
                    {item.title === "Inbox" && hotLeadAlertCount > 0 && unreadEmailCount === 0 && collapsed && !isMobile && (
                      <span className="absolute right-2 top-2 flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                      </span>
                    )}
                  </RouterNavLink>
                );

                if (collapsed && !isMobile) {
                  return (
                    <Tooltip key={item.path}>
                      <TooltipTrigger asChild>{linkEl}</TooltipTrigger>
                      <TooltipContent side="right" className="z-[60]">{item.title}</TooltipContent>
                    </Tooltip>
                  );
                }
                return linkEl;
              }

              const buttonEl = (
                <button
                  key={item.path}
                  disabled={isReviewing}
                  onClick={() => {
                    if (isReviewing) return;
                    handleLockedClick(item);
                  }}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                    isReviewing && "pointer-events-none opacity-50 cursor-not-allowed",
                    "text-muted-foreground/50 hover:bg-muted/30 hover:text-muted-foreground",
                    collapsed && !isMobile && "justify-center"
                  )}
                >
                  <item.icon className="h-5 w-5 shrink-0 opacity-50" />
                  {(!collapsed || isMobile) && (
                    <>
                      <span className="flex-1 text-left">{item.title}</span>
                      <Lock className="h-3.5 w-3.5 opacity-50" />
                    </>
                  )}
                </button>
              );

              if (collapsed && !isMobile) {
                return (
                  <Tooltip key={item.path}>
                    <TooltipTrigger asChild>{buttonEl}</TooltipTrigger>
                    <TooltipContent side="right" className="z-[60]">{item.title} (Locked)</TooltipContent>
                  </Tooltip>
                );
              }
              return buttonEl;
            })}

            {emailCampaignAccessible ? (
              <Collapsible defaultOpen={emailCampaignGroupActive && !isReviewing} disabled={isReviewing} className="space-y-1">
                <CollapsibleTrigger asChild>
                  {collapsed && !isMobile ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          disabled={isReviewing}
                          onClick={() => setCollapsed(false)}
                          className="group flex w-full items-center justify-center rounded-lg p-2.5 text-sm font-medium transition-all duration-200 text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                        >
                          <CampaignGroupIcon className="h-5 w-5 shrink-0" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="z-[60]">Email Campaign</TooltipContent>
                    </Tooltip>
                  ) : (
                    <button
                      type="button"
                      disabled={isReviewing}
                      className={cn(
                        "group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-300 border border-transparent hover:scale-[1.02]",
                        isReviewing && "pointer-events-none opacity-50 cursor-not-allowed",
                        emailCampaignGroupActive && !isReviewing
                          ? "bg-gradient-to-r from-primary/10 to-primary/[0.02] text-primary border-primary/25 shadow-[inset_0_1px_1px_rgba(255,255,255,0.7),0_4px_12px_rgba(255,102,0,0.06)] rounded-xl font-bold"
                          : "text-sidebar-foreground hover:bg-primary/5 hover:text-primary",
                      )}
                    >
                      <CampaignGroupIcon className="h-5 w-5 shrink-0" />
                      <span className="flex-1 text-left">Email Campaign</span>
                      <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
                    </button>
                  )}
                </CollapsibleTrigger>

                {(!collapsed || isMobile) && (
                  <CollapsibleContent className="space-y-1">
                    {emailCampaignNavItems.map((item) => {
                      const isActive = location.pathname === item.path;
                      return (
                        <RouterNavLink
                          key={item.path}
                          to={isReviewing ? "#" : item.path}
                          onClick={(e) => {
                            if (isReviewing) {
                              e.preventDefault();
                              return;
                            }
                            if (isMobile) {
                              setMobileOpen(false);
                            }
                          }}
                          className={cn(
                            "ml-6 flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-300 border border-transparent hover:scale-[1.02]",
                            isReviewing && "pointer-events-none opacity-50 cursor-not-allowed",
                            isActive && !isReviewing
                              ? "bg-gradient-to-r from-primary/10 to-primary/[0.02] text-primary border-primary/25 shadow-[inset_0_1px_1px_rgba(255,255,255,0.7),0_4px_12px_rgba(255,102,0,0.06)] rounded-xl font-bold"
                              : "text-sidebar-foreground/80 hover:bg-primary/5 hover:text-primary",
                          )}
                        >
                          <item.icon className="h-4 w-4 shrink-0" />
                          <span>{item.title}</span>
                        </RouterNavLink>
                      );
                    })}
                  </CollapsibleContent>
                )}
              </Collapsible>
            ) : (
              collapsed && !isMobile ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => {
                        if (isReviewing) return;
                        handleLockedClick({ title: "Email Campaign", path: "/message" });
                      }}
                      disabled={isReviewing}
                      className="flex w-full items-center justify-center rounded-lg p-2.5 text-sm font-medium transition-all duration-200 text-muted-foreground/50 hover:bg-muted/30 hover:text-muted-foreground"
                    >
                      <CampaignGroupIcon className="h-5 w-5 shrink-0 opacity-50" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="z-[60]">Email Campaign (Locked)</TooltipContent>
                </Tooltip>
              ) : (
                <button
                  onClick={() => {
                    if (isReviewing) return;
                    handleLockedClick({ title: "Email Campaign", path: "/message" });
                  }}
                  disabled={isReviewing}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                    isReviewing && "pointer-events-none opacity-50 cursor-not-allowed",
                    "text-muted-foreground/50 hover:bg-muted/30 hover:text-muted-foreground",
                  )}
                >
                  <CampaignGroupIcon className="h-5 w-5 shrink-0 opacity-50" />
                  <span className="flex-1 text-left">Email Campaign</span>
                  <Lock className="h-3.5 w-3.5 opacity-50" />
                </button>
              )
            )}

            {/* Settings Tab Statically Rendered at the Bottom */}
            {(() => {
              const settingsItem = { title: "Settings", path: "/settings", icon: SettingsIcon };
              const accessible = (loading || hasAccess(settingsItem.path)) && !isPathLocked(settingsItem.path);
              const isActive = location.pathname.startsWith("/settings");

              if (accessible) {
                const linkEl = (
                  <RouterNavLink
                    to={isReviewing ? "#" : settingsItem.path}
                    onClick={(e) => {
                      if (isReviewing) {
                        e.preventDefault();
                        return;
                      }
                      if (isMobile) {
                        setMobileOpen(false);
                      }
                    }}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-300 relative border border-transparent hover:scale-[1.02]",
                      isReviewing && "pointer-events-none opacity-50 cursor-not-allowed",
                      isActive && !isReviewing
                        ? "bg-gradient-to-r from-primary/10 to-primary/[0.02] text-primary border-primary/25 shadow-[inset_0_1px_1px_rgba(255,255,255,0.7),0_4px_12px_rgba(255,102,0,0.06)] rounded-xl font-bold"
                        : "text-sidebar-foreground hover:bg-primary/5 hover:text-primary",
                      collapsed && !isMobile && "justify-center"
                    )}
                  >
                    <settingsItem.icon className="h-5 w-5 shrink-0" />
                    {(!collapsed || isMobile) && (
                      <span className="flex-1 flex justify-between items-center">
                        <span>{settingsItem.title}</span>
                      </span>
                    )}
                  </RouterNavLink>
                );

                if (collapsed && !isMobile) {
                  return (
                    <Tooltip key={settingsItem.path}>
                      <TooltipTrigger asChild>{linkEl}</TooltipTrigger>
                      <TooltipContent side="right" className="z-[60]">{settingsItem.title}</TooltipContent>
                    </Tooltip>
                  );
                }
                return linkEl;
              }

              const buttonEl = (
                <button
                  disabled={isReviewing}
                  onClick={() => {
                    if (isReviewing) return;
                    handleLockedClick(settingsItem);
                  }}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                    isReviewing && "pointer-events-none opacity-50 cursor-not-allowed",
                    "text-muted-foreground/50 hover:bg-muted/30 hover:text-muted-foreground",
                    collapsed && !isMobile && "justify-center"
                  )}
                >
                  <settingsItem.icon className="h-5 w-5 shrink-0 opacity-50" />
                  {(!collapsed || isMobile) && (
                    <>
                      <span className="flex-1 text-left">{settingsItem.title}</span>
                      <Lock className="h-3.5 w-3.5 opacity-50" />
                    </>
                  )}
                </button>
              );

              if (collapsed && !isMobile) {
                return (
                  <Tooltip key={settingsItem.path}>
                    <TooltipTrigger asChild>{buttonEl}</TooltipTrigger>
                    <TooltipContent side="right" className="z-[60]">{settingsItem.title} (Locked)</TooltipContent>
                  </Tooltip>
                );
              }
              return buttonEl;
            })()}

          </TooltipProvider>
        </nav>

        <div className="space-y-2 border-t border-sidebar-border p-3">
          {isImpersonating && user?.impersonatedBy ? (
            <div className={cn("rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100", collapsed && !isMobile && "hidden")}>
              <p className="font-medium">Impersonating {user.email}</p>
              <p className="mt-0.5 text-[11px] opacity-80">Signed in by {user.impersonatedBy.displayName}</p>
            </div>
          ) : null}

          {isImpersonating ? (
            <button
              onClick={async () => {
                await stopImpersonation();
                setMobileOpen(false);
                navigate("/users");
              }}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-amber-700 transition-colors hover:bg-amber-500/10 hover:text-amber-800",
                collapsed && !isMobile && "justify-center px-0",
              )}
            >
              <Undo2 className="h-4 w-4 shrink-0" />
              {(!collapsed || isMobile) && <span>Return to Admin</span>}
            </button>
          ) : null}

          {!isMobile ? (
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="flex w-full items-center justify-center rounded-lg p-2 text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          ) : null}
        </div>
      </aside>

      <Dialog
        open={upgradeDialog.open}
        onOpenChange={(open) => setUpgradeDialog((prev) => ({ ...prev, open }))}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <ArrowUpCircle className="h-6 w-6 text-primary" />
            </div>
            <DialogTitle>{upgradeDialog.isAdminOnly ? "Admin Access Required" : "Upgrade Required"}</DialogTitle>
            <DialogDescription>
              {upgradeDialog.isAdminOnly ? (
                <>
                  The <span className="font-semibold text-foreground">{upgradeDialog.feature}</span> feature is reserved for{" "}
                  <span className="font-semibold text-foreground">Super Admin</span> users.
                  Please contact your administrator if you need access.
                </>
              ) : (
                <>
                  The <span className="font-semibold text-foreground">{upgradeDialog.feature}</span> feature requires{" "}
                  <span className="font-semibold text-foreground">{upgradeDialog.tierLabel}</span>.
                  Upgrade your subscription to unlock it now.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setUpgradeDialog((prev) => ({ ...prev, open: false }))}
            >
              Close
            </Button>
            {!upgradeDialog.isAdminOnly && upgradeDialog.planKey && (
              <Button onClick={() => void handleUpgrade()} disabled={upgradeLoading}>
                {upgradeLoading ? "Redirecting..." : `Upgrade to ${upgradeDialog.tierLabel}`}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

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
              Your free tier limit of 20 emails is completed. Request an upgrade to restore full access.
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
    </>
  );
}
