"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { Transaction, TransactionType } from "@/lib/types";
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  INVESTMENT_CATEGORIES,
} from "@/lib/constants";

const TYPES: { value: TransactionType; label: string }[] = [
  { value: "expense", label: "Gasto" },
  { value: "income", label: "Ingreso" },
  { value: "investment", label: "Inversión" },
];

const CATEGORIES: Record<TransactionType, readonly string[]> = {
  expense: EXPENSE_CATEGORIES,
  income: INCOME_CATEGORIES,
  investment: INVESTMENT_CATEGORIES,
};

export type TransactionFormValues = {
  type: TransactionType;
  amount: number;
  description: string;
  category: string;
  date: string;
};

interface TransactionFormProps {
  onSubmit: (values: TransactionFormValues) => Promise<void> | void;
  loading?: boolean;
  defaultType?: TransactionType;
  initial?: Transaction | null;
  submitLabel?: string;
}

function categoriesFor(
  type: TransactionType,
  current?: string
): string[] {
  const base = [...CATEGORIES[type]];
  if (current && !base.includes(current)) base.unshift(current);
  return base;
}

export function TransactionForm({
  onSubmit,
  loading,
  defaultType = "expense",
  initial,
  submitLabel = "Guardar",
}: TransactionFormProps) {
  const startType = initial?.type ?? defaultType;
  const [type, setType] = useState<TransactionType>(startType);
  const [amount, setAmount] = useState(
    initial ? String(initial.amount) : ""
  );
  const [description, setDescription] = useState(initial?.description ?? "");
  const [category, setCategory] = useState(
    initial?.category ?? CATEGORIES[startType][0]
  );
  const [date, setDate] = useState(
    initial?.date ?? new Date().toISOString().slice(0, 10)
  );

  function changeType(next: TransactionType) {
    setType(next);
    setCategory(CATEGORIES[next][0]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const num = Number(amount.replace(",", "."));
    if (!num || num <= 0) return;
    await onSubmit({
      type,
      amount: num,
      description: description.trim() || category,
      category,
      date,
    });
    if (!initial) {
      setAmount("");
      setDescription("");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => changeType(t.value)}
            className={cn(
              "rounded-xl border px-2 py-2.5 text-sm font-semibold transition",
              type === t.value
                ? "border-brand bg-brand/10 text-brand"
                : "border-line text-ink-muted hover:bg-surface-2"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        <Label htmlFor="amount">Importe (€)</Label>
        <Input
          id="amount"
          inputMode="decimal"
          placeholder="0,00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
          autoFocus
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Descripción</Label>
        <Input
          id="description"
          placeholder="Ej. Mercado, Uber, ingreso extra…"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="space-y-3">
        <div className="min-w-0 space-y-2">
          <Label htmlFor="category">Categoría</Label>
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="flex h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/35"
          >
            {categoriesFor(type, category).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-0 space-y-2">
          <Label htmlFor="date">Fecha</Label>
          <DateInput
            id="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Guardando…" : submitLabel}
      </Button>
    </form>
  );
}
