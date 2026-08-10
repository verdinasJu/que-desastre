import { createClient } from "@/lib/supabase/server";
import { ensureMonthlyIncome } from "@/lib/auto-income";
import { ensureFixedExpenseTransactions } from "@/lib/auto-fixed-expenses";
import type { FixedExpense, Profile, Transaction } from "@/lib/types";

/** Sincroniza ingreso y gastos fijos automáticos en cada visita a la app. */
export async function AutoFinanceSync() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: fixed }, { data: transactions }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase
        .from("fixed_expenses")
        .select("*")
        .eq("user_id", user.id)
        .eq("active", true),
      supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("date", { ascending: false }),
    ]);

  if (!profile) return null;

  const p = {
    ...(profile as Profile),
    payday_day: (profile as Profile).payday_day ?? 1,
  };
  const txList = (transactions || []) as Transaction[];
  const fixedList = (fixed || []) as FixedExpense[];

  await ensureMonthlyIncome(supabase, user.id, p, txList);
  await ensureFixedExpenseTransactions(
    supabase,
    user.id,
    p,
    fixedList,
    txList
  );

  return null;
}
