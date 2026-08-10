import { createClient } from "@/lib/supabase/server";
import { ensureMonthlyIncome } from "@/lib/auto-income";
import { ensureFixedExpenseTransactions } from "@/lib/auto-fixed-expenses";
import { ensureInvestmentPrices } from "@/lib/auto-investment-prices";
import type { FixedExpense, Profile, Transaction } from "@/lib/types";

/** Sincroniza ingreso, fijos y precios de inversiones en cada visita a la app. */
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
  await ensureInvestmentPrices(supabase, user.id);

  // Si ya hay cartera, limpiar el legado "inversión inicial" para no duplicar
  const { data: positions } = await supabase
    .from("investment_positions")
    .select("id")
    .eq("user_id", user.id)
    .limit(1);

  if (
    positions?.length &&
    Number((profile as Profile).initial_investments) > 0
  ) {
    await supabase
      .from("profiles")
      .update({
        initial_investments: 0,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);
  }

  return null;
}
