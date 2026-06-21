import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, hasAccess, loading, onboardingStatus, subscriptionPlan, sentCount } = useAuth();

  const isLocked = subscriptionPlan === "base" && sentCount >= 20;

  const isPathAllowed = (path: string) => {
    if (path === "/onboarding") return true;
    if (isLocked) {
      return path === "/dashboard" || path === "/email" || path.startsWith("/settings");
    }
    return hasAccess(path);
  };

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      const redirect = `${location.pathname}${location.search}${location.hash}`;
      navigate(`/auth?redirect=${encodeURIComponent(redirect)}`, { replace: true });
    }
  }, [loading, location.hash, location.pathname, location.search, navigate, user]);

  // Onboarding + access gate for all logged-in users
  useEffect(() => {
    if (!loading && user) {
      if (onboardingStatus === "loading") return;

      if (
        onboardingStatus === "pending" &&
        location.pathname !== "/onboarding"
      ) {
        navigate("/onboarding", { replace: true });
      } else if (
        (onboardingStatus === "completed" || onboardingStatus === "setup_in_progress") &&
        location.pathname === "/onboarding"
      ) {
        navigate("/dashboard", { replace: true });
      } else if (!isPathAllowed(location.pathname)) {
        navigate("/dashboard", { replace: true });
      }
    }
  }, [loading, user, onboardingStatus, location.pathname, navigate, isLocked]);

  if (loading || (user && onboardingStatus === "loading")) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking your session...
        </div>
      </div>
    );
  }

  if (!user) return null;

  if (
    onboardingStatus === "pending" &&
    location.pathname !== "/onboarding"
  ) {
    return null;
  }

  if (
    (onboardingStatus === "completed" || onboardingStatus === "setup_in_progress") &&
    location.pathname === "/onboarding"
  ) {
    return null;
  }

  if (!isPathAllowed(location.pathname)) return null;

  return <>{children}</>;
}

