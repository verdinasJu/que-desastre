"use client";

import { useCallback, useState } from "react";
import { Bell, AlertTriangle } from "lucide-react";
import type { SpendingAnomaly } from "@/lib/anomalies";
import { formatCurrency, cn } from "@/lib/utils";
import { AppSheet } from "@/components/AppSheet";

export type AlertItem = {
  id: string;
  title: string;
  body: string;
  tone: "warning" | "anomaly";
};

interface AlertsBellProps {
  anomalies: SpendingAnomaly[];
  overBudgetAmount?: number;
  currency?: string;
}

export function AlertsBell({
  anomalies,
  overBudgetAmount = 0,
  currency = "EUR",
}: AlertsBellProps) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  const items: AlertItem[] = [];
  if (overBudgetAmount > 0) {
    items.push({
      id: "over-budget",
      title: "Te has pasado del disponible",
      body: `Llevas ${formatCurrency(overBudgetAmount, currency)} por encima de lo que te quedaba este mes.`,
      tone: "warning",
    });
  }
  for (const a of anomalies) {
    items.push({
      id: `anomaly-${a.category}`,
      title: `Anomalía en ${a.category}`,
      body: `${a.message} Esta semana: ${formatCurrency(a.current, currency)}${
        a.average > 0
          ? ` · media: ${formatCurrency(a.average, currency)}`
          : ""
      }`,
      tone: "anomaly",
    });
  }

  const count = items.length;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line/80 bg-surface/90 text-ink-muted shadow-sm transition",
          "hover:border-brand/25 hover:text-ink",
          count > 0 && "text-ink"
        )}
        aria-label={count > 0 ? `${count} avisos` : "Avisos"}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Bell className="h-5 w-5" />
        {count > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-surface">
            {count > 9 ? "9+" : count}
          </span>
        ) : null}
      </button>

      <AppSheet
        open={open}
        onClose={close}
        title="Avisos"
        subtitle={
          count === 0
            ? "Todo en orden por ahora"
            : `${count} pendiente${count === 1 ? "" : "s"}`
        }
        labelledBy="alerts-title"
      >
        {count === 0 ? (
          <p className="rounded-2xl bg-surface-2 px-4 py-6 text-center text-sm text-ink-muted">
            No hay anomalías ni avisos de presupuesto.
          </p>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className={cn(
                  "flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm",
                  item.tone === "warning"
                    ? "border-amber-200 bg-amber-50 text-amber-950"
                    : "border-violet-200 bg-violet-50 text-violet-950"
                )}
              >
                <AlertTriangle
                  className={cn(
                    "mt-0.5 h-5 w-5 shrink-0",
                    item.tone === "warning"
                      ? "text-amber-600"
                      : "text-violet-600"
                  )}
                />
                <div className="min-w-0">
                  <p className="font-semibold">{item.title}</p>
                  <p
                    className={cn(
                      "mt-0.5 leading-snug",
                      item.tone === "warning"
                        ? "text-amber-900/80"
                        : "text-violet-900/80"
                    )}
                  >
                    {item.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </AppSheet>
    </>
  );
}
