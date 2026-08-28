import { createClient } from "@/lib/supabase/server";
import { ensureMonthlyIncome } from "@/lib/auto-income";
import { ensureFixedExpenseTransactions } from "@/lib/auto-fixed-expenses";
import { ensureInvestmentPrices } from "@/lib/auto-investment-prices";
import { currentMonthRange } from "@/lib/utils";
import type { FixedExpense, Profile, Transaction } from "@/lib/types";

const SYNC_TIMEOUT_MS = 12_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("sync timeout")), ms)
    ),
  ]);
}

/** Sincroniza ingreso, fijos y precios de inversiones en cada visita a la app. */
export async function AutoFinanceSync() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { start, end } = currentMonthRange();

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
          .gte("date", start)
          .lte("date", end),
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

    await withTimeout(
      ensureInvestmentPrices(supabase, user.id),
      SYNC_TIMEOUT_MS
    ).catch(() => {
      /* APIs externas lentas: la página carga igual; se reintenta en la próxima visita */
    });

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
  } catch {
    /* No bloquear la app si Supabase o las APIs fallan puntualmente */
  }

  return null;
}
