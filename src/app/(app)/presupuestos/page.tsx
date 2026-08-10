import { createClient } from "@/lib/supabase/server";
import { spentByCategoryThisMonth } from "@/lib/stats";
import { currentMonthRange } from "@/lib/utils";
import { BudgetsClient } from "@/components/BudgetsClient";
import type {
  CategoryBudget,
  Profile,
  SharedBudget,
  Transaction,
} from "@/lib/types";

export default async function PresupuestosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: budgets }, { data: shared }, { data: txs }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", user!.id).single(),
      supabase
        .from("category_budgets")
        .select("*")
        .eq("user_id", user!.id)
        .order("category"),
      supabase
        .from("shared_budgets")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase.from("transactions").select("*").eq("user_id", user!.id),
    ]);

  const { start, end } = currentMonthRange();
  const spentMap = spentByCategoryThisMonth(
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
          Topes personales y compartidos (con código de un solo uso). Los
          compartidos suman los gastos de cada miembro en esa categoría este
          mes.
        </p>
      </header>

      <BudgetsClient
        initialBudgets={(budgets || []) as CategoryBudget[]}
        initialShared={(shared || []) as SharedBudget[]}
        spentByCategory={spentByCategory}
        currency={p?.currency || "EUR"}
        userId={user!.id}
      />
    </div>
  );
}
