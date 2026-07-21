import { cn, formatCurrency } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: number;
  hint?: string;
  icon: LucideIcon;
  tone?: "default" | "positive" | "warning" | "accent" | "danger";
  currency?: string;
  className?: string;
  large?: boolean;
}

const toneStyles = {
  default: "from-surface to-surface-2 text-ink",
  positive: "from-emerald-50 to-teal-50 text-emerald-900 border-emerald-100",
  warning: "from-amber-50 to-orange-50 text-amber-950 border-amber-100",
  accent: "from-sky-50 to-cyan-50 text-sky-950 border-sky-100",
  danger: "from-rose-50 to-pink-50 text-rose-950 border-rose-100",
};

const iconTone = {
  default: "bg-surface-3 text-ink-muted",
  positive: "bg-emerald-100 text-emerald-700",
  warning: "bg-amber-100 text-amber-700",
  accent: "bg-sky-100 text-sky-700",
  danger: "bg-rose-100 text-rose-700",
};

export function StatCard({
  title,
  value,
  hint,
  icon: Icon,
  tone = "default",
  currency = "EUR",
  className,
  large,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-gradient-to-br p-4 shadow-sm animate-rise",
        toneStyles[tone],
        large && "p-5 sm:p-6",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider opacity-70">
            {title}
          </p>
          <p
            className={cn(
              "mt-2 font-display font-semibold tracking-tight tabular-nums",
              large ? "text-2xl sm:text-3xl" : "text-xl sm:text-2xl"
            )}
          >
            {formatCurrency(value, currency)}
          </p>
          {hint ? (
            <p className="mt-1.5 text-xs opacity-65 leading-snug">{hint}</p>
          ) : null}
        </div>
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            iconTone[tone]
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
