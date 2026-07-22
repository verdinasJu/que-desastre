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

/** Primera fecha de cobro ESTRICTAMENTE posterior a la fecha de onboarding. */
export function firstPaydayAfter(
  afterDateIso: string,
  paydayDay: number
): string {
  const after = afterDateIso.slice(0, 10);
  const base = new Date(`${after}T12:00:00`);
  let year = base.getFullYear();
  let month = base.getMonth();

  for (let i = 0; i < 3; i++) {
    const candidate = paydayDateForMonth(year, month, paydayDay);
    if (candidate > after) return candidate;
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }

  return paydayDateForMonth(year, month, paydayDay);
}

/**
 * Registra el ingreso automático solo cuando llega un día de cobro
 * posterior al onboarding. No suma nada en el momento de configurar la cuenta.
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
  const onboardedAt =
    profile.onboarding_completed_at ||
    profile.updated_at ||
    profile.created_at;
  if (!onboardedAt) return false;

  const firstAllowed = firstPaydayAfter(onboardedAt, payday);
  const now = new Date();
  const payDate = paydayDateForMonth(
    now.getFullYear(),
    now.getMonth(),
    payday
  );
  const today = now.toISOString().slice(0, 10);

  // Aún no llega el cobro de este mes, o este cobro es anterior/igual al alta
  if (today < payDate) return false;
  if (payDate < firstAllowed) return false;

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
