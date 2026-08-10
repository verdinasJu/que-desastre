import type { SupabaseClient } from "@supabase/supabase-js";
import type { FixedExpense, Profile, Transaction } from "@/lib/types";
import { autoFixedDescription } from "@/lib/constants";

function monthStart(year: number, monthIndex: number): string {
  return new Date(year, monthIndex, 1).toISOString().slice(0, 10);
}

function monthEnd(year: number, monthIndex: number): string {
  return new Date(year, monthIndex + 1, 0).toISOString().slice(0, 10);
}

function monthRangeFromIso(iso: string) {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  return { year: d.getFullYear(), month: d.getMonth() };
}

/** Meses inclusivos desde startIso hasta el mes actual. */
function eachMonthUntilNow(startIso: string) {
  const start = monthRangeFromIso(startIso);
  const now = new Date();
  const endYear = now.getFullYear();
  const endMonth = now.getMonth();
  const months: { year: number; month: number }[] = [];
  let y = start.year;
  let m = start.month;
  while (y < endYear || (y === endYear && m <= endMonth)) {
    months.push({ year: y, month: m });
    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
  }
  return months;
}

function hasFixedTxForMonth(
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
 * Crea movimientos de gasto por cada fijo activo, mes a mes, desde el alta
 * (onboarding o creación del fijo) hasta hoy. Así el patrimonio refleja los fijos.
 */
export async function ensureFixedExpenseTransactions(
  supabase: SupabaseClient,
  userId: string,
  profile: Profile,
  fixedExpenses: FixedExpense[],
  existingTransactions?: Transaction[]
): Promise<boolean> {
  const active = fixedExpenses.filter((f) => f.active);
  if (!active.length) return false;

  const onboardedAt =
    profile.onboarding_completed_at ||
    profile.updated_at ||
    profile.created_at;
  if (!onboardedAt) return false;

  const today = new Date().toISOString().slice(0, 10);

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
    const fixedCreated = fixed.created_at || onboardedAt;
    const rangeStart =
      fixedCreated.slice(0, 10) > onboardedAt.slice(0, 10)
        ? fixedCreated
        : onboardedAt;

    for (const { year, month } of eachMonthUntilNow(rangeStart)) {
      const start = monthStart(year, month);
      const end = monthEnd(year, month);
      if (start > today) continue;
      if (hasFixedTxForMonth(txs, fixed.id, start, end)) continue;

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
  }

  return anyCreated;
}
