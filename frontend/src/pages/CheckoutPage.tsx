import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  CreditCard,
  Check,
  Loader2,
  Shield,
  Zap,
  Mail,
  Phone,
  Users,
  Lock,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { createCheckoutSession, getBillingPlans, type BillingPlan } from "@/lib/billing";
import { api } from "@/lib/api";

interface SquareCard {
  attach: (selector: string) => Promise<void>;
  tokenize: () => Promise<{ status: string; token?: string; errors?: { message: string }[] }>;
  destroy: () => Promise<void>;
}

interface SquarePayments {
  card: () => Promise<SquareCard>;
}

declare global {
  interface Window {
    Square?: {
      payments: (appId: string, locationId: string) => Promise<SquarePayments>;
    };
  }
}

const PLAN_FEATURES = [
  { icon: Users, label: "30,000 Lead Credits/month" },
  { icon: Mail, label: "30,000 AI Emailings/month" },
  { icon: Phone, label: "3,000 AI Calls/month" },
  { icon: Zap, label: "AI-driven follow-up automation" },
  { icon: Shield, label: "Unified B2B pipeline management" },
];

export default function CheckoutPage() {
  const { user, refreshUser, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const cardContainerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<SquareCard | null>(null);
  const paymentsRef = useRef<SquarePayments | null>(null);

  const [plan, setPlan] = useState<BillingPlan | null>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [sdkError, setSdkError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [squareConfig, setSquareConfig] = useState<{ appId: string; locationId: string } | null>(null);

  // Fetch billing plan + Square config
  useEffect(() => {
    const init = async () => {
      try {
        const [plans, configRes] = await Promise.all([
          getBillingPlans(),
          api.get<{ appId: string; locationId: string }>("/billing/square-config"),
        ]);
        const aiPlan = plans.find((p) => p.planName === "ai_lead_gen") ?? null;
        setPlan(aiPlan);
        setSquareConfig(configRes);
      } catch (err) {
        console.error("Failed to load checkout config", err);
        setSdkError("Failed to load payment configuration. Please refresh and try again.");
      }
    };
    void init();
  }, []);

  // Init Square Web Payments SDK card form
  useEffect(() => {
    if (!squareConfig || !cardContainerRef.current) return;

    let destroyed = false;

    const initSquare = async () => {
      try {
        if (!window.Square) {
          setSdkError("Square payment SDK not loaded. Please refresh the page.");
          return;
        }

        const payments = await window.Square.payments(squareConfig.appId, squareConfig.locationId);
        paymentsRef.current = payments;

        const card = await payments.card();
        if (destroyed) {
          await card.destroy();
          return;
        }

        await card.attach("#card-container");
        cardRef.current = card;
        setSdkReady(true);
      } catch (err) {
        if (!destroyed) {
          console.error("Square SDK init error:", err);
          setSdkError("Failed to initialize payment form. Please refresh and try again.");
        }
      }
    };

    void initSquare();

    return () => {
      destroyed = true;
      if (cardRef.current) {
        void cardRef.current.destroy();
        cardRef.current = null;
      }
    };
  }, [squareConfig]);

  const handlePay = async () => {
    if ((!isMockMode && !cardRef.current) || !plan) return;
    setProcessing(true);

    try {
      let sourceId: string | undefined;

      // If using a real Square plan variation ID, tokenize the card
      if (plan.priceId && !plan.priceId.startsWith("mock_price_")) {
        const result = await cardRef.current.tokenize();
        if (result.status !== "OK" || !result.token) {
          const msg = result.errors?.[0]?.message ?? "Card tokenization failed";
          toast({ title: "Payment error", description: msg, variant: "destructive" });
          return;
        }
        sourceId = result.token;
      }

      const redirectUrl = await createCheckoutSession(plan.priceId ?? "mock_price_ai_lead_gen", sourceId);
      await refreshUser();
      window.location.href = redirectUrl;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Payment failed. Please try again.";
      toast({ title: "Payment failed", description: message, variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const isMockMode = !plan?.priceId || plan.priceId.startsWith("mock_price_");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0B0F19] text-white p-6 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Sign Out */}
      <div className="absolute top-6 right-6 z-20">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void handleSignOut()}
          className="text-slate-400 hover:text-white gap-2"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>

      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-8 relative z-10">
        {/* Left: Plan details */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col gap-6"
        >
          {/* Header */}
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-primary">
              <Zap className="h-3 w-3" />
              One Plan · Everything Included
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
              AI Lead Gen
            </h1>
            <p className="text-slate-400 text-sm leading-relaxed">
              Full access to automated B2B lead discovery, personalized AI outreach, and campaign management — all in one platform.
            </p>
          </div>

          {/* Price */}
          <div className="flex items-end gap-2">
            <span className="text-5xl font-black text-white">$499</span>
            <span className="text-slate-400 font-semibold mb-1">/month</span>
          </div>

          {/* Features */}
          <div className="space-y-3">
            {PLAN_FEATURES.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 border border-emerald-500/30">
                  <Icon className="h-4 w-4 text-emerald-400" />
                </div>
                <span className="text-sm font-medium text-slate-200">{label}</span>
              </div>
            ))}
          </div>

          {/* Trust badges */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Lock className="h-3.5 w-3.5 text-slate-500" />
              Secured by Square
            </div>
            <div className="h-4 w-px bg-slate-700" />
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Shield className="h-3.5 w-3.5 text-slate-500" />
              Cancel anytime
            </div>
          </div>

          {user && (
            <p className="text-xs text-slate-500 mt-2">
              Signing up as <span className="text-slate-300">{user.email}</span>
            </p>
          )}
        </motion.div>

        {/* Right: Payment form */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="bg-[#131B2E] border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6"
        >
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              {isMockMode ? "Activate Subscription (Test Mode)" : "Complete Payment"}
            </h2>
            <p className="text-xs text-slate-400">
              {isMockMode
                ? "Sandbox mode — no real charge will be made."
                : "Your card details are encrypted and never stored on our servers."}
            </p>
          </div>

          {/* Square card container */}
          {!isMockMode && (
            <div className="space-y-3">
              <div
                id="card-container"
                ref={cardContainerRef}
                className="rounded-xl border border-border bg-background p-3 min-h-[100px] transition-all"
              />
              {sdkError && (
                <p className="text-xs text-rose-500">{sdkError}</p>
              )}
              {!sdkReady && !sdkError && (
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Loading payment form…
                </div>
              )}
            </div>
          )}

          {isMockMode && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 space-y-1">
              <p className="text-xs font-semibold text-amber-400">🔧 Sandbox / Test Mode</p>
              <p className="text-xs text-slate-400">
                Square credentials are not yet configured. Clicking the button below will instantly activate your account for testing.
              </p>
            </div>
          )}

          <p className="text-[11px] text-slate-400 leading-normal">
            * Subscription Terms: Your card will be automatically charged $499.00 USD monthly until you cancel. You can cancel your subscription at any time.
          </p>

          {/* Summary row */}
          <div className="flex items-center justify-between border-t border-slate-800 pt-4">
            <span className="text-sm font-medium text-slate-300">AI Lead Gen · Monthly</span>
            <span className="text-lg font-bold text-white">$499.00</span>
          </div>

          <Button
            id="checkout-pay-btn"
            onClick={() => void handlePay()}
            disabled={processing || (!isMockMode && (!sdkReady || !!sdkError))}
            className="w-full h-12 text-base font-bold shadow-lg gap-2"
          >
            {processing ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Processing…
              </>
            ) : (
              <>
                <Check className="h-5 w-5" />
                {isMockMode ? "Activate Now (Test)" : "Pay $499 / month"}
              </>
            )}
          </Button>

          <p className="text-center text-[11px] text-slate-500">
            By subscribing you agree to our Terms of Service and Privacy Policy. You may cancel at any time.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
