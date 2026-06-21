import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, authStorage, login as apiLogin, logout as apiLogout, register as apiRegister, type SessionUser, setSessionExpiredHandler } from "@/lib/api";

export type AdminRole = "super_admin";
export type SubscriptionPlan = "base" | "ai_lead_gen";

const ADMIN_PERMISSIONS: Record<AdminRole, string[]> = {
  super_admin: ["/dashboard", "/notifications", "/create", "/leads", "/email", "/ai-logs", "/my-email-settings", "/integrations", "/message", "/message-campaigns", "/company-profile", "/onboarding", "/subscription", "/email-settings", "/ai-settings", "/settings", "/users", "/webhooks"],
};

const PLAN_PERMISSIONS: Record<SubscriptionPlan, string[]> = {
  base: ["/dashboard", "/notifications", "/create", "/leads", "/email", "/ai-logs", "/my-email-settings", "/integrations", "/message", "/message-campaigns", "/company-profile", "/onboarding", "/checkout", "/settings"],
  ai_lead_gen: ["/dashboard", "/notifications", "/create", "/leads", "/email", "/ai-logs", "/my-email-settings", "/integrations", "/message", "/message-campaigns", "/company-profile", "/onboarding", "/checkout", "/settings"],
};

interface AuthContextType {
  user: SessionUser | null;
  role: AdminRole | null;
  subscriptionPlan: SubscriptionPlan | null;
  loading: boolean;
  isImpersonating: boolean;
  hasAccess: (path: string) => boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: { email: string; password: string; displayName: string; phoneNumber: string }) => Promise<void>;
  signOut: () => Promise<void>;
  startImpersonation: (session: { accessToken: string; refreshToken: string; user: SessionUser }) => void;
  stopImpersonation: () => Promise<void>;
  refreshUser: () => Promise<void>;
  onboardingStatus: 'loading' | 'completed' | 'pending' | 'setup_in_progress';
  onboardedAt: string | null;
  refreshOnboarding: () => Promise<void>;
  sentCount: number;
  refreshUsage: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const IMPERSONATION_STORAGE_KEY = "leadgen_admin_original_session";

function primaryRole(user: SessionUser | null): AdminRole | null {
  const roles = (user?.roles || []) as AdminRole[];
  if (roles.includes("super_admin")) return "super_admin";
  return null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(authStorage.get()?.user ?? null);
  const [loading, setLoading] = useState(true);
  const [isImpersonating, setIsImpersonating] = useState(Boolean(authStorage.get()?.user?.impersonatedBy));
  const [onboardingStatus, setOnboardingStatus] = useState<'loading' | 'completed' | 'pending' | 'setup_in_progress'>('loading');
  const [onboardedAt, setOnboardedAt] = useState<string | null>(null);
  const [sentCount, setSentCount] = useState<number>(0);

  const refreshUsage = async () => {
    try {
      const data = await api.get<{ sentCount: number }>("/billing/usage");
      setSentCount(data.sentCount);
    } catch (err) {
      console.error("Failed to refresh usage:", err);
    }
  };

  useEffect(() => {
    if (user) {
      void refreshUsage();
    }
  }, [user]);

  const checkOnboarding = async (currentUser: SessionUser | null) => {
    if (!currentUser) {
      setOnboardingStatus('completed');
      return;
    }

    const roles = (currentUser.roles || []) as string[];
    if (roles.includes("super_admin")) {
      setOnboardingStatus('completed');
      return;
    }

    const plan = currentUser.subscriptionPlan;
    if (plan !== 'ai_lead_gen' && plan !== 'base') {
      setOnboardingStatus('completed');
      return;
    }

    try {
      const data = await api.get<{ item: { brandName?: string; onboardedAt?: string; setupStatus?: string } | null }>("/settings/ai-brand-profile");
      if (data.item && data.item.brandName) {
        setOnboardingStatus('completed');
      } else {
        setOnboardingStatus('pending');
      }
    } catch {
      setOnboardingStatus('completed');
    }
  };

  useEffect(() => {
    if (!loading) {
      void checkOnboarding(user);
    }
  }, [user, loading]);

  const refreshUser = async () => {
    const session = authStorage.get();
    if (!session?.accessToken) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const response = await api.get<{ user: SessionUser }>("/auth/me");
      const nextSession = authStorage.get();
      if (nextSession) {
        authStorage.set({ ...nextSession, user: response.user });
      }
      setUser(response.user);
      setIsImpersonating(Boolean(response.user?.impersonatedBy));
    } catch {
      authStorage.clear();
      setUser(null);
      setIsImpersonating(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSessionExpiredHandler(() => {
      setUser(null);
      setIsImpersonating(false);
    });
    void refreshUser();
  }, []);

  const value = useMemo<AuthContextType>(() => {
    const role = primaryRole(user);
    const subscriptionPlan = user?.subscriptionPlan ?? null;
    return {
      user,
      role,
      subscriptionPlan,
      loading,
      isImpersonating,
      onboardingStatus,
      onboardedAt,
      sentCount,
      refreshUsage,
      refreshOnboarding: async () => {
        await checkOnboarding(user);
      },
      hasAccess: (path: string) => {
        if (role && ADMIN_PERMISSIONS[role]?.includes(path)) return true;
        if (!subscriptionPlan) return false;
        return PLAN_PERMISSIONS[subscriptionPlan]?.includes(path) ?? false;
      },
      signIn: async (email: string, password: string) => {
        const session = await apiLogin(email, password);
        setUser(session.user);
        setIsImpersonating(Boolean(session.user.impersonatedBy));
      },
      signUp: async (input) => {
        const session = await apiRegister(input);
        setUser(session.user);
        setIsImpersonating(Boolean(session.user.impersonatedBy));
      },
      signOut: async () => {
        await apiLogout();
        localStorage.removeItem(IMPERSONATION_STORAGE_KEY);
        setUser(null);
        setIsImpersonating(false);
      },
      startImpersonation: (session) => {
        const current = authStorage.get();
        if (current) {
          localStorage.setItem(IMPERSONATION_STORAGE_KEY, JSON.stringify(current));
        }
        authStorage.set(session);
        setUser(session.user);
        setIsImpersonating(Boolean(session.user.impersonatedBy));
      },
      stopImpersonation: async () => {
        const raw = localStorage.getItem(IMPERSONATION_STORAGE_KEY);
        if (!raw) return;

        const original = JSON.parse(raw) as { accessToken: string; refreshToken: string; user: SessionUser };
        authStorage.set(original);
        localStorage.removeItem(IMPERSONATION_STORAGE_KEY);
        setUser(original.user);
        setIsImpersonating(false);
        await refreshUser();
      },
      refreshUser,
    };
  }, [isImpersonating, loading, user, onboardingStatus, onboardedAt, sentCount]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
