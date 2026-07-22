"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, cn } from "@/lib/utils";
import type { CategoryBudget } from "@/lib/types";
import { EXPENSE_CATEGORIES } from "@/lib/constants";

interface BudgetsClientProps {
  initialBudgets: CategoryBudget[];
  spentByCategory: Record<string, number>;
  currency: string;
}

export function BudgetsClient({
  initialBudgets,
  spentByCategory,
  currency,
}: BudgetsClientProps) {
  const router = useRouter();
  const [budgets, setBudgets] = useState(initialBudgets);
  const [category, setCategory] = useState<string>(EXPENSE_CATEGORIES[0]);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  async function addBudget() {
    const num = Number(amount.replace(",", "."));
    if (!num || num <= 0) return;
    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("category_budgets")
      .upsert(
        {
          user_id: user.id,
          category,
          amount: num,
        },
        { onConflict: "user_id,category" }
      )
      .select()
      .single();

    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }

    setBudgets((prev) => {
      const rest = prev.filter((b) => b.category !== category);
      return [...rest, data as CategoryBudget].sort((a, b) =>
        a.category.localeCompare(b.category)
      );
    });
    setAmount("");
    toast.success("Presupuesto guardado");
    router.refresh();
  }

  async function removeBudget(id: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from("category_budgets")
      .delete()
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setBudgets((prev) => prev.filter((b) => b.id !== id));
    toast.success("Eliminado");
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nuevo tope mensual</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="budget-cat">Categoría</Label>
            <select
              id="budget-cat"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="flex h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm"
            >
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="budget-amount">Tope (€ / mes)</Label>
            <Input
              id="budget-amount"
              inputMode="decimal"
              placeholder="200"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <Button className="w-full" onClick={addBudget} disabled={loading}>
            <Plus className="h-4 w-4" />
            {loading ? "Guardando…" : "Guardar presupuesto"}
          </Button>
        </CardContent>
      </Card>

      {budgets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-surface/60 px-4 py-10 text-center text-sm text-ink-muted">
          Aún no tienes presupuestos. Crea uno (ej. Comida 200 €) y verás aquí
          cuánto llevas gastado.
        </div>
      ) : (
        <ul className="space-y-3">
          {budgets.map((b) => {
            const spent = spentByCategory[b.category] || 0;
            const limit = Number(b.amount);
            const pct = Math.min(100, Math.round((spent / limit) * 100));
            const over = spent > limit;
            return (
              <li
                key={b.id}
                className="rounded-2xl border border-line/80 bg-surface p-4 shadow-sm"
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-ink">{b.category}</p>
                    <p className="text-xs text-ink-muted">
                      {formatCurrency(spent, currency)} de{" "}
                      {formatCurrency(limit, currency)}
                      {over ? " · te has pasado" : ""}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => removeBudget(b.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-surface-3">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      over
                        ? "bg-rose-500"
                        : pct >= 80
                          ? "bg-amber-500"
                          : "bg-brand"
                    )}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
                <p
                  className={cn(
                    "mt-1.5 text-right text-xs font-medium tabular-nums",
                    over ? "text-rose-600" : "text-ink-muted"
                  )}
                >
                  {pct}%
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
