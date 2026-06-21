import { useEffect, useState } from "react";
import { ArrowLeft, Eye, EyeOff, Zap, CheckCircle2, Sparkles, Send, Database } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function AuthPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isLogin, setIsLogin] = useState(searchParams.get("tab") !== "signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { signIn, signUp, user, loading: authLoading } = useAuth();
  const redirectTo = searchParams.get("redirect") || "/dashboard";

  useEffect(() => {
    setIsLogin(searchParams.get("tab") !== "signup");
  }, [searchParams]);

  useEffect(() => {
    if (!authLoading && user) {
      navigate(redirectTo, { replace: true });
    }
  }, [authLoading, navigate, redirectTo, user]);

  const switchMode = (nextIsLogin: boolean) => {
    const nextParams = new URLSearchParams(searchParams);
    if (nextIsLogin) {
      nextParams.delete("tab");
    } else {
      nextParams.set("tab", "signup");
    }
    setSearchParams(nextParams, { replace: true });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        await signIn(email, password);
        toast({ title: "Welcome back!" });
      } else {
        await signUp({ email, password, displayName, phoneNumber });
        toast({ title: "Account created!", description: "Your account is ready." });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Authentication failed";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-[#FAF9F6] overflow-hidden">
      {/* LEFT PANEL: Visual Illustration & Value Prop (hidden on mobile) */}
      <div className="hidden lg:flex flex-col justify-between p-12 bg-gradient-to-br from-orange-500/10 via-orange-600/5 to-transparent border-r border-orange-500/10 relative overflow-hidden">
        {/* Glow meshes */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(234,88,12,0.1),transparent_40%),radial-gradient(circle_at_bottom_right,rgba(249,115,22,0.08),transparent_50%)] pointer-events-none" />
        <div className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] rounded-full bg-orange-500/5 blur-[120px] pointer-events-none" />
        <div className="absolute -bottom-[20%] -right-[10%] w-[60%] h-[60%] rounded-full bg-amber-500/5 blur-[120px] pointer-events-none" />

        {/* Top Header */}
        <div className="relative flex items-center gap-2.5 z-10">
          <Link to="/" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-r from-orange-500 via-orange-600 to-amber-600 shadow-[0_0_20px_rgba(234,88,12,0.3)]">
              <Send className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-foreground">Paper Plan</span>
          </Link>
        </div>

        {/* Center Illustration */}
        <div className="relative z-10 flex flex-col justify-center items-center py-12">
          {/* Animated Mockup Dashboard Card */}
          <div className="w-full max-w-md glass-panel p-6 border border-orange-500/10 bg-white/40 shadow-[0_12px_40px_rgba(234,88,12,0.08)] backdrop-blur-xl rounded-2xl relative">
            <div className="absolute -top-3 -right-3 rounded-full bg-orange-500/10 border border-orange-500/20 px-3 py-1 text-[11px] font-bold text-orange-700 flex items-center gap-1.5 shadow-[0_0_15px_rgba(234,88,12,0.1)]">
              <Sparkles className="h-3.5 w-3.5 text-orange-500 animate-spin" style={{ animationDuration: '3s' }} /> Live Campaign Pipeline
            </div>

            <div className="space-y-4">
              {/* Node 1 */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-[#FAF9F6] border border-orange-500/5 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
                <div className="h-8 w-8 rounded-lg bg-orange-500/10 flex items-center justify-center border border-orange-500/20 text-orange-600">
                  <Database className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold text-foreground">1. Contact List Processed</p>
                  <p className="text-[10px] text-muted-foreground">30,000 ICP leads loaded into CRM</p>
                </div>
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              </div>

              {/* Connecting line */}
              <div className="w-0.5 h-4 bg-gradient-to-b from-orange-500/30 to-orange-500/5 ml-7" />

              {/* Node 2 */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-[#FAF9F6] border border-orange-500/10 shadow-[0_2px_8px_rgba(0,0,0,0.02)] relative">
                <div className="absolute inset-0 rounded-xl border border-orange-500/20 bg-orange-500/[0.02] animate-pulse pointer-events-none" />
                <div className="h-8 w-8 rounded-lg bg-orange-500/20 flex items-center justify-center border border-orange-500/30 text-orange-600">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold text-foreground">2. Sequence Pacing & Delivery</p>
                  <p className="text-[10px] text-muted-foreground">Anti-spam delay spacing 5-10s</p>
                </div>
                <div className="h-2 w-2 rounded-full bg-orange-500 animate-ping" />
              </div>

              {/* Connecting line */}
              <div className="w-0.5 h-4 bg-gradient-to-b from-orange-500/5 to-orange-500/30 ml-7" />

              {/* Node 3 */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-[#FAF9F6] border border-orange-500/5 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
                <div className="h-8 w-8 rounded-lg bg-orange-500/10 flex items-center justify-center border border-orange-500/20 text-orange-600">
                  <Send className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold text-foreground">3. Round-Robin SMTP Dispatch</p>
                  <p className="text-[10px] text-muted-foreground">High inbox health & domain reputation</p>
                </div>
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              </div>
            </div>

            {/* Performance Stats Overlay */}
            <div className="mt-6 pt-5 border-t border-orange-500/10 grid grid-cols-3 gap-2">
              <div className="text-center">
                <p className="text-[9px] uppercase tracking-widest text-muted-foreground">Deliverability</p>
                <p className="text-sm font-bold text-foreground mt-1">99.8%</p>
              </div>
              <div className="text-center border-x border-orange-500/10">
                <p className="text-[9px] uppercase tracking-widest text-muted-foreground">Avg Open Rate</p>
                <p className="text-sm font-bold text-foreground mt-1">68.2%</p>
              </div>
              <div className="text-center">
                <p className="text-[9px] uppercase tracking-widest text-muted-foreground">Replied Ratio</p>
                <p className="text-sm font-bold text-foreground mt-1">24.5%</p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Footer Quote */}
        <div className="relative z-10 max-w-sm">
          <p className="text-sm font-medium text-foreground leading-relaxed text-muted-foreground">
            "We migrated from Mailchimp and Instantly. Paper Plan gave us a unified B2B CRM and sequence customizer that keeps our delivery rates consistently pristine."
          </p>
          <div className="mt-3 flex items-center gap-2">
            <div className="h-6 w-6 rounded-full bg-orange-500/20 text-[9px] font-black text-orange-700 flex items-center justify-center font-semibold">PP</div>
            <p className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">Lead Marketing Team</span>, GrowthCorp</p>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL: Authentication Form */}
      <div className="relative flex items-center justify-center p-8 lg:p-12">
        {/* Glow background elements for mobile */}
        <div className="lg:hidden absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(234,88,12,0.05),transparent_40%),radial-gradient(circle_at_bottom_right,rgba(249,115,22,0.05),transparent_40%)] pointer-events-none" />

        <div className="relative w-full max-w-md space-y-8">
          <div className="text-center">
            <Link
              to="/"
              className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" /> Back to home
            </Link>
            
            {/* App logo for mobile */}
            <div className="lg:hidden mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-r from-orange-500 via-orange-600 to-amber-600 shadow-[0_0_20px_rgba(234,88,12,0.25)]">
              <Zap className="h-6 w-6 text-white" />
            </div>

            <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
              {isLogin ? "Welcome back" : "Create your account"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {isLogin ? "Sign in to access your email sequences and CRM" : "Start building automated marketing sequences today"}
            </p>

            {!isLogin && (
              <div className="mt-4 text-left p-4 rounded-xl bg-orange-50/80 border border-orange-200 text-orange-800 text-xs shadow-sm space-y-2">
                <div className="flex items-center gap-2 font-black text-orange-600 uppercase tracking-wider text-[10px]">
                  <Sparkles className="h-4 w-4 text-orange-500 animate-pulse" />
                  Free Trial Included
                </div>
                <p className="text-orange-700/90 leading-relaxed font-medium">
                  Create your account today and get instant access to the **Free Trial**. No credit card or sandbox billing setup required.
                </p>
                <ul className="grid grid-cols-2 gap-x-4 gap-y-1 mt-1 text-[11px] text-orange-800/80 font-semibold list-none pl-0">
                  <li className="flex items-center gap-1.5">✓ 20 Lifetime Emails</li>
                  <li className="flex items-center gap-1.5">✓ Link Custom Mailboxes</li>
                  <li className="flex items-center gap-1.5">✓ Basic Contacts CRM</li>
                  <li className="flex items-center gap-1.5">✓ SMTP/IMAP Setup</li>
                </ul>
              </div>
            )}
          </div>

          <div className="glass-panel p-8 bg-white/60 backdrop-blur-xl border border-white/20 shadow-[0_8px_32px_rgba(234,88,12,0.04)] rounded-2xl">
            <form onSubmit={handleSubmit} className="space-y-5">
              {!isLogin && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="name">Display Name</Label>
                    <Input
                      id="name"
                      placeholder="Your name"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      required
                      minLength={2}
                      maxLength={120}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+1 (555) 000-0000"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      required
                    />
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="password">Password</Label>
                  {isLogin && (
                    <span className="text-xs text-orange-600 hover:underline cursor-not-allowed">
                      Forgot password?
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="********"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {!isLogin && (
                  <p className="text-[11px] text-muted-foreground leading-normal">
                    Must be at least 8 characters to meet strict security standards.
                  </p>
                )}
              </div>

              <Button type="submit" className="w-full mt-2" size="lg" disabled={loading || authLoading}>
                {loading ? "Authenticating..." : isLogin ? "Sign in to Dashboard" : "Create My Account"}
              </Button>
            </form>

            <div className="relative my-6 flex items-center justify-center">
              <div className="absolute inset-0 border-t border-border" />
              <span className="relative bg-[#FAF9F6] px-3 text-xs text-muted-foreground uppercase tracking-widest">
                Account Options
              </span>
            </div>

            <p className="text-center text-sm text-muted-foreground">
              {isLogin ? "New to Paper Plan?" : "Already have an account?"}{" "}
              <button
                type="button"
                onClick={() => switchMode(!isLogin)}
                className="font-bold text-orange-600 hover:text-orange-700 hover:underline transition-colors"
              >
                {isLogin ? "Create account" : "Sign in"}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
