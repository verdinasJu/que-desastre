import type { SupabaseClient } from "@supabase/supabase-js";
import type { FixedExpense, Profile, Transaction } from "@/lib/types";
import { autoFixedDescription } from "@/lib/constants";
import {
  isFixedFullyPaidManually,
  manualFixedPaymentsForMonth,
} from "@/lib/fixed-expense-utils";
import { currentMonthRange } from "@/lib/utils";

function hasAutoFixedForMonth(
  txs: Transaction[],
  fixedId: string,
  start: string,
  end: string
) {
  return txs.some(
    (t) =>
      t.type === "expense" &&
      t.fixed_expense_id === fixedId &&
      t.date >= start &&
      t.date <= end
  );
}

/**
 * Crea el movimiento del mes en curso por cada fijo activo (día 1).
 * Si hay un pago manual parcial (ej. alquiler 87,50 € de 325 €), no duplica:
 * el resto se refleja en patrimonio vía devengo en stats.
 */
export async function ensureFixedExpenseTransactions(
  supabase: SupabaseClient,
  userId: string,
  _profile: Profile,
  fixedExpenses: FixedExpense[],
  existingTransactions?: Transaction[]
): Promise<boolean> {
  const active = fixedExpenses.filter((f) => f.active);
  if (!active.length) return false;

  const { start, end } = currentMonthRange();

  let txs = existingTransactions;
  if (!txs) {
    const { data } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", userId);
    txs = (data || []) as Transaction[];
  }

  let anyCreated = false;

  for (const fixed of active) {
    if (isFixedFullyPaidManually(txs, fixed, start, end)) {
      const dupAuto: Transaction[] = txs.filter(
        (t) =>
          t.type === "expense" &&
          t.fixed_expense_id === fixed.id &&
          t.date >= start &&
          t.date <= end
      );
      for (const row of dupAuto) {
        await supabase.from("transactions").delete().eq("id", row.id);
      }
      if (dupAuto.length) {
        txs = txs.filter((t) => !dupAuto.some((d) => d.id === t.id));
      }
      continue;
    }

    const manualPaid = manualFixedPaymentsForMonth(txs, fixed, start, end);
    if (manualPaid > 0 && manualPaid < Number(fixed.amount) * 0.9) {
      continue;
    }

    if (hasAutoFixedForMonth(txs, fixed.id, start, end)) continue;

    const { data, error } = await supabase
      .from("transactions")
      .insert({
        user_id: userId,
        type: "expense",
        amount: Number(fixed.amount),
        description: autoFixedDescription(fixed.name),
        category: fixed.category || "Fijos",
        date: start,
        fixed_expense_id: fixed.id,
      })
      .select()
      .single();

    if (!error && data) {
      anyCreated = true;
      txs = [...txs, data as Transaction];
    }
  }

  return anyCreated;
}
