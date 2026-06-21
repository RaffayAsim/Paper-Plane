import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type BadgeVariant = "active" | "pending" | "enriched" | "new" | "failed" | "contacted" | "qualified" | "converted";

const variantStyles: Record<BadgeVariant, string> = {
  new: "bg-slate-500/10 text-slate-700 border-slate-500/20",
  enriched: "bg-orange-500/15 text-orange-700 border-orange-500/25",
  contacted: "bg-orange-500/10 text-orange-700 border-orange-500/20",
  qualified: "bg-orange-500/20 text-orange-700 border-orange-500/30 font-bold",
  converted: "bg-orange-500/30 text-orange-700 border-orange-500/40 font-bold",
  failed: "bg-destructive/10 text-destructive border-destructive/20",
  pending: "bg-orange-500/5 text-orange-700/80 border-orange-500/10",
  active: "bg-orange-500/20 text-orange-700 border-orange-500/30 font-bold",
};

const statusExplanations: Record<string, string> = {
  new: "Newly discovered contact; outreach has not started.",
  enriched: "Contact details (email/phone) successfully found and loaded.",
  contacted: "An outreach email has been sent to this lead.",
  qualified: "Hot Lead! Engagement or high buying intent detected.",
  converted: "Success! Lead has booked a call or taken action.",
  failed: "Outreach failed or contact details could not be found.",
  pending: "Outreach is pending/scheduled to send.",
  active: "Active lead engaging with outreach.",
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const normalized = status.toLowerCase() as BadgeVariant;
  const styles = variantStyles[normalized] || variantStyles.pending;
  const explanation = statusExplanations[normalized] || statusExplanations.pending;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize cursor-help",
              styles,
              className
            )}
          >
            {status}
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-[200px] text-xs">
          {explanation}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
