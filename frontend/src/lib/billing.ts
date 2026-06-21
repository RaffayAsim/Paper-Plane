import { api } from "@/lib/api";

export type SubscriptionPlan = "base" | "ai_lead_gen";

export type BillingPlan = {
  planName: SubscriptionPlan;
  displayName: string;
  price: number;
  interval: string;
  priceId: string | null;
  features: string[];
};

export async function getBillingPlans() {
  const data = await api.get<{ items: BillingPlan[] }>("/billing/plans");
  return data.items;
}

export async function createCheckoutSession(priceId: string, sourceId?: string) {
  const data = await api.post<{ url: string }>("/billing/checkout-session", { priceId, sourceId });
  return data.url;
}

export async function createPortalSession() {
  const data = await api.post<{ url: string }>("/billing/portal-session");
  return data.url;
}

export function redirectToExternal(url: string) {
  window.location.href = url;
}
