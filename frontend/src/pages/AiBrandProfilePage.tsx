import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Bot,
  Building,
  Building2,
  Check,
  CheckCircle2,
  ChevronsUpDown,
  Globe,
  Mail,
  Package,
  Plus,
  Save,
  Sparkles,
  Trash2,
  User,
  Users,
  X,
  Lock,
} from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  COMPANY_SIZES,
  INDUSTRIES,
  createPricingTier,
  defaultPricingTiers,
  parsePricingTiers,
  serializePricingTiers,
  type PricingTier,
} from "@/lib/company-profile-options";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

type AiBrandProfile = {
  brandName: string;
  brandGuidelines: string;
  services: string;
  pricing: string;
  salesEmail: string;
  contactPersons: string;
  autoReplyEnabled: boolean;
  industry?: string;
  companySize?: string;
  domainName?: string;
  emailSetupType?: string;
  updatedAt?: string;
};

const defaultForm: AiBrandProfile = {
  brandName: "",
  brandGuidelines: "",
  services: "",
  pricing: "",
  salesEmail: "",
  contactPersons: "",
  autoReplyEnabled: true,
  industry: "",
  companySize: "",
  domainName: "",
  emailSetupType: "",
};

const sectionClass = "rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6";
const inputClass = "border-input bg-background focus:border-primary text-foreground";

export default function AiBrandProfilePage({ isEmbedded }: { isEmbedded?: boolean }) {
  const { toast } = useToast();
  const { subscriptionPlan } = useAuth();
  const [form, setForm] = useState<AiBrandProfile>(defaultForm);
  const [industries, setIndustries] = useState<string[]>([]);
  const [industryPickerOpen, setIndustryPickerOpen] = useState(false);
  const [pricingTiers, setPricingTiers] = useState<PricingTier[]>(defaultPricingTiers);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.get<{ item: AiBrandProfile | null }>("/settings/ai-brand-profile");
      const profile = data.item ? { ...defaultForm, ...data.item } : defaultForm;
      setForm(profile);
      setIndustries(profile.industry?.split(",").map((item) => item.trim()).filter(Boolean) || []);
      setPricingTiers(parsePricingTiers(profile.pricing));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load Company Profile";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const updateTier = (id: number, field: keyof Omit<PricingTier, "id">, value: string) => {
    setPricingTiers((current) => current.map((tier) => (tier.id === id ? { ...tier, [field]: value } : tier)));
  };

  const addTier = () => {
    setPricingTiers((current) => [...current, createPricingTier(Math.max(0, ...current.map((tier) => tier.id)) + 1)]);
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        industry: industries.join(", "),
        pricing: serializePricingTiers(pricingTiers),
      };
      const data = await api.put<{ item: AiBrandProfile }>("/settings/ai-brand-profile", payload);
      const profile = { ...defaultForm, ...data.item };
      setForm(profile);
      setIndustries(profile.industry?.split(",").map((item) => item.trim()).filter(Boolean) || []);
      setPricingTiers(parsePricingTiers(profile.pricing));
      toast({ title: "Company Profile saved" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save Company Profile";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const content = (
    <div className="mx-auto max-w-6xl space-y-6">
      {!isEmbedded && (
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
              <Sparkles className="h-6 w-6 text-primary" />
              Company Profile
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Keep your company, outreach, and pricing context aligned with the profile created during onboarding.
            </p>
          </div>
          <Button onClick={() => void save()} disabled={saving || loading} className="h-11 px-6">
            {saving ? <Save className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
            {saving ? "Saving..." : "Save Company Profile"}
          </Button>
        </div>
      )}

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-primary/20 bg-primary/5 p-5"
        >
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-foreground">AI sales strategist context</h2>
                {subscriptionPlan === "base" && (
                  <Badge className="bg-orange-500 text-white border-none text-[10px] font-bold py-0.5 px-2 flex items-center gap-1 shrink-0">
                    <Lock className="h-3 w-3" /> Auto-Replies Locked
                  </Badge>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                These details guide lead targeting, campaign messaging, and automated replies.
              </p>
            </div>
            <Switch
              disabled={subscriptionPlan === "base"}
              checked={subscriptionPlan === "base" ? false : form.autoReplyEnabled}
              onCheckedChange={(checked) => setForm((prev) => ({ ...prev, autoReplyEnabled: checked }))}
            />
          </div>
        </motion.div>

        {loading ? (
          <div className={sectionClass}>
            <p className="text-sm text-slate-400">Loading Company Profile...</p>
          </div>
        ) : (
          <>
            <section className={sectionClass}>
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
                  <Building className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-bold text-foreground">Brand details</h2>
                  <p className="text-xs text-muted-foreground">Core company information used across outreach.</p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="brandName" className="flex items-center gap-1.5 text-foreground font-semibold"><Building2 className="h-4 w-4 text-slate-400" />Company Name</Label>
                  <Input id="brandName" value={form.brandName} onChange={(e) => setForm((prev) => ({ ...prev, brandName: e.target.value }))} className={inputClass} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="salesEmail" className="flex items-center gap-1.5 text-foreground font-semibold"><Mail className="h-4 w-4 text-slate-400" />Sales Email</Label>
                  <Input id="salesEmail" type="email" value={form.salesEmail} onChange={(e) => setForm((prev) => ({ ...prev, salesEmail: e.target.value }))} className={inputClass} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="brandGuidelines" className="flex items-center gap-1.5 text-foreground font-semibold"><Sparkles className="h-4 w-4 text-slate-400" />Describe Your Company</Label>
                  <Textarea id="brandGuidelines" value={form.brandGuidelines} onChange={(e) => setForm((prev) => ({ ...prev, brandGuidelines: e.target.value }))} rows={4} className={inputClass} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="contactPersons" className="flex items-center gap-1.5 text-foreground font-semibold"><User className="h-4 w-4 text-slate-400" />Company Contact Details</Label>
                  <Textarea id="contactPersons" value={form.contactPersons} onChange={(e) => setForm((prev) => ({ ...prev, contactPersons: e.target.value }))} rows={3} className={inputClass} />
                </div>
              </div>
            </section>

            <section className={sectionClass}>
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
                  <Globe className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-bold text-foreground">Business and outreach details</h2>
                  <p className="text-xs text-muted-foreground">Target industries, company size, services, and sending domain.</p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-foreground font-semibold"><Globe className="h-4 w-4 text-slate-400" />Industry</Label>
                  <Popover open={industryPickerOpen} onOpenChange={setIndustryPickerOpen}>
                    <PopoverTrigger asChild>
                      <Button type="button" variant="outline" className="h-11 w-full justify-between border-input bg-background hover:bg-slate-50 text-foreground">
                        <span className="truncate font-normal">{industries.length ? `${industries.length} industries selected` : "Select industries"}</span>
                        <ChevronsUpDown className="h-4 w-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
                      <Command>
                        <CommandInput placeholder="Search directory industries..." />
                        <CommandList>
                          <CommandEmpty>No industry found.</CommandEmpty>
                          <CommandGroup>
                            {INDUSTRIES.map((item) => {
                              const selected = industries.includes(item);
                              return (
                                <CommandItem key={item} value={item} onSelect={() => setIndustries((current) => selected ? current.filter((industry) => industry !== item) : [...current, item])}>
                                  <Check className={cn("mr-2 h-4 w-4", selected ? "opacity-100" : "opacity-0")} />
                                  {item}
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {industries.map((item) => (
                      <Badge key={item} variant="secondary" className="gap-1 bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200">
                        {item}
                        <button type="button" aria-label={`Remove ${item}`} onClick={() => setIndustries((current) => current.filter((industry) => industry !== item))}><X className="h-3 w-3" /></button>
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-foreground font-semibold"><Users className="h-4 w-4 text-slate-400" />Company Size</Label>
                  <Select value={form.companySize || ""} onValueChange={(value) => setForm((prev) => ({ ...prev, companySize: value }))}>
                    <SelectTrigger className={cn("h-11", inputClass)}><SelectValue placeholder="Select company size" /></SelectTrigger>
                    <SelectContent>{COMPANY_SIZES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="services" className="flex items-center gap-1.5 text-foreground font-semibold"><Building className="h-4 w-4 text-slate-400" />Service / Product</Label>
                  <Textarea id="services" value={form.services} onChange={(e) => setForm((prev) => ({ ...prev, services: e.target.value }))} rows={4} className={inputClass} />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label className="flex items-center gap-1.5 text-foreground font-semibold"><Mail className="h-4 w-4 text-slate-400" />Email marketing setup</Label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      { value: "managed", label: "Managed Domain Setup", description: "We purchase, configure, and warm up outreach domains for you." },
                      { value: "self_hosted", label: "Bring your own Domain", description: "Use your own sending domain and configure credentials later." },
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, emailSetupType: option.value, domainName: "" }))}
                        className={cn(
                          "rounded-xl border bg-background p-4 text-left transition-all shadow-sm",
                          form.emailSetupType === option.value ? "border-primary ring-1 ring-primary bg-primary/5" : "border-input hover:border-slate-300 hover:bg-slate-50/50",
                        )}
                      >
                        <span className="text-sm font-bold text-foreground">{option.label}</span>
                        <span className="mt-1 block text-xs text-muted-foreground">{option.description}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {form.emailSetupType && (
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="domainName" className="text-foreground font-semibold">{form.emailSetupType === "managed" ? "Preferred Domain Name" : "Sending Domain"}</Label>
                    <Input id="domainName" value={form.domainName || ""} onChange={(e) => setForm((prev) => ({ ...prev, domainName: e.target.value }))} className={inputClass} />
                  </div>
                )}
              </div>
            </section>

            <section className={sectionClass}>
              <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
                    <Package className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="font-bold text-foreground">Pricing tiers</h2>
                    <p className="text-xs text-muted-foreground">Plans and offers available to your prospects.</p>
                  </div>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addTier} className="border-input hover:bg-slate-50"><Plus className="h-4 w-4" />Add Tier</Button>
              </div>

              <div className="grid gap-3 lg:grid-cols-3">
                {pricingTiers.map((tier, index) => (
                  <div key={tier.id} className="space-y-3 rounded-xl border border-border bg-background p-4 shadow-sm hover:border-primary/20 transition-all">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tier {index + 1}</p>
                        <p className="text-sm font-semibold text-foreground">{tier.name || "Untitled plan"}</p>
                      </div>
                      {pricingTiers.length > 1 && (
                        <Button type="button" variant="ghost" size="icon" onClick={() => setPricingTiers((current) => current.filter((item) => item.id !== tier.id))} className="h-8 w-8 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <Input value={tier.name} onChange={(e) => updateTier(tier.id, "name", e.target.value)} placeholder="Plan name" className={inputClass} />
                    <div className="grid grid-cols-[1fr_110px] gap-2">
                      <Input value={tier.price} onChange={(e) => updateTier(tier.id, "price", e.target.value)} placeholder="$499" className={inputClass} />
                      <Select value={tier.billingPeriod} onValueChange={(value) => updateTier(tier.id, "billingPeriod", value)}>
                        <SelectTrigger className={inputClass}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="month">Monthly</SelectItem>
                          <SelectItem value="quarter">Quarterly</SelectItem>
                          <SelectItem value="year">Yearly</SelectItem>
                          <SelectItem value="project">Per project</SelectItem>
                          <SelectItem value="hour">Hourly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Textarea value={tier.includes} onChange={(e) => updateTier(tier.id, "includes", e.target.value)} placeholder="What is included..." rows={4} className={inputClass} />
                  </div>
                ))}
              </div>
            </section>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {form.updatedAt ? `Last updated ${new Date(form.updatedAt).toLocaleString()}` : "Profile has not been saved yet."}
              </p>
              <Button onClick={() => void save()} disabled={saving} className="h-11 px-8">
                {saving ? <Save className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                {saving ? "Saving..." : "Save Company Profile"}
              </Button>
            </div>
          </>
        )}
      </div>
  );

  if (isEmbedded) return content;
  return <DashboardLayout>{content}</DashboardLayout>;
}
