import {
  PiggyBank,
  Wallet,
  ArrowUpRight,
  TrendingUp,
  Landmark,
} from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { DashboardCharts } from "@/components/DashboardCharts";
import { GoalsSection } from "@/components/GoalsSection";
import { AlertsBell } from "@/components/AlertsBell";
import { MonthSwitcher } from "@/components/MonthSwitcher";
import { createClient } from "@/lib/supabase/server";
import { detectSpendingAnomalies } from "@/lib/anomalies";
import {
  calcMonthStats,
  monthlyEvolution,
} from "@/lib/stats";
import { expensesByCategoryForMonth } from "@/lib/fixed-expense-utils";
import { formatCurrency, monthRangeFromKey } from "@/lib/utils";
import type {
  FixedExpense,
  InvestmentPosition,
  Profile,
  SavingsGoal,
  Transaction,
} from "@/lib/types";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: { month?: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { data: profile },
    { data: transactions },
    { data: goals },
    { data: fixed },
    { data: positions },
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user!.id).single(),
    supabase
      .from("transactions")
      .select("*")
      .eq("user_id", user!.id)
      .order("date", { ascending: false }),
    supabase
      .from("savings_goals")
      .select("*")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("fixed_expenses")
      .select("*")
      .eq("user_id", user!.id)
      .eq("active", true),
    supabase
      .from("investment_positions")
      .select("*")
      .eq("user_id", user!.id),
  ]);

  const p = { ...(profile as Profile), payday_day: (profile as Profile)?.payday_day ?? 1 };
  const txList = (transactions || []) as Transaction[];
  const fixedList = (fixed || []) as FixedExpense[];
  const positionList = (positions || []) as InvestmentPosition[];

  const month = monthRangeFromKey(searchParams?.month);
  const { start, end, key, label, isCurrent } = month;

  const stats = calcMonthStats(p, txList, start, end, fixedList, positionList);
  const monthExpenses = txList.filter(
    (t) => t.type === "expense" && t.date >= start && t.date <= end
  );
  const byCategory = expensesByCategoryForMonth(
    monthExpenses,
    fixedList,
    start,
    end
  );
  const evolution = monthlyEvolution(
    p,
    txList,
    6,
    new Date(month.year, month.monthIndex, 1)
  );
  const overBudgetAmount =
    isCurrent && stats.disponibleParaGastar < 0
      ? Math.abs(stats.disponibleParaGastar)
      : 0;
  const anomalies = isCurrent ? detectSpendingAnomalies(txList) : [];

  return (
    <div className="space-y-6">
      <header className="animate-rise flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <p className="font-display text-3xl font-semibold tracking-tight text-ink">
            Que Desastre
          </p>
          <p className="text-sm text-ink-muted">
            {isCurrent ? "Resumen del mes en curso" : "Resumen histórico"}
          </p>
        </div>
        <AlertsBell
          anomalies={anomalies}
          overBudgetAmount={overBudgetAmount}
          currency={p.currency}
        />
      </header>

      <MonthSwitcher monthKey={key} label={label} isCurrent={isCurrent} />

      <section className="grid gap-3 sm:grid-cols-2">
        <StatCard
          large
          title="Patrimonio total"
          value={stats.patrimonioTotal}
          hint={
            isCurrent
              ? "Ahorro + cartera + ingresos − gastos − fijos pendientes"
              : "Patrimonio actual (la cartera usa precios de hoy)"
          }
          icon={Landmark}
          tone="accent"
          className="sm:col-span-2"
          currency={p.currency}
        />
        <StatCard
          title="Disponible para gastar"
          value={stats.disponibleParaGastar}
          hint={`Ingresos de ${label} − fijos − inversiones − gastos`}
          icon={Wallet}
          tone={stats.disponibleParaGastar >= 0 ? "positive" : "danger"}
          currency={p.currency}
        />
        <StatCard
          title="Gastado este mes"
          value={stats.gastadoEsteMes}
          hint={`Fijos ${formatCurrency(stats.gastosFijosDelMes)} + variables ${formatCurrency(stats.gastosVariablesDelMes)}`}
          icon={ArrowUpRight}
          tone="danger"
          currency={p.currency}
        />
        <StatCard
          title="Invertido este mes"
          value={stats.invertidoEsteMes}
          hint="Sigue siendo tuyo: no es un gasto perdido"
          icon={TrendingUp}
          tone="accent"
          currency={p.currency}
        />
        <StatCard
          title="Ahorro del mes"
          value={stats.ahorroDelMes}
          hint="Nómina + extras − fijos − inversiones − gastos del mes"
          icon={PiggyBank}
          tone={stats.ahorroDelMes >= 0 ? "positive" : "warning"}
          currency={p.currency}
        />
      </section>

      {isCurrent ? (
        <GoalsSection
          initialGoals={(goals || []) as SavingsGoal[]}
          currency={p.currency}
        />
      ) : null}

      <DashboardCharts
        evolution={evolution}
        byCategory={byCategory}
        monthExpenses={monthExpenses}
        fixedExpenses={fixedList}
        monthStart={start}
        monthEnd={end}
        currency={p.currency}
      />
    </div>
  );
}
