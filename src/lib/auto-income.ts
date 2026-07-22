import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile, Transaction } from "@/lib/types";
import {
  AUTO_SALARY_CATEGORY,
  AUTO_SALARY_DESCRIPTION,
} from "@/lib/constants";
import { currentMonthRange } from "@/lib/utils";

function paydayDateForMonth(
  year: number,
  monthIndex: number,
  paydayDay: number
) {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  const day = Math.min(Math.max(paydayDay, 1), Math.min(28, lastDay));
  const d = new Date(year, monthIndex, day);
  return d.toISOString().slice(0, 10);
}

/**
 * Si ya ha llegado el día de cobro del mes y no existe el ingreso automático,
 * lo inserta una sola vez.
 */
export async function ensureMonthlyIncome(
  supabase: SupabaseClient,
  userId: string,
  profile: Profile,
  existingTransactions?: Transaction[]
): Promise<boolean> {
  const salary = Number(profile.monthly_salary);
  if (!salary || salary <= 0) return false;

  const payday = profile.payday_day ?? 1;
  const now = new Date();
  const payDate = paydayDateForMonth(
    now.getFullYear(),
    now.getMonth(),
    payday
  );
  const today = now.toISOString().slice(0, 10);
  if (today < payDate) return false;

  const { start, end } = currentMonthRange();

  let already = false;
  if (existingTransactions) {
    already = existingTransactions.some(
      (t) =>
        t.type === "income" &&
        t.date >= start &&
        t.date <= end &&
        t.description === AUTO_SALARY_DESCRIPTION
    );
  } else {
    const { data } = await supabase
      .from("transactions")
      .select("id")
      .eq("user_id", userId)
      .eq("type", "income")
      .eq("description", AUTO_SALARY_DESCRIPTION)
      .gte("date", start)
      .lte("date", end)
      .limit(1);
    already = Boolean(data?.length);
  }

  if (already) return false;

  const { error } = await supabase.from("transactions").insert({
    user_id: userId,
    type: "income",
    amount: salary,
    description: AUTO_SALARY_DESCRIPTION,
    category: AUTO_SALARY_CATEGORY,
    date: payDate,
  });

  return !error;
}
