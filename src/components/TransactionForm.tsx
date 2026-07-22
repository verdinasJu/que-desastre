"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { TransactionType } from "@/lib/types";

const TYPES: { value: TransactionType; label: string }[] = [
  { value: "expense", label: "Gasto" },
  { value: "income", label: "Ingreso" },
  { value: "investment", label: "Inversión" },
];

const CATEGORIES: Record<TransactionType, string[]> = {
  expense: ["Comida", "Transporte", "Ocio", "Salud", "Casa", "Otros"],
  income: ["Extra", "Venta", "Regalo", "Otros"],
  investment: ["Fondos", "Acciones", "Crypto", "Otros"],
};

interface TransactionFormProps {
  onSubmit: (values: {
    type: TransactionType;
    amount: number;
    description: string;
    category: string;
    date: string;
  }) => Promise<void> | void;
  loading?: boolean;
  defaultType?: TransactionType;
}

export function TransactionForm({
  onSubmit,
  loading,
  defaultType = "expense",
}: TransactionFormProps) {
  const [type, setType] = useState<TransactionType>(defaultType);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(CATEGORIES[defaultType][0]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

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
    setAmount("");
    setDescription("");
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="min-w-0 space-y-2">
          <Label htmlFor="category">Categoría</Label>
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="flex h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/35"
          >
            {CATEGORIES[type].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-0 space-y-2">
          <Label htmlFor="date">Fecha</Label>
          <Input
            id="date"
            type="date"
            className="input-date w-full"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Guardando…" : "Guardar"}
      </Button>
    </form>
  );
}
