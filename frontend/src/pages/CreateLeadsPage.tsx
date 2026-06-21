import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, CheckCircle2, Download, Loader2, RefreshCw, Send, UploadCloud, FileSpreadsheet, Sparkles } from "lucide-react";
import * as XLSX from "xlsx";
import { z } from "zod";
import { DashboardLayout } from "@/components/DashboardLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";

const formSchema = z.object({
  businessType: z.string().min(1, "Business type is required").max(100),
  location: z.string().min(1, "Location is required").max(200),
  leadCount: z.string().min(1, "Number of leads is required"),
});

type FormState = "idle" | "loading" | "success" | "error";
type CampaignStatus = "pending" | "processing" | "completed" | "failed";
type SourceKey = "google_maps" | "yelp" | "yellow_pages" | "custom";

type CampaignRecord = {
  id: string;
  source: SourceKey;
  businessType: string;
  location: string;
  leadCount: number;
  status: CampaignStatus;
  createdAt?: string;
  errorMessage?: string | null;
  externalResponse?: {
    job_id?: string;
    status?: string;
    found_count?: number;
    processed_count?: number;
    total_requested?: number;
    cached_count?: number;
    fresh_target?: number;
    enrichment_status?: string;
    enrichment_processed?: number;
    enrichment_updated?: number;
  } | null;
};

type CreditSummary = {
  limit: number | null;
  used: number;
  remaining: number | null;
  planLimit: number | null;
  overrideLimit: number | null;
  subscriptionPlan: "base" | "ai_lead_gen";
  unlimited: boolean;
};

const sourceLabels: Record<SourceKey, string> = {
  google_maps: "Google Maps",
  yelp: "Yelp",
  yellow_pages: "Yellow Pages",
  custom: "Custom / Imported",
};

// LeadScraperWorkspace removed as scraping features are discontinued.

export function LeadImportWorkspace({ onImportSuccess }: { onImportSuccess?: (leadIds: string[]) => void }) {
  const { toast } = useToast();
  const [formState, setFormState] = useState<FormState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [location, setLocation] = useState("Imported");
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<any[][]>([]);
  const [headerMapping, setHeaderMapping] = useState<Record<string, string>>({});
  const [credits, setCredits] = useState<CreditSummary | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignRecord[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);

  const loadCredits = async () => {
    try {
      const data = await api.get<CreditSummary>("/leads/credits");
      setCredits(data);
    } catch (err) {
      console.error("Failed to load lead credits", err);
    }
  };

  const loadCampaigns = async () => {
    setLoadingCampaigns(true);
    try {
      const data = await api.get<{ items: CampaignRecord[] }>("/leads/campaigns/list");
      setCampaigns((data.items ?? []).filter((item) => item.source === "custom"));
    } catch (err) {
      console.error("Failed to load campaigns", err);
      toast({ title: "Failed to load campaigns", description: "Please try again.", variant: "destructive" });
    } finally {
      setLoadingCampaigns(false);
    }
  };

  useEffect(() => {
    void loadCredits();
    void loadCampaigns();
  }, []);

  // Determine which step the user is on
  const currentStep = headers.length === 0 ? 1 : formState === "success" ? 3 : 2;

  const downloadSampleTemplate = () => {
    const headers = ["Contact Name", "Company / Business", "Email Address", "Phone Number", "Website URL", "Industry", "Location / City"];
    const sampleRows = [
      ["John Smith", "Acme Corp", "john@acme.com", "+1-555-0100", "https://acme.com", "Technology", "New York, USA"],
      ["Sarah Jones", "Baker & Co", "sarah@bakerco.com", "+1-555-0101", "https://bakerco.com", "Retail", "Los Angeles, USA"],
      ["Mike Chen", "Chen Dental", "mike@chendental.com", "+1-555-0102", "", "Healthcare", "Chicago, USA"],
    ];
    const csvContent = [headers, ...sampleRows].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "sample_contacts_template.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  const guessColumnMapping = (sheetHeaders: string[]) => {
    const mapping: Record<string, string> = {};
    sheetHeaders.forEach((header) => {
      const lower = header.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (lower === "name" || lower === "fullname" || lower === "contactname" || lower === "contact" || lower === "person") {
        mapping[header] = "name";
      } else if (lower === "business" || lower === "businessname" || lower === "company" || lower === "companyname" || lower === "firm" || lower === "organization") {
        mapping[header] = "business";
      } else if (lower === "email" || lower === "emailaddress" || lower === "mail") {
        mapping[header] = "email";
      } else if (lower === "phone" || lower === "phonenumber" || lower === "tel" || lower === "telephone" || lower === "mobile" || lower === "cell") {
        mapping[header] = "phone";
      } else if (lower === "website" || lower === "site" || lower === "web" || lower === "url" || lower === "link") {
        mapping[header] = "website";
      } else if (lower === "industry" || lower === "category" || lower === "niche" || lower === "profession" || lower === "type") {
        mapping[header] = "industry";
      } else if (lower === "location" || lower === "address" || lower === "city" || lower === "state" || lower === "region") {
        mapping[header] = "location";
      } else {
        mapping[header] = "__custom";
      }
    });

    // Ensure at least one field is mapped to "name" as fallback
    const hasName = Object.values(mapping).includes("name");
    if (!hasName && sheetHeaders.length > 0) {
      mapping[sheetHeaders[0]] = "name";
    }

    setHeaderMapping(mapping);
  };

  const handleMappingChange = (header: string, systemField: string) => {
    setHeaderMapping((prev) => {
      const next = { ...prev };
      
      // If setting a system field that should be unique (like "name", "email", etc.), 
      // unset it from any other header that might have had it.
      if (systemField !== "__custom") {
        Object.keys(next).forEach((k) => {
          if (next[k] === systemField) {
            next[k] = "__custom";
          }
        });
      }
      
      next[header] = systemField;
      return next;
    });
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setFormState("idle");
    setErrorMessage("");

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });

        if (jsonData.length === 0) {
          throw new Error("The selected file is empty.");
        }

        const sheetHeaders = (jsonData[0] as unknown[]).map((val) => String(val ?? "").trim()).filter(Boolean);
        if (sheetHeaders.length === 0) {
          throw new Error("No headers found in the first row of the sheet.");
        }

        const rows = jsonData.slice(1) as any[][];

        setHeaders(sheetHeaders);
        setParsedRows(rows);
        guessColumnMapping(sheetHeaders);
      } catch (err: any) {
        setErrorMessage(err.message || "Failed to parse spreadsheet file.");
        setFormState("error");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const getMappedPreviewLeads = () => {
    return parsedRows.slice(0, 3).map((row) => {
      const getVal = (field: string) => {
        const header = Object.keys(headerMapping).find((k) => headerMapping[k] === field);
        if (!header) return "";
        const headerIndex = headers.indexOf(header);
        if (headerIndex === -1) return "";
        return String(row[headerIndex] ?? "").trim();
      };

      return {
        name: getVal("name"),
        business: getVal("business"),
        email: getVal("email"),
        phone: getVal("phone"),
        website: getVal("website"),
        industry: getVal("industry"),
        location: getVal("location"),
      };
    });
  };

  const handleImport = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!campaignName.trim()) {
      setErrorMessage("Campaign name is required.");
      setFormState("error");
      return;
    }
    const hasName = Object.values(headerMapping).includes("name");
    if (!hasName) {
      setErrorMessage("Contact Name column mapping is required.");
      setFormState("error");
      return;
    }

    setFormState("loading");
    setErrorMessage("");

    try {
      const mappedLeads = parsedRows
        .map((row) => {
          const getVal = (field: string) => {
            const header = Object.keys(headerMapping).find((k) => headerMapping[k] === field);
            if (!header) return null;
            const headerIndex = headers.indexOf(header);
            if (headerIndex === -1) return null;
            const val = row[headerIndex];
            if (val === undefined || val === null) return null;
            return String(val).trim();
          };

          const leadObj: Record<string, any> = {
            name: getVal("name"),
            business: getVal("business") || undefined,
            email: getVal("email") || undefined,
            phone: getVal("phone") || undefined,
            website: getVal("website") || undefined,
            industry: getVal("industry") || undefined,
            location: getVal("location") || undefined,
          };

          // Capture all custom/metadata columns
          headers.forEach((header, idx) => {
            const systemField = headerMapping[header];
            if (systemField === "__custom") {
              const val = row[idx];
              if (val !== undefined && val !== null) {
                leadObj[header] = String(val).trim();
              }
            }
          });

          return leadObj;
        })
        .filter((lead): lead is any => Boolean(lead && lead.name));

      if (mappedLeads.length === 0) {
        throw new Error("No leads found with a valid Contact Name.");
      }

      const resImport = await api.post<{ item: CampaignRecord; leadIds?: string[] }>("/leads/campaigns/import", {
        campaignName: campaignName.trim(),
        location: location.trim() || "Imported",
        leads: mappedLeads,
      });

      setFormState("success");
      toast({
        title: "Import complete",
        description: `Successfully imported ${mappedLeads.length} leads.`,
      });
      onImportSuccess?.(resImport.leadIds ?? []);

      await Promise.all([loadCredits(), loadCampaigns()]);

      setTimeout(() => {
        setFormState("idle");
        setCampaignName("");
        setFileName("");
        setHeaders([]);
        setParsedRows([]);
      }, 2000);
    } catch (err: any) {
      setFormState("error");
      setErrorMessage(err.message || "Failed to import leads");
    }
  };

  const previewLeads = getMappedPreviewLeads();

  return (
    <div className="grid items-start gap-6 sm:grid-cols-[minmax(0,1fr)_320px]">
      <motion.form
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={handleImport}
        className="glass-card rounded-xl p-6 space-y-6"
      >
        <div>
          <h2 className="text-xl font-semibold text-foreground">Import Contacts</h2>
          <p className="mt-1 text-sm text-muted-foreground">Upload your contact list from an Excel (.xlsx) or CSV file.</p>
        </div>

        {/* 3-Step wizard indicator */}
        <div className="flex items-center gap-0">
          {[{ n: 1, label: "Upload File" }, { n: 2, label: "Map Columns" }, { n: 3, label: "Import" }].map((step, i) => (
            <div key={step.n} className="flex items-center flex-1">
              <div className="flex flex-col items-center gap-1">
                <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all ${
                  currentStep > step.n
                    ? "bg-emerald-500 text-white"
                    : currentStep === step.n
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                }`}>
                  {currentStep > step.n ? <CheckCircle2 className="h-4 w-4" /> : step.n}
                </div>
                <span className={`text-[10px] font-medium ${
                  currentStep === step.n ? "text-foreground" : "text-muted-foreground"
                }`}>{step.label}</span>
              </div>
              {i < 2 && (
                <div className={`h-px flex-1 mx-2 mb-4 transition-all ${currentStep > step.n ? "bg-emerald-500" : "bg-border"}`} />
              )}
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="campaignName">Import List Name *</Label>
            <p className="text-xs text-muted-foreground">Give this batch a name so you can find it later (e.g. "NYC Dentists May 2025")</p>
            <Input
              id="campaignName"
              placeholder="e.g. New York Dentists – May 2025"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Upload Spreadsheet</Label>
              <button
                type="button"
                onClick={downloadSampleTemplate}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                Download Sample Template
              </button>
            </div>
            <div className="relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border/80 bg-background/40 p-6 text-center hover:border-primary/50 transition-colors">
              <UploadCloud className="h-10 w-10 text-muted-foreground mb-2" />
              {fileName ? (
                <div>
                  <p className="text-sm font-medium text-foreground">{fileName}</p>
                  <p className="text-xs text-muted-foreground mt-1">{parsedRows.length} rows found</p>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-muted-foreground">Drag and drop or click to upload</p>
                  <p className="text-xs text-muted-foreground/80 mt-1">Excel (.xlsx, .xls) or CSV up to 10MB</p>
                </div>
              )}
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {headers.length > 0 && (
          <div className="space-y-4 rounded-xl border border-border/60 bg-muted/10 p-4">
            <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Column Mapping
            </h3>
            <p className="text-xs text-muted-foreground">Match your spreadsheet columns to database fields.</p>

            <div className="space-y-3.5 mt-2">
              {headers.map((header) => (
                <div key={header} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-border/40 pb-3 last:border-none last:pb-0">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-foreground">{header}</span>
                    <span className="text-[11px] text-muted-foreground">Sample: {String(parsedRows[0]?.[headers.indexOf(header)] ?? "") || "(empty)"}</span>
                  </div>
                  <Select
                    value={headerMapping[header] || "__custom"}
                    onValueChange={(val) => handleMappingChange(header, val)}
                  >
                    <SelectTrigger className="w-full sm:w-[260px] h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__custom">Custom Field / Date Trigger</SelectItem>
                      <SelectItem value="name">Contact Name *</SelectItem>
                      <SelectItem value="email">Email Address</SelectItem>
                      <SelectItem value="business">Company / Business</SelectItem>
                      <SelectItem value="location">Location / City</SelectItem>
                      <SelectItem value="industry">Industry</SelectItem>
                      <SelectItem value="website">Website URL</SelectItem>
                      <SelectItem value="phone">Phone Number</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            {previewLeads.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-border/40">
                <p className="text-xs font-semibold text-foreground">Mapping Preview (First 3 rows)</p>
                <div className="overflow-x-auto rounded-lg border border-border bg-background">
                  <table className="w-full text-left text-[11px]">
                    <thead>
                      <tr className="border-b border-border bg-muted/35 font-medium text-muted-foreground">
                        <th className="p-2">Name</th>
                        <th className="p-2">Business</th>
                        <th className="p-2">Email</th>
                        <th className="p-2">Phone</th>
                        <th className="p-2">Location</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewLeads.map((item, idx) => (
                        <tr key={idx} className="border-b border-border last:border-none hover:bg-muted/10">
                          <td className="p-2 truncate max-w-[80px] font-medium text-foreground">{item.name || "-"}</td>
                          <td className="p-2 truncate max-w-[80px] text-muted-foreground">{item.business || "-"}</td>
                          <td className="p-2 truncate max-w-[100px] text-muted-foreground">{item.email || "-"}</td>
                          <td className="p-2 truncate max-w-[80px] text-muted-foreground">{item.phone || "-"}</td>
                          <td className="p-2 truncate max-w-[80px] text-muted-foreground">{item.location || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {credits ? (
          <div className="rounded-lg border border-border/60 bg-muted/20 p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground font-medium">Lead Credits</span>
              {credits.unlimited ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-xs">Unlimited (Admin)</span>
              ) : (
                <span className="text-xs text-muted-foreground">
                  {credits.used.toLocaleString()} / {(credits.limit ?? 0).toLocaleString()} used
                </span>
              )}
            </div>
            {!credits.unlimited && credits.limit && (
              <div className="relative h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-primary transition-all"
                  style={{ width: `${Math.min(100, (credits.used / credits.limit) * 100)}%` }}
                />
              </div>
            )}
            {!credits.unlimited && (
              <p className="text-xs text-muted-foreground">
                {(credits.remaining ?? 0).toLocaleString()} credits remaining
              </p>
            )}
          </div>
        ) : null}

        <AnimatePresence mode="wait">
          {formState === "error" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              {errorMessage}
            </motion.div>
          )}
          {formState === "success" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-700"
            >
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Leads imported successfully.
            </motion.div>
          )}
        </AnimatePresence>

        <Button
          type="submit"
          disabled={formState === "loading" || formState === "success" || parsedRows.length === 0}
          className="w-full sm:w-auto"
        >
          {formState === "loading" ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Importing...
            </>
          ) : (
            <>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Import Leads
            </>
          )}
        </Button>
      </motion.form>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card rounded-xl p-6"
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Import History</h2>
            <p className="mt-1 text-sm text-muted-foreground">Recent Excel / CSV imports.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void loadCampaigns()} disabled={loadingCampaigns}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loadingCampaigns ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        <div className="mt-5 space-y-3">
          {loadingCampaigns ? (
            <div className="text-sm text-muted-foreground">Loading history...</div>
          ) : campaigns.length === 0 ? (
            <div className="text-sm text-muted-foreground">No imports yet.</div>
          ) : (
            campaigns.map((campaign) => (
              <div key={campaign.id} className="rounded-xl border border-border/60 bg-background/60 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-foreground">{campaign.businessType}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{campaign.location}</p>
                  </div>
                  <StatusBadge status={campaign.status} />
                </div>

                <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                  <p>Imported leads: {campaign.leadCount}</p>
                  <p>Created: {campaign.createdAt ? new Date(campaign.createdAt).toLocaleString() : "Unknown"}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </motion.div>
    </div>
  );
}

export default function CreateLeadsPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Import Contacts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload your contact list as an Excel (.xlsx, .xls) or CSV file to build your audience for campaigns.
          </p>
        </div>

        <div className="mt-6">
          <LeadImportWorkspace />
        </div>
      </div>
    </DashboardLayout>
  );
}

