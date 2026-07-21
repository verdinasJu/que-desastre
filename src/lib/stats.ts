import type { FixedExpense, MonthStats, Profile, Transaction } from "./types";

/**
 * Patrimonio total = ahorro inicial + inversiones iniciales + ingresos - gastos
 * Las inversiones NO restan del patrimonio (solo mueven caja → invertido).
 */
export function calcPatrimonio(
  profile: Profile,
  transactions: Transaction[]
): number {
  const income = sumByType(transactions, "income");
  const expense = sumByType(transactions, "expense");
  return (
    profile.initial_savings +
    profile.initial_investments +
    income -
    expense
  );
}

/**
 * Disponible para gastar (mes) =
 * nómina - gastos fijos - inversiones del mes - gastos variables del mes + ingresos del mes
 */
export function calcMonthStats(
  profile: Profile,
  fixedExpenses: FixedExpense[],
  allTransactions: Transaction[],
  monthStart: string,
  monthEnd: string
): MonthStats {
  const monthTx = allTransactions.filter(
    (t) => t.date >= monthStart && t.date <= monthEnd
  );

  const gastosFijosDelMes = fixedExpenses
    .filter((f) => f.active)
    .reduce((acc, f) => acc + Number(f.amount), 0);

  const gastosVariablesDelMes = sumByType(monthTx, "expense");
  const invertidoEsteMes = sumByType(monthTx, "investment");
  const ingresosDelMes = sumByType(monthTx, "income");

  const gastadoEsteMes = gastosFijosDelMes + gastosVariablesDelMes;

  const disponibleParaGastar =
    Number(profile.monthly_salary) +
    ingresosDelMes -
    gastosFijosDelMes -
    invertidoEsteMes -
    gastosVariablesDelMes;

  // Ahorro del mes = lo que queda de la nómina tras gastos e inversiones (sin contar ingresos extra)
  const ahorroDelMes =
    Number(profile.monthly_salary) -
    gastosFijosDelMes -
    invertidoEsteMes -
    gastosVariablesDelMes;

  return {
    patrimonioTotal: calcPatrimonio(profile, allTransactions),
    disponibleParaGastar,
    gastadoEsteMes,
    invertidoEsteMes,
    ahorroDelMes,
    ingresosDelMes,
    gastosFijosDelMes,
    gastosVariablesDelMes,
  };
}

export function sumByType(
  transactions: Transaction[],
  type: Transaction["type"]
): number {
  return transactions
    .filter((t) => t.type === type)
    .reduce((acc, t) => acc + Number(t.amount), 0);
}

export function expensesByCategory(
  fixedExpenses: FixedExpense[],
  variableExpenses: Transaction[]
): { name: string; value: number }[] {
  const map = new Map<string, number>();

  for (const f of fixedExpenses.filter((x) => x.active)) {
    map.set(f.category || "Fijos", (map.get(f.category || "Fijos") || 0) + Number(f.amount));
  }
  for (const t of variableExpenses.filter((x) => x.type === "expense")) {
    const cat = t.category || "Otros";
    map.set(cat, (map.get(cat) || 0) + Number(t.amount));
  }

  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export function monthlyEvolution(
  profile: Profile,
  transactions: Transaction[],
  months = 6
): { month: string; gastado: number; invertido: number; ingresos: number }[] {
  const result: {
    month: string;
    gastado: number;
    invertido: number;
    ingresos: number;
  }[] = [];
  const now = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const start = new Date(d.getFullYear(), d.getMonth(), 1)
      .toISOString()
      .slice(0, 10);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0)
      .toISOString()
      .slice(0, 10);
    const monthTx = transactions.filter((t) => t.date >= start && t.date <= end);
    const label = d.toLocaleDateString("es-ES", {
      month: "short",
      year: "2-digit",
    });
    result.push({
      month: label,
      gastado: sumByType(monthTx, "expense"),
      invertido: sumByType(monthTx, "investment"),
      ingresos: sumByType(monthTx, "income") + Number(profile.monthly_salary),
    });
  }

  return result;
}
