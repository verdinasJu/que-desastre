import Link from "next/link";
import {
  PiggyBank,
  Wallet,
  ArrowUpRight,
  TrendingUp,
  Landmark,
  AlertTriangle,
  Calculator,
  ChevronRight,
  Plane,
} from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { DashboardCharts } from "@/components/DashboardCharts";
import { GoalsSection } from "@/components/GoalsSection";
import { AnomalyAlerts } from "@/components/AnomalyAlerts";
import { createClient } from "@/lib/supabase/server";
import { ensureMonthlyIncome } from "@/lib/auto-income";
import { detectSpendingAnomalies } from "@/lib/anomalies";
import {
  calcMonthStats,
  expensesByCategory,
  monthlyEvolution,
} from "@/lib/stats";
import { currentMonthRange, formatCurrency } from "@/lib/utils";
import type {
  FixedExpense,
  Profile,
  SavingsGoal,
  Transaction,
} from "@/lib/types";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: fixed }, { data: transactions }, { data: goals }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", user!.id).single(),
      supabase
        .from("fixed_expenses")
        .select("*")
        .eq("user_id", user!.id)
        .eq("active", true),
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
    ]);

  const p = { ...(profile as Profile), payday_day: (profile as Profile)?.payday_day ?? 1 };
  let txList = (transactions || []) as Transaction[];
  const fixedList = (fixed || []) as FixedExpense[];

  const created = await ensureMonthlyIncome(supabase, user!.id, p, txList);
  if (created) {
    const { data: refreshed } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", user!.id)
      .order("date", { ascending: false });
    txList = (refreshed || []) as Transaction[];
  }

  const { start, end } = currentMonthRange();
  const stats = calcMonthStats(p, fixedList, txList, start, end);
  const monthExpenses = txList.filter(
    (t) => t.type === "expense" && t.date >= start && t.date <= end
  );
  const byCategory = expensesByCategory(fixedList, monthExpenses);
  const evolution = monthlyEvolution(p, txList, 6);
  const monthLabel = new Date().toLocaleDateString("es-ES", {
    month: "long",
    year: "numeric",
  });
  const overBudget = stats.disponibleParaGastar < 0;
  const anomalies = detectSpendingAnomalies(txList);

  return (
    <div className="space-y-6">
      <header className="animate-rise space-y-1">
        <p className="font-display text-3xl font-semibold tracking-tight text-ink">
          Que Desastre
        </p>
        <p className="text-sm text-ink-muted capitalize">
          Resumen de {monthLabel}
        </p>
      </header>

      {overBudget ? (
        <div className="animate-rise flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="font-semibold">Te has pasado del disponible</p>
            <p className="mt-0.5 text-amber-900/80 leading-snug">
              Llevas{" "}
              {formatCurrency(
                Math.abs(stats.disponibleParaGastar),
                p.currency
              )}{" "}
              por encima de lo que te quedaba este mes. Revisa gastos o
              presupuestos.
            </p>
          </div>
        </div>
      ) : null}

      <AnomalyAlerts anomalies={anomalies} currency={p.currency} />

      <section className="grid gap-3 sm:grid-cols-2">
        <StatCard
          large
          title="Patrimonio total"
          value={stats.patrimonioTotal}
          hint="Ahorro + inversiones + ingresos − gastos (las inversiones no restan aquí)"
          icon={Landmark}
          tone="accent"
          className="sm:col-span-2"
          currency={p.currency}
        />
        <StatCard
          title="Disponible para gastar"
          value={stats.disponibleParaGastar}
          hint="Ingreso del mes − fijos − inversiones − gastos + extras"
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
          hint="Lo que queda de tu ingreso mensual tras gastos e inversiones"
          icon={PiggyBank}
          tone={stats.ahorroDelMes >= 0 ? "positive" : "warning"}
          currency={p.currency}
        />
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/calculadora"
          className="animate-rise flex items-center gap-3 rounded-2xl border border-teal-100 bg-gradient-to-br from-teal-50 to-sky-50 px-4 py-4 shadow-sm transition hover:border-brand/30"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
            <Calculator className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-ink">Interés compuesto</p>
            <p className="text-xs text-ink-muted leading-snug">
              Simula el crecimiento de tus inversiones
            </p>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-ink-faint" />
        </Link>
        <Link
          href="/viajes"
          className="animate-rise flex items-center gap-3 rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 to-indigo-50 px-4 py-4 shadow-sm transition hover:border-sky-300"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
            <Plane className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-ink">Modo viaje</p>
            <p className="text-xs text-ink-muted leading-snug">
              Presupuesto y gastos por fechas de viaje
            </p>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-ink-faint" />
        </Link>
      </div>

      <GoalsSection
        initialGoals={(goals || []) as SavingsGoal[]}
        currency={p.currency}
      />

      <DashboardCharts
        evolution={evolution}
        byCategory={byCategory}
        currency={p.currency}
      />
    </div>
  );
}
