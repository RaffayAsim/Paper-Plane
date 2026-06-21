import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: { value: number; positive: boolean };
  className?: string;
  sparklinePath?: string;
  sparklineColor?: string;
}

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  className,
  sparklinePath,
  sparklineColor = "text-primary",
}: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={cn("glass-panel p-6 hover:border-orange-500/25 hover:shadow-[0_12px_40px_rgba(255,102,0,0.08)] hover:scale-[1.01] transition-all duration-300", className)}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">{title}</p>
          <p className="text-3xl font-extrabold tracking-tight text-foreground">{value}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground/90">{subtitle}</p>
          )}
          {trend && (
            <p className={cn("text-xs font-semibold", trend.positive ? "text-orange-600" : "text-destructive")}>
              {trend.positive ? "+" : ""}{trend.value}% from last week
            </p>
          )}
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-500/10 text-orange-600 border border-orange-500/10 shadow-sm shrink-0">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      
      {sparklinePath && (
        <div className="mt-4 flex items-end justify-between border-t border-border/40 pt-3">
          <div className="h-7 w-28">
            <svg className={cn("h-full w-full", sparklineColor)} viewBox="0 0 100 30" fill="none" preserveAspectRatio="none">
              <path
                d={sparklinePath}
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <span className="text-[10px] font-semibold text-muted-foreground/75 uppercase tracking-wider">7d Trend</span>
        </div>
      )}
    </motion.div>
  );
}
