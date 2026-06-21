import { Link } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useUserRole } from "@/hooks/useUserRole";
import { AtSign, Mail, ShieldCheck, Workflow } from "lucide-react";

function IntegrationCard({
  icon,
  title,
  description,
  badge,
  primaryLabel,
  primaryTo,
  secondaryLabel,
  secondaryTo,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  badge?: string;
  primaryLabel: string;
  primaryTo: string;
  secondaryLabel?: string;
  secondaryTo?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            {icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-foreground">{title}</h2>
              {badge ? <Badge variant="outline">{badge}</Badge> : null}
            </div>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <Button asChild>
          <Link to={primaryTo}>{primaryLabel}</Link>
        </Button>
        {secondaryLabel && secondaryTo ? (
          <Button asChild variant="outline">
            <Link to={secondaryTo}>{secondaryLabel}</Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export default function IntegrationsPage() {
  const { isSuperAdmin } = useUserRole();

  return (
    <DashboardLayout>
      <div className="max-w-6xl space-y-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
            <Workflow className="h-3.5 w-3.5" />
            Integrations
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Connect your delivery stack</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Manage the services this workspace uses for outbound email automation. This is the home for SMTP and IMAP-related setup.
          </p>
        </div>

        <div className="grid gap-4">
          <IntegrationCard
            icon={<AtSign className="h-5 w-5" />}
            title="Email"
            badge="AI Lead Gen"
            description="Add your own SMTP sender accounts, optional IMAP inbox sync, and manage the mailboxes used for your outreach workflows."
            primaryLabel="Manage my email accounts"
            primaryTo="/my-email-settings"
            secondaryLabel={isSuperAdmin ? "Admin email settings" : undefined}
            secondaryTo={isSuperAdmin ? "/email-settings" : undefined}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Mail className="h-4.5 w-4.5" />
              </div>
              <div>
                <p className="font-medium text-foreground">SMTP & IMAP</p>
                <p className="text-sm text-muted-foreground">Bring your own mailboxes</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <ShieldCheck className="h-4.5 w-4.5" />
              </div>
              <div>
                <p className="font-medium text-foreground">Centralized Setup</p>
                <p className="text-sm text-muted-foreground">One place for delivery integrations</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
