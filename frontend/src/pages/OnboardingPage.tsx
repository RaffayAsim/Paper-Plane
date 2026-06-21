import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Building,
  Sparkles,
  Clock,
  ArrowRight,
  ArrowLeft,
  Check,
  Loader2,
  Globe,
  User,
  Users,
  Building2,
  LogOut,
  Mail,
  ChevronsUpDown,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { COMPANY_SIZES, INDUSTRIES } from "@/lib/company-profile-options";

export default function OnboardingPage() {
  const { user, onboardingStatus, onboardedAt, refreshOnboarding, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Form Fields — Step 1
  const [companyName, setCompanyName] = useState("");
  const [describeCompany, setDescribeCompany] = useState("");
  const [contactDetails, setContactDetails] = useState("");

  // Form Fields — Step 2
  const [serviceProduct, setServiceProduct] = useState("");
  const [industries, setIndustries] = useState<string[]>([]);
  const [industryPickerOpen, setIndustryPickerOpen] = useState(false);
  const [companySize, setCompanySize] = useState("");
  const [domainName, setDomainName] = useState("");
  const [emailSetupType, setEmailSetupType] = useState<"managed" | "self_hosted" | "">("");

  // Countdown State
  const [timeLeft, setTimeLeft] = useState({ hours: 24, minutes: 0, seconds: 0 });

  // Handle Countdown timer if setup is in progress
  useEffect(() => {
    if (onboardingStatus !== "setup_in_progress" || !onboardedAt) return;

    const interval = setInterval(() => {
      const onboardDate = new Date(onboardedAt);
      const targetDate = new Date(onboardDate.getTime() + 24 * 60 * 60 * 1000);
      const now = new Date();
      const diffMs = targetDate.getTime() - now.getTime();

      if (diffMs <= 0) {
        clearInterval(interval);
        void refreshOnboarding();
        return;
      }

      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

      setTimeLeft({ hours, minutes, seconds });
    }, 1000);

    return () => clearInterval(interval);
  }, [onboardingStatus, onboardedAt, refreshOnboarding]);

  const validateStep1 = () => {
    const nextErrors: Record<string, string> = {};
    if (!companyName.trim()) nextErrors.companyName = "Company Name is required";
    if (!describeCompany.trim()) nextErrors.describeCompany = "Company description is required";
    if (!contactDetails.trim()) nextErrors.contactDetails = "Contact details are required";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const validateStep2 = () => {
    const nextErrors: Record<string, string> = {};
    if (!serviceProduct.trim()) nextErrors.serviceProduct = "Service or Product description is required";
    if (industries.length === 0) nextErrors.industry = "Select at least one industry";
    if (!companySize.trim()) nextErrors.companySize = "Company size is required";
    if (!emailSetupType) nextErrors.emailSetupType = "Please select an email setup option";
    if (!domainName.trim()) {
      nextErrors.domainName = emailSetupType === "managed"
        ? "Preferred domain name is required"
        : "Sending domain name is required";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleStep1Next = () => {
    if (validateStep1()) {
      setStep(2);
    }
  };

  const handleBack = () => {
    setStep((current) => Math.max(1, current - 1));
    setErrors({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep1()) return;

    setSaving(true);
    try {
      await api.put("/settings/ai-brand-profile", {
        brandName: companyName,
        brandGuidelines: describeCompany,
        contactPersons: contactDetails,
        services: "",
        industry: "",
        pricing: "",
        companySize: "",
        domainName: "",
        emailSetupType: "managed",
        setupStatus: "pending",
        salesEmail: user?.email || "",
        autoReplyEnabled: true,
        onboardedAt: new Date().toISOString(),
      });

      toast({
        title: "Onboarding form submitted!",
        description: "Your configurations are now being provisioned.",
      });

      await refreshOnboarding();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to submit onboarding form";
      toast({
        title: "Submission failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (onboardingStatus === "setup_in_progress") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 text-foreground p-6 relative overflow-hidden">
        {/* Decorative background gradients */}
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />

        <div className="w-full max-w-2xl bg-card border border-border rounded-3xl p-8 sm:p-12 shadow-sm relative z-10 text-center space-y-8">
          <div className="flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/10 rounded-full blur-md animate-pulse" />
              <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-100 border border-slate-200">
                <Clock className="h-10 w-10 text-primary animate-spin" style={{ animationDuration: "10s" }} />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              Setting Up Your Account
            </h1>
            <p className="text-muted-foreground max-w-md mx-auto text-sm sm:text-base">
              We are currently configuring your dedicated email domains, custom warm-up cycles, and calibrating your AI agents.
            </p>
          </div>

          {/* Countdown timer */}
          <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-black text-primary">
                {String(timeLeft.hours).padStart(2, "0")}
              </div>
              <div className="text-xs text-muted-foreground uppercase font-semibold tracking-wider mt-1">Hours</div>
            </div>
            <div className="text-center border-x border-slate-200">
              <div className="text-3xl sm:text-4xl font-black text-primary">
                {String(timeLeft.minutes).padStart(2, "0")}
              </div>
              <div className="text-xs text-muted-foreground uppercase font-semibold tracking-wider mt-1">Mins</div>
            </div>
            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-black text-primary">
                {String(timeLeft.seconds).padStart(2, "0")}
              </div>
              <div className="text-xs text-muted-foreground uppercase font-semibold tracking-wider mt-1">Secs</div>
            </div>
          </div>

          {/* Setup checkpoints */}
          <div className="text-left space-y-3.5 bg-slate-50/50 p-6 rounded-2xl border border-slate-100 max-w-md mx-auto shadow-sm">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Setup Checklist</h3>

            <div className="flex items-center gap-3">
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 border border-emerald-200">
                <Check className="h-3 w-3" />
              </div>
              <span className="text-sm font-semibold text-foreground">Profile questionnaire completed</span>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary border border-primary/20">
                <Loader2 className="h-3 w-3 animate-spin" />
              </div>
              <span className="text-sm font-semibold text-foreground">Provisioning email domains &amp; warm-up</span>
            </div>

            <div className="flex items-center gap-3 opacity-60">
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400 border border-slate-200">
                <Sparkles className="h-3 w-3" />
              </div>
              <span className="text-sm font-semibold text-muted-foreground">Initializing AI sales strategist context</span>
            </div>

            <div className="flex items-center gap-3 opacity-60">
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400 border border-slate-200">
                <Globe className="h-3 w-3" />
              </div>
              <span className="text-sm font-semibold text-muted-foreground">Activating lead enrichment campaigns</span>
            </div>
          </div>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              variant="outline"
              onClick={() => void refreshOnboarding()}
              className="border-input hover:bg-slate-50 text-foreground"
            >
              Refresh Status
            </Button>
            <Button
              variant="ghost"
              onClick={async () => {
                await signOut();
                navigate("/");
              }}
              className="text-muted-foreground hover:text-foreground hover:bg-slate-100 gap-2"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 text-foreground p-6 relative overflow-hidden">
      {/* Background radial highlights */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-2xl bg-card border border-border rounded-3xl p-6 sm:p-10 shadow-sm relative z-10 space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
              <Building className="h-5 w-5 text-primary" />
            </div>
            <div>
              <span className="text-xs text-primary font-bold uppercase tracking-wider">Onboarding</span>
              <h2 className="text-lg font-bold text-foreground leading-tight">Create Company Profile</h2>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1">
            <h3 className="text-xl font-bold text-foreground">Tell us about your brand</h3>
            <p className="text-xs text-muted-foreground">Let's set up the core details of your organization.</p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="companyName" className="text-foreground text-sm font-semibold flex items-center gap-1.5">
                <Building2 className="h-4 w-4 text-slate-400" />
                Company Name
              </Label>
              <Input
                id="companyName"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Quantum Arc"
                className="bg-background border-input focus:border-primary text-foreground h-11"
              />
              {errors.companyName && <p className="text-xs text-rose-500 font-medium">{errors.companyName}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="describeCompany" className="text-foreground text-sm font-semibold flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-slate-400" />
                Describe Your Company
              </Label>
              <Textarea
                id="describeCompany"
                value={describeCompany}
                onChange={(e) => setDescribeCompany(e.target.value)}
                placeholder="E.g., Quantum Arc is a premium cloud consulting agency focused on optimizing high-scale infrastructure for digital platforms."
                rows={4}
                className="bg-background border-input focus:border-primary text-foreground"
              />
              {errors.describeCompany && <p className="text-xs text-rose-500 font-medium">{errors.describeCompany}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="contactDetails" className="text-foreground text-sm font-semibold flex items-center gap-1.5">
                <User className="h-4 w-4 text-slate-400" />
                Company Contact Details
              </Label>
              <Textarea
                id="contactDetails"
                value={contactDetails}
                onChange={(e) => setContactDetails(e.target.value)}
                placeholder="E.g., Sebastian R. (sales manager), email: sebastian@quantumarc.us, phone: +1 (555) 019-2834"
                rows={3}
                className="bg-background border-input focus:border-primary text-foreground"
              />
              {errors.contactDetails && <p className="text-xs text-rose-500 font-medium">{errors.contactDetails}</p>}
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <Button
              type="submit"
              disabled={saving}
              className="h-11 px-8 font-semibold shadow-sm gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Setting Up Account...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Submit &amp; Setup
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
