import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DashboardLayout } from "@/components/DashboardLayout";
import { StatCard } from "@/components/StatCard";
import { api } from "@/lib/api";
import { CreditCard, DollarSign, Layers3, Save, Search, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type SubscriptionEntry = {
  id: string;
  userId: string;
  user: {
    id: string;
    email: string;
    displayName: string;
    isActive: boolean;
  };
  status: string;
  planName: "ai_lead_gen";
  stripePriceId: string | null;
  stripeSubscriptionId: string | null;
  amount: number;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  createdAt: string;
  updatedAt: string;
};

type SubscriptionSummary = {
  totalSubscriptions: number;
  activeSubscriptions: number;
  monthlyRevenue: number;
  currency: string;
  byPlan: {
    base: number;
    ai_lead_gen: number;
  };
};

type CreditUser = {
  userId: string;
  email: string;
  displayName: string;
  subscriptionPlan: "base" | "ai_lead_gen";
  isSuperAdmin: boolean;
  used: number;
  limit: number | null;
  remaining: number | null;
  overrideLimit: number | null;
};

type CreditResponse = {
  leadCredits: {
    planLimits: {
      ai_lead_gen: number;
    };
    users: CreditUser[];
  };
};

const PLAN_LABELS: Record<string, string> = {
  ai_lead_gen: "AI Lead Gen",
};

function formatMoney(amountInMinorUnits: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amountInMinorUnits / 100);
}

export default function SubscriptionPage({ isEmbedded }: { isEmbedded?: boolean }) {
  const { toast } = useToast();
  const [items, setItems] = useState<SubscriptionEntry[]>([]);
  const [summary, setSummary] = useState<SubscriptionSummary | null>(null);
  const [creditUsers, setCreditUsers] = useState<CreditUser[]>([]);
  const [search, setSearch] = useState("");
  const [planLimits, setPlanLimits] = useState({
    ai_lead_gen: 30000,
  });
  const [overrideDrafts, setOverrideDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingLimits, setSavingLimits] = useState(false);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [subscriptionData, creditData] = await Promise.all([
        api.get<{ summary: SubscriptionSummary; items: SubscriptionEntry[] }>("/admin/subscriptions"),
        api.get<CreditResponse>("/admin/credits"),
      ]);

      setSummary(subscriptionData.summary);
      setItems(subscriptionData.items);
      setCreditUsers(creditData.leadCredits.users);
      setPlanLimits(creditData.leadCredits.planLimits);
      setOverrideDrafts(
        Object.fromEntries(
          creditData.leadCredits.users.map((user) => [user.userId, user.overrideLimit?.toString() ?? ""]),
        ),
      );
    } catch (err) {
      console.error("Error loading subscription data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const activeSubscribers = useMemo(
    () => items.filter((item) => item.status === "active" || item.status === "trialing"),
    [items],
  );

  const filteredCreditUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return creditUsers;

    return creditUsers.filter((user) =>
      user.displayName.toLowerCase().includes(term) ||
      user.email.toLowerCase().includes(term) ||
      user.subscriptionPlan.toLowerCase().includes(term),
    );
  }, [creditUsers, search]);

  const savePlanLimits = async () => {
    setSavingLimits(true);
    try {
      await api.put("/admin/credits/lead-limits", planLimits);
      toast({ title: "Lead credit limits updated" });
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save lead limits";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setSavingLimits(false);
    }
  };

  const saveOverride = async (userId: string) => {
    setSavingUserId(userId);
    try {
      const raw = overrideDrafts[userId]?.trim() ?? "";
      await api.put(`/admin/credits/users/${userId}`, {
        limit: raw === "" ? null : Number(raw),
      });
      toast({ title: "User credit override updated" });
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update override";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setSavingUserId(null);
    }
  };

  const content = (
    <div className="space-y-6">
      {!isEmbedded && (
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Subscription</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            View subscribers, estimated recurring earnings, and control lead credits by tier or per user.
          </p>
        </div>
      )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Subscriptions"
            value={loading ? "-" : String(summary?.totalSubscriptions ?? 0)}
            icon={Layers3}
          />
          <StatCard
            title="Active Subscribers"
            value={loading ? "-" : String(summary?.activeSubscriptions ?? 0)}
            icon={Users}
          />
          <StatCard
            title="Estimated MRR"
            value={loading ? "-" : formatMoney(summary?.monthlyRevenue ?? 0, summary?.currency ?? "usd")}
            icon={DollarSign}
          />
          <StatCard
            title="AI Lead Gen Plan"
            value={loading ? "-" : String(summary?.byPlan.ai_lead_gen ?? 0)}
            icon={CreditCard}
            subtitle="Active AI Lead Gen users"
          />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-border bg-card p-6"
        >
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-foreground">Lead Credit Limits</h2>
              <p className="text-sm text-muted-foreground">These limits control how many leads each paid tier can request over time.</p>
            </div>
            <Button onClick={() => void savePlanLimits()} disabled={savingLimits}>
              <Save className="mr-2 h-4 w-4" />
              {savingLimits ? "Saving..." : "Save Limits"}
            </Button>
          </div>
          <div className="grid gap-4 md:grid-cols-1">
            <div className="space-y-2 max-w-sm">
              <Label htmlFor="aiLeadGen">AI Outreach Max Leads</Label>
              <Input id="aiLeadGen" type="number" value={planLimits.ai_lead_gen} onChange={(e) => setPlanLimits((prev) => ({ ...prev, ai_lead_gen: Number(e.target.value) }))} />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-border bg-card p-6"
        >
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-foreground">Lead Credits By User</h2>
              <p className="text-sm text-muted-foreground">Track used credits and set per-user overrides when needed.</p>
            </div>
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search users..."
                className="pl-10"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-3 py-3 text-left font-medium text-muted-foreground">User</th>
                  <th className="px-3 py-3 text-left font-medium text-muted-foreground">Plan</th>
                  <th className="px-3 py-3 text-left font-medium text-muted-foreground">Used</th>
                  <th className="px-3 py-3 text-left font-medium text-muted-foreground">Limit</th>
                  <th className="px-3 py-3 text-left font-medium text-muted-foreground">Remaining</th>
                  <th className="px-3 py-3 text-left font-medium text-muted-foreground">Override</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-10 text-center text-muted-foreground">Loading credit usage...</td>
                  </tr>
                ) : filteredCreditUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-10 text-center text-muted-foreground">No users found.</td>
                  </tr>
                ) : (
                  filteredCreditUsers.map((user) => (
                    <tr key={user.userId} className="border-b border-border/60">
                      <td className="px-3 py-3">
                        <div>
                          <div className="font-medium text-foreground">{user.displayName}</div>
                          <div className="text-xs text-muted-foreground">{user.email}</div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <Badge variant={user.isSuperAdmin ? "default" : "secondary"}>
                          {user.isSuperAdmin ? "Super Admin" : user.subscriptionPlan === "base" ? "Base" : PLAN_LABELS[user.subscriptionPlan]}
                        </Badge>
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">{user.used.toLocaleString()}</td>
                      <td className="px-3 py-3 text-muted-foreground">{user.limit === null ? "Unlimited" : user.limit.toLocaleString()}</td>
                      <td className="px-3 py-3 text-muted-foreground">{user.remaining === null ? "Unlimited" : user.remaining.toLocaleString()}</td>
                      <td className="px-3 py-3">
                        {!user.isSuperAdmin ? (
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              value={overrideDrafts[user.userId] ?? ""}
                              onChange={(e) => setOverrideDrafts((prev) => ({ ...prev, [user.userId]: e.target.value }))}
                              placeholder="Use tier default"
                              className="w-40"
                            />
                            <Button size="sm" variant="outline" onClick={() => void saveOverride(user.userId)} disabled={savingUserId === user.userId}>
                              {savingUserId === user.userId ? "Saving..." : "Save"}
                            </Button>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Not required</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-border bg-card p-6"
        >
          <h2 className="mb-4 text-base font-semibold text-foreground">Subscribed Users</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-3 py-3 text-left font-medium text-muted-foreground">User</th>
                  <th className="px-3 py-3 text-left font-medium text-muted-foreground">Plan</th>
                  <th className="px-3 py-3 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-3 py-3 text-left font-medium text-muted-foreground">Amount</th>
                  <th className="px-3 py-3 text-left font-medium text-muted-foreground">Period End</th>
                  <th className="px-3 py-3 text-left font-medium text-muted-foreground">Cancel At End</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-10 text-center text-muted-foreground">
                      Loading subscriptions...
                    </td>
                  </tr>
                ) : activeSubscribers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-10 text-center text-muted-foreground">
                      No subscribed users found yet.
                    </td>
                  </tr>
                ) : (
                  activeSubscribers.map((item) => (
                    <tr key={item.id} className="border-b border-border/60">
                      <td className="px-3 py-3">
                        <div>
                          <div className="font-medium text-foreground">{item.user.displayName}</div>
                          <div className="text-xs text-muted-foreground">{item.user.email}</div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <Badge variant="secondary">{PLAN_LABELS[item.planName] ?? item.planName}</Badge>
                      </td>
                      <td className="px-3 py-3">
                        <Badge variant={item.status === "active" ? "default" : "outline"}>{item.status}</Badge>
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">
                        {formatMoney(item.amount, summary?.currency ?? "usd")}
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">
                        {item.currentPeriodEnd ? new Date(item.currentPeriodEnd).toLocaleDateString() : "-"}
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">
                        {item.cancelAtPeriodEnd ? "Yes" : "No"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
  );

  if (isEmbedded) return content;
  return <DashboardLayout>{content}</DashboardLayout>;
}
