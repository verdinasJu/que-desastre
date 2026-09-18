import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile, Transaction } from "@/lib/types";
import { AUTO_SALARY_DESCRIPTION } from "@/lib/constants";
import { localISODate } from "@/lib/utils";

/** Fecha UTC que generaba el bug de `toISOString()` a medianoche local. */
function legacyUtcYmd(year: number, monthIndex: number, day: number) {
  return new Date(year, monthIndex, day).toISOString().slice(0, 10);
}

/**
 * Reasigna movimientos automáticos fechados un día antes por el desfase UTC.
 * Si ya existe el movimiento en la fecha correcta, borra el duplicado viejo.
 */
export async function repairTimezoneShiftedAutoDates(
  supabase: SupabaseClient,
  userId: string,
  profile: Profile
): Promise<boolean> {
  const now = new Date();
  const from = localISODate(new Date(now.getFullYear(), now.getMonth() - 12, 1));
  const [{ data: autoFixed }, { data: salaries }] = await Promise.all([
    supabase
      .from("transactions")
      .select("*")
      .eq("user_id", userId)
      .eq("type", "expense")
      .not("fixed_expense_id", "is", null)
      .gte("date", from),
    supabase
      .from("transactions")
      .select("*")
      .eq("user_id", userId)
      .eq("type", "income")
      .eq("description", AUTO_SALARY_DESCRIPTION)
      .gte("date", from),
  ]);

  const txs = [
    ...((autoFixed || []) as Transaction[]),
    ...((salaries || []) as Transaction[]),
  ];
  if (!txs.length) return false;

  const payday = profile.payday_day ?? 1;
  let any = false;

  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    const correctStart = localISODate(new Date(y, m, 1));
    const buggyStart = legacyUtcYmd(y, m, 1);

    if (buggyStart !== correctStart) {
      const shifted = txs.filter(
        (t) => t.type === "expense" && t.fixed_expense_id && t.date === buggyStart
      );
      for (const row of shifted) {
        const already = txs.some(
          (t) =>
            t.id !== row.id &&
            t.fixed_expense_id === row.fixed_expense_id &&
            t.date === correctStart
        );
        if (already) {
          const { error } = await supabase.from("transactions").delete().eq("id", row.id);
          if (!error) any = true;
        } else {
          const { error } = await supabase
            .from("transactions")
            .update({ date: correctStart })
            .eq("id", row.id);
          if (!error) {
            row.date = correctStart;
            any = true;
          }
        }
      }
    }

    const lastDay = new Date(y, m + 1, 0).getDate();
    const day = Math.min(Math.max(payday, 1), Math.min(28, lastDay));
    const correctPay = localISODate(new Date(y, m, day));
    const buggyPay = legacyUtcYmd(y, m, day);
    if (buggyPay === correctPay) continue;

    const monthStart = correctStart;
    const monthEnd = localISODate(new Date(y, m + 1, 0));
    const shiftedSalary = txs.filter(
      (t) =>
        t.type === "income" &&
        t.description === AUTO_SALARY_DESCRIPTION &&
        t.date === buggyPay
    );
    for (const row of shiftedSalary) {
      const already = txs.some(
        (t) =>
          t.id !== row.id &&
          t.type === "income" &&
          t.description === AUTO_SALARY_DESCRIPTION &&
          t.date >= monthStart &&
          t.date <= monthEnd &&
          t.date !== buggyPay
      );
      if (already) {
        const { error } = await supabase.from("transactions").delete().eq("id", row.id);
        if (!error) any = true;
      } else {
        const { error } = await supabase
          .from("transactions")
          .update({ date: correctPay })
          .eq("id", row.id);
        if (!error) {
          row.date = correctPay;
          any = true;
        }
      }
    }
  }

  return any;
}
