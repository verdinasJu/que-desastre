"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Share2, Copy } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, cn, currentMonthRange } from "@/lib/utils";
import { mergeCategories } from "@/lib/categories";
import { ShareSpendBar, type ShareSpendRow } from "@/components/ShareSpendBar";
import { RedeemInviteCard } from "@/components/RedeemInviteCard";
import type { CategoryBudget, CustomCategory, SharedBudget } from "@/lib/types";
import { EXPENSE_CATEGORIES } from "@/lib/constants";

interface BudgetsClientProps {
  initialBudgets: CategoryBudget[];
  initialShared: SharedBudget[];
  spentByCategory: Record<string, number>;
  currency: string;
  userId: string;
}

export function BudgetsClient({
  initialBudgets,
  initialShared,
  spentByCategory,
  currency,
  userId,
}: BudgetsClientProps) {
  const router = useRouter();
  const [budgets, setBudgets] = useState(initialBudgets);
  const [shared, setShared] = useState(initialShared);
  const [spendMap, setSpendMap] = useState<Record<string, ShareSpendRow[]>>(
    {}
  );
  const [categories, setCategories] = useState<string[]>([
    ...EXPENSE_CATEGORIES,
  ]);
  const [category, setCategory] = useState<string>(EXPENSE_CATEGORIES[0]);
  const [amount, setAmount] = useState("");
  const [sharedCategory, setSharedCategory] = useState<string>(
    EXPENSE_CATEGORIES[0]
  );
  const [sharedAmount, setSharedAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [inviteShown, setInviteShown] = useState<Record<string, string>>({});

  useEffect(() => {
    setBudgets(initialBudgets);
    setShared(initialShared);
  }, [initialBudgets, initialShared]);

  useEffect(() => {
    async function loadCats() {
      const supabase = createClient();
      const { data } = await supabase
        .from("custom_categories")
        .select("*")
        .eq("type", "expense");
      const custom = ((data || []) as CustomCategory[]).map((c) => c.name);
      const merged = mergeCategories("expense", custom);
      setCategories(merged);
      setCategory((prev) => (merged.includes(prev) ? prev : merged[0]));
      setSharedCategory((prev) => (merged.includes(prev) ? prev : merged[0]));
    }
    loadCats();
  }, []);

  useEffect(() => {
    async function loadSpending() {
      if (!shared.length) {
        setSpendMap({});
        return;
      }
      const supabase = createClient();
      const { start, end } = currentMonthRange();
      const next: Record<string, ShareSpendRow[]> = {};
      await Promise.all(
        shared.map(async (b) => {
          const { data, error } = await supabase.rpc("shared_budget_spending", {
            p_budget_id: b.id,
            p_start: start,
            p_end: end,
          });
          if (!error && data) {
            next[b.id] = (data as ShareSpendRow[]).map((r) => ({
              ...r,
              spent: Number(r.spent),
            }));
          } else if (error) {
            toast.error(error.message);
          }
        })
      );
      setSpendMap(next);
    }
    loadSpending();
  }, [shared]);

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

  async function addShared() {
    const num = Number(sharedAmount.replace(",", "."));
    if (!num || num <= 0) {
      toast.error("Importe inválido");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { data: id, error } = await supabase.rpc("create_shared_budget", {
      p_category: sharedCategory,
      p_amount: num,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Presupuesto compartido creado");
    setSharedAmount("");
    setShared((prev) => [
      {
        id: id as string,
        owner_id: userId,
        category: sharedCategory,
        amount: num,
      },
      ...prev,
    ]);
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

  async function removeShared(id: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from("shared_budgets")
      .delete()
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setShared((prev) => prev.filter((b) => b.id !== id));
    toast.success("Eliminado");
    router.refresh();
  }

  async function invite(id: string) {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("create_share_invite", {
      p_resource_type: "budget",
      p_resource_id: id,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    const code = String(data);
    setInviteShown((prev) => ({ ...prev, [id]: code }));
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Código copiado (un solo uso)");
    } catch {
      toast.success(`Código: ${code}`);
    }
  }

  return (
    <div className="space-y-8">
      <section className="space-y-5">
        <div>
          <h2 className="font-display text-xl font-semibold">Tus topes</h2>
          <p className="text-xs text-ink-muted mt-0.5">
            Solo tú. No se comparten.
          </p>
        </div>

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
                {categories.map((c) => (
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
      </section>

      <section className="space-y-5">
        <div>
          <h2 className="font-display text-xl font-semibold">Compartidos</h2>
          <p className="text-xs text-ink-muted mt-0.5">
            Genera un código de un solo uso y pásaselo a la otra persona. Cada
            uno ve cuánto ha gastado (colores distintos).
          </p>
        </div>

        <RedeemInviteCard hint="Si te han pasado un código de presupuesto, únete aquí." />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nuevo presupuesto compartido</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label>Categoría</Label>
              <select
                value={sharedCategory}
                onChange={(e) => setSharedCategory(e.target.value)}
                className="flex h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Tope compartido (€ / mes)</Label>
              <Input
                inputMode="decimal"
                placeholder="400"
                value={sharedAmount}
                onChange={(e) => setSharedAmount(e.target.value)}
              />
            </div>
            <Button className="w-full" onClick={addShared} disabled={loading}>
              <Plus className="h-4 w-4" />
              Crear compartido
            </Button>
          </CardContent>
        </Card>

        {shared.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-surface/60 px-4 py-8 text-center text-sm text-ink-muted">
            Todavía no hay presupuestos compartidos.
          </div>
        ) : (
          <ul className="space-y-3">
            {shared.map((b) => {
              const rows = spendMap[b.id] || [];
              const isOwner = b.owner_id === userId;
              return (
                <li
                  key={b.id}
                  className="rounded-2xl border border-line/80 bg-surface p-4 shadow-sm space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-ink">{b.category}</p>
                      <p className="text-xs text-ink-muted">
                        Tope {formatCurrency(Number(b.amount), currency)} ·
                        compartido
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {isOwner ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => invite(b.id)}
                        >
                          <Share2 className="h-3.5 w-3.5" />
                          Invitar
                        </Button>
                      ) : null}
                      {isOwner ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => removeShared(b.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  {inviteShown[b.id] ? (
                    <div className="flex items-center justify-between gap-2 rounded-xl bg-surface-2 px-3 py-2 text-sm">
                      <span className="font-mono tracking-widest font-semibold">
                        {inviteShown[b.id]}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={async () => {
                          await navigator.clipboard.writeText(inviteShown[b.id]);
                          toast.success("Copiado");
                        }}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : null}
                  <ShareSpendBar
                    rows={rows}
                    limit={Number(b.amount)}
                    currency={currency}
                    currentUserId={userId}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
