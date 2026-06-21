import { useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, Send, Bot, CreditCard, Users, Lock } from "lucide-react";
import AiBrandProfilePage from "./AiBrandProfilePage";
import EmailSettingsPage from "./EmailSettingsPage";
import AiSettingsPage from "./AiSettingsPage";
import SubscriptionPage from "./SubscriptionPage";
import UsersPage from "./UsersPage";

export default function SettingsPage() {
  const { role } = useUserRole();
  const { subscriptionPlan } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "profile";

  const handleTabChange = (val: string) => {
    setSearchParams({ tab: val });
  };

  const isAdmin = role === "super_admin";

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your account settings, company profiles, mailboxes, and configurations.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="flex flex-wrap h-auto w-full justify-start gap-1 bg-muted/40 p-1 border border-border rounded-xl">
            <TabsTrigger value="profile" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-all">
              <Sparkles className="h-4 w-4" />
              Company Profile
            </TabsTrigger>
            <TabsTrigger value="email" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-all">
              <Send className="h-4 w-4" />
              Email Accounts
            </TabsTrigger>
            <TabsTrigger value="ai" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-all">
              <Bot className="h-4 w-4" />
              AI Configuration
              {subscriptionPlan === "base" && <Lock className="h-3.5 w-3.5 text-orange-500" />}
            </TabsTrigger>
            {isAdmin && (
              <>
                <TabsTrigger value="subscription" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-all">
                  <CreditCard className="h-4 w-4" />
                  Subscription
                </TabsTrigger>
                <TabsTrigger value="users" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-all">
                  <Users className="h-4 w-4" />
                  Users
                </TabsTrigger>
              </>
            )}
          </TabsList>

          <TabsContent value="profile" className="pt-4">
            <AiBrandProfilePage isEmbedded />
          </TabsContent>
          
          <TabsContent value="email" className="pt-4">
            <EmailSettingsPage isEmbedded />
          </TabsContent>

          <TabsContent value="ai" className="pt-4">
            {subscriptionPlan === "base" ? (
              <div className="glass-panel border-orange-500/20 bg-orange-500/[0.02] p-8 text-center rounded-2xl relative overflow-hidden">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-100 border border-orange-200 mb-4">
                  <Bot className="h-6 w-6 text-orange-600 animate-pulse" />
                </div>
                <h3 className="text-lg font-bold text-foreground">AI Configuration Locked</h3>
                <p className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto">
                  Custom AI provider keys and model configurations are reserved for premium plans. Upgrade to unlock full custom AI support.
                </p>
                <div className="mt-6 flex justify-center">
                  <Button onClick={() => {
                    toast({
                      title: "Upgrade Request",
                      description: "Please click any locked item in the sidebar (like Contacts or Campaigns) to open the Upgrade Request form.",
                      variant: "default"
                    });
                  }} className="bg-orange-500 hover:bg-orange-600 text-white font-bold">
                    Upgrade to Premium
                  </Button>
                </div>
              </div>
            ) : (
              <AiSettingsPage isEmbedded />
            )}
          </TabsContent>

          {isAdmin && (
            <>
              <TabsContent value="subscription" className="pt-4">
                <SubscriptionPage isEmbedded />
              </TabsContent>
              <TabsContent value="users" className="pt-4">
                <UsersPage isEmbedded />
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
