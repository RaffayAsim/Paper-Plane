import { useAuth } from "@/contexts/AuthContext";

export function useUserRole() {
  const { role, subscriptionPlan, loading, hasAccess } = useAuth();
  return {
    role,
    subscriptionPlan,
    loading,
    hasAccess,
    isSuperAdmin: role === "super_admin",
  };
}
