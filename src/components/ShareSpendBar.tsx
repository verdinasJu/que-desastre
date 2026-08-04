"use client";

import { formatCurrency, cn } from "@/lib/utils";

export type ShareSpendRow = {
  user_id: string;
  label: string;
  color: string;
  spent: number;
};

interface ShareSpendBarProps {
  rows: ShareSpendRow[];
  limit: number;
  currency?: string;
  currentUserId?: string;
}

export function ShareSpendBar({
  rows,
  limit,
  currency = "EUR",
  currentUserId,
}: ShareSpendBarProps) {
  const total = rows.reduce((a, r) => a + Number(r.spent), 0);
  const over = limit > 0 && total > limit;
  const pctTotal =
    limit > 0 ? Math.min(100, Math.round((total / limit) * 100)) : 0;

  return (
    <div className="space-y-2">
      <div className="h-3 overflow-hidden rounded-full bg-surface-3 flex">
        {limit > 0
          ? rows.map((r) => {
              const w = Math.max(
                0,
                Math.min(100, (Number(r.spent) / limit) * 100)
              );
              if (w <= 0) return null;
              return (
                <div
                  key={r.user_id}
                  className="h-full transition-all"
                  style={{ width: `${w}%`, backgroundColor: r.color }}
                  title={`${r.label}: ${formatCurrency(Number(r.spent), currency)}`}
                />
              );
            })
          : null}
      </div>
      <ul className="flex flex-wrap gap-x-3 gap-y-1">
        {rows.map((r) => {
          const mine = currentUserId && r.user_id === currentUserId;
          return (
            <li
              key={r.user_id}
              className="inline-flex items-center gap-1.5 text-xs text-ink-muted"
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: r.color }}
              />
              <span className={cn(mine && "font-semibold text-ink")}>
                {mine ? "Tú" : r.label}
              </span>
              <span className="tabular-nums">
                {formatCurrency(Number(r.spent), currency)}
              </span>
            </li>
          );
        })}
      </ul>
      {limit > 0 ? (
        <p
          className={cn(
            "text-right text-xs tabular-nums",
            over ? "font-medium text-rose-600" : "text-ink-muted"
          )}
        >
          Total {formatCurrency(total, currency)} /{" "}
          {formatCurrency(limit, currency)} ({pctTotal}%)
          {over ? " · pasados" : ""}
        </p>
      ) : null}
    </div>
  );
}
