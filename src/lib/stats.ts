import type {
  FixedExpense,
  InvestmentPosition,
  MonthStats,
  Profile,
  Transaction,
} from "./types";
import { AUTO_SALARY_DESCRIPTION } from "./constants";
import {
  isManualFixedDuplicateTx,
  sumActiveFixedExpenses,
  unpaidFixedForMonth,
} from "./fixed-expense-utils";
import { positionCurrentValue } from "./investment-prices";

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
  // Compatibilidad: usuarios que aún no migraron a la cartera
  return Number(profile.initial_investments) || 0;
}

/**
 * Patrimonio total = ahorro inicial + valor de cartera + ingresos − gastos
 * − fijos del mes aún no registrados (devengo parcial, ej. alquiler pendiente).
 * Las inversiones viven solo en Más → Inversiones (valor de mercado).
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

/**
 * Disponible para gastar (mes) =
 * ingreso base del mes + otros ingresos − fijos − inversiones − gastos variables
 *
 * Ingreso base = ingreso automático si ya se generó, si no la cifra configurada
 * (para no contar dos veces nómina + ingreso automático).
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

  const gastosFijosDelMes = sumActiveFixedExpenses(fixedExpenses);

  const gastosVariablesDelMes = monthTx
    .filter(
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
    )
    .reduce((acc, t) => acc + Number(t.amount), 0);

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

  // Mismos ingresos extras que el disponible: un bizum/extra de 50 € también
  // aumenta el ahorro del mes (antes solo contaba la nómina base).
  const ahorroDelMes =
    ingresoBaseDelMes +
    otherIncome -
    gastosFijosDelMes -
    invertidoEsteMes -
    gastosVariablesDelMes;

  const { start: currentStart } = (() => {
    const now = new Date();
    return {
      start: new Date(now.getFullYear(), now.getMonth(), 1)
        .toISOString()
        .slice(0, 10),
    };
  })();
  const isViewingCurrentMonth = monthStart === currentStart;

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
  monthEnd: string
): Map<string, number> {
  const map = new Map<string, number>();
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
  months = 6,
  /** Mes ancla (último de la serie). Por defecto: hoy. */
  anchor: Date = new Date()
): { month: string; gastado: number; invertido: number; ingresos: number }[] {
  const result: {
    month: string;
    gastado: number;
    invertido: number;
    ingresos: number;
  }[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(anchor.getFullYear(), anchor.getMonth() - i, 1);
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
