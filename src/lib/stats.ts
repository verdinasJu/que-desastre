import type {
  FixedExpense,
  InvestmentPosition,
  MonthStats,
  Profile,
  Transaction,
} from "./types";
import { AUTO_SALARY_DESCRIPTION } from "./constants";
import { isLikelySalaryDescription } from "./csv-import";
import {
  isManualFixedDuplicateTx,
  sumActiveFixedExpenses,
  unpaidFixedForMonth,
} from "./fixed-expense-utils";
import { positionCurrentValue } from "./investment-prices";
import { localISODate } from "./utils";

/** Valor de mercado de la cartera. Sin posiciones: legado initial_investments (oculto). */
export function calcInvestmentsMarketValue(
  profile: Profile,
  positions: InvestmentPosition[] = []
): number {
  if (positions.length) {
    return positions.reduce(
      (acc, p) =>
        acc +
        positionCurrentValue({
          quantity: Number(p.quantity),
          last_price: p.last_price,
          last_value: p.last_value,
          manual_value: p.manual_value,
        }),
      0
    );
  }
  return Number(profile.initial_investments) || 0;
}

/**
 * Patrimonio total = ahorro inicial + valor de cartera + ingresos − gastos
 * − fijos del mes aún no registrados (devengo parcial, ej. alquiler pendiente).
 */
export function calcPatrimonio(
  profile: Profile,
  transactions: Transaction[],
  fixedExpenses: FixedExpense[] = [],
  monthStart?: string,
  monthEnd?: string,
  positions: InvestmentPosition[] = []
): number {
  const income = sumByType(transactions, "income");
  const expense = sumByType(transactions, "expense");
  const investments = calcInvestmentsMarketValue(profile, positions);
  let total =
    profile.initial_savings + investments + income - expense;

  if (fixedExpenses.length && monthStart && monthEnd) {
    const monthTx = transactions.filter(
      (t) => t.date >= monthStart && t.date <= monthEnd
    );
    total -= unpaidFixedForMonth(
      fixedExpenses,
      monthTx,
      monthStart,
      monthEnd
    );
  }

  return total;
}

function isSalaryLikeIncome(t: Transaction): boolean {
  if (t.type !== "income") return false;
  if (t.description === AUTO_SALARY_DESCRIPTION) return true;
  return isLikelySalaryDescription(t.description);
}

/**
 * Disponible para gastar (mes) =
 * ingreso base del mes + otros ingresos − fijos − inversiones − gastos variables
 *
 * Ingreso base = nómina automática, o nómina importada del banco, o la cifra
 * configurada en el mes en curso (sin contar dos veces la misma nómina).
 *
 * Ahorro del mes = lo mismo sin restar inversiones (siguen siendo tuyas).
 */
export function calcMonthStats(
  profile: Profile,
  allTransactions: Transaction[],
  monthStart: string,
  monthEnd: string,
  fixedExpenses: FixedExpense[] = [],
  positions: InvestmentPosition[] = []
): MonthStats {
  const monthTx = allTransactions.filter(
    (t) => t.date >= monthStart && t.date <= monthEnd
  );

  const now = new Date();
  const currentStart = localISODate(new Date(now.getFullYear(), now.getMonth(), 1));
  const isViewingCurrentMonth = monthStart === currentStart;

  const autoIncome = monthTx
    .filter(
      (t) =>
        t.type === "income" && t.description === AUTO_SALARY_DESCRIPTION
    )
    .reduce((acc, t) => acc + Number(t.amount), 0);

  const salaryImported = monthTx
    .filter(
      (t) =>
        t.type === "income" &&
        t.description !== AUTO_SALARY_DESCRIPTION &&
        isSalaryLikeIncome(t)
    )
    .reduce((acc, t) => acc + Number(t.amount), 0);

  const otherIncome = monthTx
    .filter(
      (t) =>
        t.type === "income" &&
        t.description !== AUTO_SALARY_DESCRIPTION &&
        !isSalaryLikeIncome(t)
    )
    .reduce((acc, t) => acc + Number(t.amount), 0);

  let ingresoBaseDelMes = 0;
  if (autoIncome > 0) {
    ingresoBaseDelMes = autoIncome;
  } else if (salaryImported > 0) {
    ingresoBaseDelMes = salaryImported;
  } else if (isViewingCurrentMonth) {
    ingresoBaseDelMes = Number(profile.monthly_salary) || 0;
  }

  const ingresosDelMes = ingresoBaseDelMes + otherIncome;

  const invertidoEsteMes = sumByType(monthTx, "investment");

  const variableExpenses = monthTx.filter(
    (t) =>
      t.type === "expense" &&
      !t.fixed_expense_id &&
      !isManualFixedDuplicateTx(
        monthTx,
        t,
        fixedExpenses,
        monthStart,
        monthEnd
      )
  );

  const gastosVariablesDelMes = variableExpenses.reduce(
    (acc, t) => acc + Number(t.amount),
    0
  );

  const autoFixedPaid = monthTx
    .filter((t) => t.type === "expense" && t.fixed_expense_id)
    .reduce((acc, t) => acc + Number(t.amount), 0);

  const manualFixedPaid = monthTx
    .filter(
      (t) =>
        t.type === "expense" &&
        !t.fixed_expense_id &&
        isManualFixedDuplicateTx(
          monthTx,
          t,
          fixedExpenses,
          monthStart,
          monthEnd
        )
    )
    .reduce((acc, t) => acc + Number(t.amount), 0);

  const gastosFijosDelMes = isViewingCurrentMonth
    ? sumActiveFixedExpenses(fixedExpenses)
    : autoFixedPaid + manualFixedPaid;

  const gastadoEsteMes = isViewingCurrentMonth
    ? gastosFijosDelMes + gastosVariablesDelMes
    : sumByType(monthTx, "expense");

  const disponibleParaGastar =
    ingresoBaseDelMes +
    otherIncome -
    gastosFijosDelMes -
    invertidoEsteMes -
    gastosVariablesDelMes;

  const ahorroDelMes =
    ingresoBaseDelMes + otherIncome - gastosFijosDelMes - gastosVariablesDelMes;

  return {
    patrimonioTotal: calcPatrimonio(
      profile,
      allTransactions,
      isViewingCurrentMonth ? fixedExpenses : [],
      isViewingCurrentMonth ? monthStart : undefined,
      isViewingCurrentMonth ? monthEnd : undefined,
      positions
    ),
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
  expenses: Transaction[]
): { name: string; value: number }[] {
  const map = new Map<string, number>();

  for (const t of expenses.filter((x) => x.type === "expense")) {
    const cat = t.category || "Otros";
    map.set(cat, (map.get(cat) || 0) + Number(t.amount));
  }

  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export function spentByCategoryThisMonth(
  transactions: Transaction[],
  monthStart: string,
  monthEnd: string,
  fixedExpenses: FixedExpense[] = []
): Map<string, number> {
  const monthTx = transactions.filter(
    (t) => t.date >= monthStart && t.date <= monthEnd
  );
  const map = new Map<string, number>();
  for (const t of monthTx) {
    if (t.type !== "expense") continue;
    if (t.fixed_expense_id) continue;
    if (
      isManualFixedDuplicateTx(
        monthTx,
        t,
        fixedExpenses,
        monthStart,
        monthEnd
      )
    ) {
      continue;
    }
    const cat = t.category || "Otros";
    map.set(cat, (map.get(cat) || 0) + Number(t.amount));
  }
  return map;
}

export function monthlyEvolution(
  profile: Profile,
  transactions: Transaction[],
  months = 6,
  /** Mes ancla (último de la serie). Por defecto: hoy. */
  anchor: Date = new Date(),
  fixedExpenses: FixedExpense[] = []
): { month: string; gastado: number; invertido: number; ingresos: number }[] {
  const result: {
    month: string;
    gastado: number;
    invertido: number;
    ingresos: number;
  }[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(anchor.getFullYear(), anchor.getMonth() - i, 1);
    const start = localISODate(new Date(d.getFullYear(), d.getMonth(), 1));
    const end = localISODate(new Date(d.getFullYear(), d.getMonth() + 1, 0));
    const stats = calcMonthStats(
      profile,
      transactions,
      start,
      end,
      fixedExpenses
    );
    const label = d.toLocaleDateString("es-ES", {
      month: "short",
      year: "2-digit",
    });
    result.push({
      month: label,
      gastado: stats.gastadoEsteMes,
      invertido: stats.invertidoEsteMes,
      ingresos: stats.ingresosDelMes,
    });
  }

  return result;
}
