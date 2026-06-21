import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Mail, Pencil, Plus, Power, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useUserRole } from "@/hooks/useUserRole";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type SmtpConfig = {
  id: string;
  name: string;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromEmail: string;
  imapHost?: string;
  imapPort?: number;
  imapSecure?: boolean;
  imapUser?: string;
  imapPass?: string;
  isDefault: boolean;
  isActive: boolean;
  dailySendLimit?: number;
  createdAt: string;
  updatedAt: string;
};

const emptyForm = {
  name: "",
  host: "",
  port: 587,
  secure: false,
  user: "",
  pass: "",
  fromEmail: "",
  imapHost: "",
  imapPort: 993,
  imapSecure: true,
  imapUser: "",
  imapPass: "",
  isDefault: false,
  isActive: true,
  dailySendLimit: 50,
};

export default function EmailSettingsPage({ isEmbedded }: { isEmbedded?: boolean }) {
  const { toast } = useToast();
  const { role, isSuperAdmin } = useUserRole();
  const [items, setItems] = useState<SmtpConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [configType, setConfigType] = useState<"personal" | "system">("personal");

  const load = async (type: "personal" | "system") => {
    setLoading(true);
    try {
      const endpoint = type === "personal" ? "/settings/email-accounts" : "/admin/email-settings";
      const data = await api.get<{ items: SmtpConfig[] }>(endpoint);
      setItems(data.items || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load email configurations";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(configType);
  }, [configType]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (item: SmtpConfig) => {
    setEditingId(item.id);
    setForm({
      name: item.name,
      host: item.host,
      port: item.port,
      secure: item.secure,
      user: item.user,
      pass: item.pass,
      fromEmail: item.fromEmail,
      imapHost: item.imapHost || "",
      imapPort: item.imapPort || 993,
      imapSecure: typeof item.imapSecure === "boolean" ? item.imapSecure : true,
      imapUser: item.imapUser || "",
      imapPass: item.imapPass || "",
      isDefault: item.isDefault,
      isActive: item.isActive,
      dailySendLimit: item.dailySendLimit ?? 50,
    });
    setDialogOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const baseEndpoint = configType === "personal" ? "/settings/email-accounts" : "/admin/email-settings";
      const path = editingId ? `${baseEndpoint}/${editingId}` : baseEndpoint;
      
      const data = editingId
        ? await api.patch<{ items: SmtpConfig[] }>(path, form)
        : await api.post<{ items: SmtpConfig[] }>(path, form);

      setItems(data.items || []);
      setDialogOpen(false);
      toast({ title: editingId ? "Email configuration updated" : "Email configuration added" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save email configuration";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    try {
      const baseEndpoint = configType === "personal" ? "/settings/email-accounts" : "/admin/email-settings";
      await api.delete(`${baseEndpoint}/${id}`);
      setItems((prev) => prev.filter((item) => item.id !== id));
      toast({ title: "Email configuration deleted" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete email configuration";
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  const renderContent = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            {configType === "personal" ? "Personal Mailboxes" : "System Sender Pool"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {configType === "personal"
              ? "Add your personal SMTP and IMAP credentials. These accounts are reserved for you only."
              : "Manage system-wide SMTP accounts. These are used as a fallback sender pool."}
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add Account
        </Button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-primary/20 bg-primary/5 p-6"
      >
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
            {configType === "personal" ? (
              <UserRound className="h-5 w-5 text-primary" />
            ) : (
              <ShieldCheck className="h-5 w-5 text-primary" />
            )}
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">
              {configType === "personal" ? "Your private sender pool" : "Admin-only SMTP pool"}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {configType === "personal"
                ? "Outbound campaigns will prefer your active accounts before using any shared mailbox pool."
                : "The active configs here are utilized for shared campaigns. Environment configs remain as fallback."}
            </p>
          </div>
        </div>
      </motion.div>

      <div className="grid gap-4">
        {loading ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-sm text-muted-foreground">
            Loading email configurations...
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-sm text-muted-foreground">
            No configurations saved yet. Click "Add Account" to get started.
          </div>
        ) : (
          items.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="rounded-2xl border border-border bg-card p-6"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                      <Mail className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground">{item.name}</h4>
                      <p className="text-sm text-muted-foreground">{item.fromEmail}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {item.isDefault && <Badge>Default</Badge>}
                    <Badge variant={item.isActive ? "secondary" : "outline"}>
                      {item.isActive ? "Active" : "Inactive"}
                    </Badge>
                    <Badge variant="outline">{item.secure ? "Secure" : "STARTTLS / Plain"}</Badge>
                  </div>
                  <div className="grid gap-1 text-sm text-muted-foreground">
                    <p>Host: {item.host}:{item.port}</p>
                    <p>User: {item.user}</p>
                    <p>Daily Send Limit: {item.dailySendLimit ?? 50} emails/day</p>
                    <p>IMAP: {item.imapHost ? `${item.imapHost}:${item.imapPort ?? 993}` : "Not configured"}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => openEdit(item)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete configuration</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will remove <strong>{item.name}</strong> from saved settings.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => void remove(item.id)}>
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );

  const content = (
    <div className="max-w-4xl space-y-6">
      {!isEmbedded && (
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Email Accounts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure SMTP and IMAP details to send emails and sync inbox conversations.
          </p>
        </div>
      )}

        {isSuperAdmin ? (
          <Tabs value={configType} onValueChange={(val) => setConfigType(val as any)} className="w-full">
            <TabsList className="grid w-full grid-cols-2 max-w-md bg-muted/40 p-1 border border-border rounded-xl">
              <TabsTrigger value="personal" className="rounded-lg py-2 text-sm font-semibold transition-all">
                Personal Mailboxes
              </TabsTrigger>
              <TabsTrigger value="system" className="rounded-lg py-2 text-sm font-semibold transition-all">
                System SMTP Pool
              </TabsTrigger>
            </TabsList>
            <TabsContent value="personal" className="space-y-6 pt-4">
              {renderContent()}
            </TabsContent>
            <TabsContent value="system" className="space-y-6 pt-4">
              {renderContent()}
            </TabsContent>
          </Tabs>
        ) : (
          <div className="space-y-6">
            {renderContent()}
          </div>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="flex max-h-[90vh] w-[calc(100vw-2rem)] max-w-3xl flex-col overflow-hidden p-0">
            <DialogHeader className="border-b border-border px-6 py-5 pr-14">
              <DialogTitle>{editingId ? "Edit Account" : "Add Account"}</DialogTitle>
              <DialogDescription>
                {configType === "personal"
                  ? "Enter personal SMTP and IMAP credentials. System checks connections before saving."
                  : "Enter system SMTP credentials for the fallback shared pool."}
              </DialogDescription>
            </DialogHeader>
            <div className="overflow-y-auto px-6 py-5">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Display Name</Label>
                  <Input id="name" placeholder="e.g. Work Email" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="host">SMTP Host</Label>
                    <Input id="host" placeholder="smtp.gmail.com" value={form.host} onChange={(e) => setForm((prev) => ({ ...prev, host: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="port">SMTP Port</Label>
                    <Input id="port" type="number" value={form.port} onChange={(e) => setForm((prev) => ({ ...prev, port: Number(e.target.value) }))} />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="user">SMTP Username / Email</Label>
                    <Input id="user" placeholder="you@domain.com" value={form.user} onChange={(e) => setForm((prev) => ({ ...prev, user: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pass">SMTP Password / App Password</Label>
                    <Input id="pass" type="password" value={form.pass} onChange={(e) => setForm((prev) => ({ ...prev, pass: e.target.value }))} />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="fromEmail">From Email Address</Label>
                    <Input id="fromEmail" type="email" placeholder="you@domain.com" value={form.fromEmail} onChange={(e) => setForm((prev) => ({ ...prev, fromEmail: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dailySendLimit">Daily Send Limit</Label>
                    <Input id="dailySendLimit" type="number" min={1} placeholder="50" value={form.dailySendLimit} onChange={(e) => setForm((prev) => ({ ...prev, dailySendLimit: Number(e.target.value) || 50 }))} />
                  </div>
                </div>
                
                <div className="rounded-xl border border-border p-4">
                  <div className="mb-4">
                    <h3 className="text-sm font-medium text-foreground">IMAP Settings (Optional)</h3>
                    <p className="text-xs text-muted-foreground">Used to sync replies and messages in your inbox.</p>
                  </div>
                  <div className="grid gap-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="imapHost">IMAP Host</Label>
                        <Input id="imapHost" placeholder="imap.gmail.com" value={form.imapHost} onChange={(e) => setForm((prev) => ({ ...prev, imapHost: e.target.value }))} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="imapPort">IMAP Port</Label>
                        <Input id="imapPort" type="number" value={form.imapPort} onChange={(e) => setForm((prev) => ({ ...prev, imapPort: Number(e.target.value) }))} />
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="imapUser">IMAP Username</Label>
                        <Input id="imapUser" placeholder="you@domain.com" value={form.imapUser} onChange={(e) => setForm((prev) => ({ ...prev, imapUser: e.target.value }))} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="imapPass">IMAP Password</Label>
                        <Input id="imapPass" type="password" value={form.imapPass} onChange={(e) => setForm((prev) => ({ ...prev, imapPass: e.target.value }))} />
                      </div>
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
                      <div>
                        <p className="text-sm font-medium">IMAP SSL/TLS</p>
                        <p className="text-xs text-muted-foreground">Always use secure IMAP protocols</p>
                      </div>
                      <Switch checked={form.imapSecure} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, imapSecure: checked }))} />
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">SSL/TLS</p>
                      <p className="text-xs text-muted-foreground">SMTP secure</p>
                    </div>
                    <Switch checked={form.secure} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, secure: checked }))} />
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">Preferred Default</p>
                      <p className="text-xs text-muted-foreground">Make primary sender</p>
                    </div>
                    <Switch checked={form.isDefault} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, isDefault: checked }))} />
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">Active Status</p>
                      <p className="text-xs text-muted-foreground">Enable account</p>
                    </div>
                    <Switch checked={form.isActive} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, isActive: checked }))} />
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter className="border-t border-border px-6 py-4">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => void save()} disabled={saving}>
                <Power className="mr-2 h-4 w-4" />
                {saving ? "Saving..." : editingId ? "Update Account" : "Save Account"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
  );

  if (isEmbedded) return content;
  return <DashboardLayout>{content}</DashboardLayout>;
}
