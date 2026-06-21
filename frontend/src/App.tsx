import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import LandingPage from "./pages/LandingPage";
import AuthPage from "./pages/AuthPage";
import OverviewPage from "./pages/OverviewPage";
import CreateLeadsPage from "./pages/CreateLeadsPage";
import LeadsTablePage from "./pages/LeadsTablePage";
import EmailPage from "./pages/EmailPage";
import AiLogsPage from "./pages/AiLogsPage";
import SettingsPage from "./pages/SettingsPage";
import EmailSettingsPage from "./pages/EmailSettingsPage";
import AiSettingsPage from "./pages/AiSettingsPage";
import MessagePage from "./pages/MessagePage";
import MessageCampaignsPage from "./pages/MessageCampaignsPage";
import AiBrandProfilePage from "./pages/AiBrandProfilePage";
import OnboardingPage from "./pages/OnboardingPage";
import SubscriptionPage from "./pages/SubscriptionPage";
import CheckoutPage from "./pages/CheckoutPage";
import UsersPage from "./pages/UsersPage";
import NotificationsPage from "./pages/NotificationsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const P = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>{children}</ProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <SettingsProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/dashboard" element={<P><OverviewPage /></P>} />
              <Route path="/notifications" element={<P><NotificationsPage /></P>} />
              <Route path="/create" element={<P><CreateLeadsPage /></P>} />
              <Route path="/leads" element={<P><LeadsTablePage /></P>} />
              <Route path="/email" element={<P><EmailPage /></P>} />
              <Route path="/ai-logs" element={<P><AiLogsPage /></P>} />
              <Route path="/settings" element={<P><SettingsPage /></P>} />
              <Route path="/email-settings" element={<Navigate to="/settings?tab=email" replace />} />
              <Route path="/ai-settings" element={<Navigate to="/settings?tab=ai" replace />} />
              <Route path="/company-profile" element={<Navigate to="/settings?tab=profile" replace />} />
              <Route path="/subscription" element={<Navigate to="/settings?tab=subscription" replace />} />
              <Route path="/users" element={<Navigate to="/settings?tab=users" replace />} />
              <Route path="/message" element={<P><MessagePage /></P>} />
              <Route path="/message-campaigns" element={<P><MessageCampaignsPage /></P>} />
              <Route path="/onboarding" element={<P><OnboardingPage /></P>} />
              <Route path="/checkout" element={<P><CheckoutPage /></P>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </SettingsProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
