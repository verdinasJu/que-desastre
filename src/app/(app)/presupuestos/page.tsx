import { createClient } from "@/lib/supabase/server";
import { spentByCategoryThisMonth } from "@/lib/stats";
import { currentMonthRange } from "@/lib/utils";
import { BudgetsClient } from "@/components/BudgetsClient";
import type {
  CategoryBudget,
  FixedExpense,
  Profile,
  Transaction,
} from "@/lib/types";

export default async function PresupuestosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: budgets }, { data: fixed }, { data: txs }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", user!.id).single(),
      supabase
        .from("category_budgets")
        .select("*")
        .eq("user_id", user!.id)
        .order("category"),
      supabase
        .from("fixed_expenses")
        .select("*")
        .eq("user_id", user!.id)
        .eq("active", true),
      supabase.from("transactions").select("*").eq("user_id", user!.id),
    ]);

  const { start, end } = currentMonthRange();
  const spentMap = spentByCategoryThisMonth(
    (fixed || []) as FixedExpense[],
    (txs || []) as Transaction[],
    start,
    end
  );
  const spentByCategory = Object.fromEntries(spentMap.entries());
  const p = profile as Profile;

  return (
    <div className="space-y-5">
      <header className="animate-rise space-y-2">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Presupuestos
        </h1>
        <p className="text-sm leading-relaxed text-ink-muted">
          Pon un tope mensual por categoría (ej. Comida 200 €). Aquí solo se
          comparan tus gastos de <span className="font-medium text-ink">este
          mes</span> (fijos + variables) con ese tope. No afecta al patrimonio:
          es una guía para no pasarte.
        </p>
      </header>

      <BudgetsClient
        initialBudgets={(budgets || []) as CategoryBudget[]}
        spentByCategory={spentByCategory}
        currency={p?.currency || "EUR"}
      />
    </div>
  );
}
