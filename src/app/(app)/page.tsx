import {
  PiggyBank,
  Wallet,
  ArrowUpRight,
  TrendingUp,
  Landmark,
} from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { DashboardCharts } from "@/components/DashboardCharts";
import { createClient } from "@/lib/supabase/server";
import {
  calcMonthStats,
  expensesByCategory,
  monthlyEvolution,
} from "@/lib/stats";
import { currentMonthRange, formatCurrency } from "@/lib/utils";
import type { FixedExpense, Profile, Transaction } from "@/lib/types";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: fixed }, { data: transactions }] =
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
    ]);

  const p = profile as Profile;
  const fixedList = (fixed || []) as FixedExpense[];
  const txList = (transactions || []) as Transaction[];
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
          hint="Nómina − fijos − inversiones − gastos + ingresos del mes"
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
          hint="Lo que queda de la nómina tras gastos e inversiones"
          icon={PiggyBank}
          tone={stats.ahorroDelMes >= 0 ? "positive" : "warning"}
          currency={p.currency}
        />
      </section>

      <DashboardCharts
        evolution={evolution}
        byCategory={byCategory}
        currency={p.currency}
      />
    </div>
  );
}
