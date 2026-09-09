"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { amountToWorkHours, formatWorkHours } from "@/lib/work-hours";
import { mergeCategories } from "@/lib/categories";
import { createClient } from "@/lib/supabase/client";
import type { CustomCategory, Transaction, TransactionType } from "@/lib/types";

const TYPES: { value: TransactionType; label: string }[] = [
  { value: "expense", label: "Gasto" },
  { value: "income", label: "Ingreso" },
  { value: "investment", label: "Inversión" },
];

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
  monthlySalary?: number;
  hoursPerMonth?: number;
}

export function TransactionForm({
  onSubmit,
  loading,
  defaultType = "expense",
  initial,
  submitLabel = "Guardar",
  monthlySalary = 0,
  hoursPerMonth = 160,
}: TransactionFormProps) {
  const startType = initial?.type ?? defaultType;
  const [type, setType] = useState<TransactionType>(startType);
  const [amount, setAmount] = useState(
    initial ? String(initial.amount) : ""
  );
  const [description, setDescription] = useState(initial?.description ?? "");
  const [category, setCategory] = useState(initial?.category ?? "Otros");
  const [date, setDate] = useState(
    initial?.date ?? new Date().toISOString().slice(0, 10)
  );
  const [custom, setCustom] = useState<CustomCategory[]>([]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase.from("custom_categories").select("*");
      setCustom((data || []) as CustomCategory[]);
    }
    load();
  }, []);

  const options = useMemo(() => {
    const names = custom
      .filter((c) => c.type === type)
      .map((c) => c.name);
    return mergeCategories(type, names, category);
  }, [custom, type, category]);

  function changeType(next: TransactionType) {
    setType(next);
    const names = custom
      .filter((c) => c.type === next)
      .map((c) => c.name);
    const opts = mergeCategories(next, names);
    setCategory(opts[0] || "Otros");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const num = Number(amount.replace(",", "."));
    if (!num || num <= 0) return;
    await onSubmit({
      type,
      amount: num,
      description: description.trim() || category.trim() || "Otros",
      category: category.trim() || "Otros",
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
        {type === "expense" &&
        monthlySalary > 0 &&
        Number(amount.replace(",", ".")) > 0 ? (
          <p className="text-xs text-ink-muted">
            ≈{" "}
            {formatWorkHours(
              amountToWorkHours(
                Number(amount.replace(",", ".")),
                monthlySalary,
                hoursPerMonth
              )
            )}{" "}
            (según tu ingreso)
          </p>
        ) : null}
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
          <Input
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Escribe o elige una categoría…"
            required
          />
          <div className="flex flex-wrap gap-1.5">
            {options.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-[11px] font-medium transition",
                  category === c
                    ? "bg-brand text-white"
                    : "bg-surface-2 text-ink-muted hover:text-ink"
                )}
              >
                {c}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-ink-muted">
            Puedes escribir cualquier categoría, no solo las de la lista.
          </p>
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
