"use client";

import {
  ArrowDownLeft,
  ArrowUpRight,
  TrendingUp,
  Trash2,
  Pencil,
} from "lucide-react";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import type { Transaction } from "@/lib/types";
import { Button } from "@/components/ui/button";

interface TransactionListProps {
  items: Transaction[];
  currency?: string;
  onDelete?: (id: string) => void;
  onEdit?: (tx: Transaction) => void;
}

const meta = {
  expense: {
    label: "Gasto",
    icon: ArrowUpRight,
    className: "bg-rose-100 text-rose-700",
    amount: "text-rose-700",
    sign: "-",
  },
  income: {
    label: "Ingreso",
    icon: ArrowDownLeft,
    className: "bg-emerald-100 text-emerald-700",
    amount: "text-emerald-700",
    sign: "+",
  },
  investment: {
    label: "Inversión",
    icon: TrendingUp,
    className: "bg-sky-100 text-sky-700",
    amount: "text-sky-700",
    sign: "→",
  },
} as const;

export function TransactionList({
  items,
  currency = "EUR",
  onDelete,
  onEdit,
}: TransactionListProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line bg-surface/50 px-4 py-10 text-center">
        <p className="text-sm text-ink-muted">
          No hay movimientos con estos filtros.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((t) => {
        const m = meta[t.type];
        const Icon = m.icon;
        return (
          <li
            key={t.id}
            className="flex items-center gap-2 rounded-2xl border border-line/70 bg-surface px-3 py-3 shadow-sm"
          >
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                m.className
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
            <button
              type="button"
              className="min-w-0 flex-1 text-left"
              onClick={() => onEdit?.(t)}
              disabled={!onEdit}
            >
              <p className="truncate text-sm font-semibold text-ink">
                {t.description || t.category}
              </p>
              <p className="text-xs text-ink-muted">
                {m.label} · {t.category} · {formatDate(t.date)}
              </p>
            </button>
            <div className="flex items-center gap-0.5">
              <span
                className={cn(
                  "text-sm font-semibold tabular-nums",
                  m.amount
                )}
              >
                {m.sign}
                {formatCurrency(Number(t.amount), currency)}
              </span>
              {onEdit ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-ink-faint hover:text-brand"
                  onClick={() => onEdit(t)}
                  aria-label="Editar"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              ) : null}
              {onDelete ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-ink-faint hover:text-rose-600"
                  onClick={() => onDelete(t.id)}
                  aria-label="Eliminar"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
