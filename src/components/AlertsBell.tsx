"use client";

import { useEffect, useState } from "react";
import { Bell, AlertTriangle, X } from "lucide-react";
import type { SpendingAnomaly } from "@/lib/anomalies";
import { formatCurrency, cn } from "@/lib/utils";

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

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

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

      {open ? (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="alerts-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-ink/45 backdrop-blur-[2px] animate-in fade-in-0"
            aria-label="Cerrar avisos"
            onClick={() => setOpen(false)}
          />
          <div className="relative z-10 w-full max-w-lg animate-in fade-in-0 slide-in-from-bottom-4 duration-200 sm:mx-4 sm:zoom-in-95 sm:slide-in-from-bottom-0">
            <div className="rounded-t-[1.75rem] border border-line bg-surface shadow-2xl sm:rounded-3xl">
              <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-line sm:hidden" />
              <div className="flex items-center justify-between px-5 pb-2 pt-3 sm:pt-5">
                <div>
                  <p
                    id="alerts-title"
                    className="font-display text-xl font-semibold tracking-tight text-ink"
                  >
                    Avisos
                  </p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {count === 0
                      ? "Todo en orden por ahora"
                      : `${count} pendiente${count === 1 ? "" : "s"}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-xl p-2 text-ink-muted transition hover:bg-surface-2 hover:text-ink"
                  aria-label="Cerrar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="max-h-[min(60vh,28rem)] space-y-2 overflow-y-auto p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
                {count === 0 ? (
                  <p className="rounded-2xl bg-surface-2 px-4 py-6 text-center text-sm text-ink-muted">
                    No hay anomalías ni avisos de presupuesto.
                  </p>
                ) : (
                  items.map((item) => (
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
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
