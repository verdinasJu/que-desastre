import type { FixedExpense, MonthStats, Profile, Transaction } from "./types";
import { AUTO_SALARY_DESCRIPTION } from "./constants";

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
 * ingreso base del mes + otros ingresos − fijos − inversiones − gastos variables
 *
 * Ingreso base = ingreso automático si ya se generó, si no la cifra configurada
 * (para no contar dos veces nómina + ingreso automático).
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

  const autoIncome = monthTx
    .filter(
      (t) =>
        t.type === "income" && t.description === AUTO_SALARY_DESCRIPTION
    )
    .reduce((acc, t) => acc + Number(t.amount), 0);

  const otherIncome = monthTx
    .filter(
      (t) =>
        t.type === "income" && t.description !== AUTO_SALARY_DESCRIPTION
    )
    .reduce((acc, t) => acc + Number(t.amount), 0);

  const ingresoBaseDelMes =
    autoIncome > 0 ? autoIncome : Number(profile.monthly_salary);

  const ingresosDelMes = autoIncome + otherIncome;

  const gastadoEsteMes = gastosFijosDelMes + gastosVariablesDelMes;

  const disponibleParaGastar =
    ingresoBaseDelMes +
    otherIncome -
    gastosFijosDelMes -
    invertidoEsteMes -
    gastosVariablesDelMes;

  const ahorroDelMes =
    ingresoBaseDelMes -
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
    ingresoBaseDelMes,
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
    map.set(
      f.category || "Fijos",
      (map.get(f.category || "Fijos") || 0) + Number(f.amount)
    );
  }
  for (const t of variableExpenses.filter((x) => x.type === "expense")) {
    const cat = t.category || "Otros";
    map.set(cat, (map.get(cat) || 0) + Number(t.amount));
  }

  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export function spentByCategoryThisMonth(
  fixedExpenses: FixedExpense[],
  transactions: Transaction[],
  monthStart: string,
  monthEnd: string
): Map<string, number> {
  const map = new Map<string, number>();
  for (const f of fixedExpenses.filter((x) => x.active)) {
    const cat = f.category || "Fijos";
    map.set(cat, (map.get(cat) || 0) + Number(f.amount));
  }
  for (const t of transactions) {
    if (
      t.type === "expense" &&
      t.date >= monthStart &&
      t.date <= monthEnd
    ) {
      const cat = t.category || "Otros";
      map.set(cat, (map.get(cat) || 0) + Number(t.amount));
    }
  }
  return map;
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
    const auto = monthTx
      .filter(
        (t) =>
          t.type === "income" && t.description === AUTO_SALARY_DESCRIPTION
      )
      .reduce((a, t) => a + Number(t.amount), 0);
    const other = sumByType(monthTx, "income") - auto;
    result.push({
      month: label,
      gastado: sumByType(monthTx, "expense"),
      invertido: sumByType(monthTx, "investment"),
      ingresos: (auto > 0 ? auto : Number(profile.monthly_salary)) + other,
    });
  }

  return result;
}
