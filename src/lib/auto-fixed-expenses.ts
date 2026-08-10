import type { SupabaseClient } from "@supabase/supabase-js";
import type { FixedExpense, Profile, Transaction } from "@/lib/types";
import { autoFixedDescription } from "@/lib/constants";
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

/** Evita duplicar un fijo ya registrado a mano en el mismo mes. */
function hasManualFixedDuplicate(
  txs: Transaction[],
  fixed: FixedExpense,
  start: string,
  end: string
) {
  const name = fixed.name.toLowerCase();
  const amount = Number(fixed.amount);

  return txs.some((t) => {
    if (t.type !== "expense" || t.fixed_expense_id) return false;
    if (t.date < start || t.date > end) return false;

    const desc = t.description.toLowerCase();
    if (desc.includes(name) || name.includes(desc.slice(0, 4))) return true;

    // Alquiler / renta parcial registrada a mano
    if (
      (name.includes("alquiler") || name.includes("renta")) &&
      (desc.includes("alqu") || desc.includes("renta") || desc.includes("alquier"))
    ) {
      return true;
    }

    // Mismo importe y categoría (ej. Netflix 9 € vs 8,99 € manual)
    if (
      t.category === fixed.category &&
      Math.abs(Number(t.amount) - amount) <= 1
    ) {
      return true;
    }

    return false;
  });
}

/**
 * Crea el movimiento del mes en curso por cada fijo activo (día 1).
 * Sin backfill histórico: evita desajustar patrimonios ya consolidados.
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
    if (hasManualFixedDuplicate(txs, fixed, start, end)) {
      // Si ya había auto-fijo pero el usuario lo registró a mano, quitar el auto
      const dupAuto = txs.filter(
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
