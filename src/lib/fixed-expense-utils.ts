import type { FixedExpense, Transaction } from "./types";

export const FIXED_CHART_CATEGORY = "Gastos fijos";

export function sumActiveFixedExpenses(fixedExpenses: FixedExpense[]): number {
  return fixedExpenses
    .filter((f) => f.active)
    .reduce((acc, f) => acc + Number(f.amount), 0);
}

/** Gastos manuales del mes que cubren (total o parcialmente) un fijo concreto. */
export function manualFixedPaymentsForMonth(
  txs: Transaction[],
  fixed: FixedExpense,
  start: string,
  end: string
): number {
  return txs
    .filter((t) => isManualFixedPayment(t, fixed, start, end))
    .reduce((acc, t) => acc + Number(t.amount), 0);
}

function normalizeMatch(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function isManualFixedPayment(
  t: Transaction,
  fixed: FixedExpense,
  start: string,
  end: string
): boolean {
  if (t.type !== "expense" || t.fixed_expense_id) return false;
  if (t.date < start || t.date > end) return false;

  const name = normalizeMatch(fixed.name);
  const desc = normalizeMatch(t.description);
  if (!name || !desc) return false;

  if (desc === name || (name.length >= 3 && desc.includes(name))) return true;
  if (desc.length >= 5 && name.includes(desc)) return true;

  if (
    (name.includes("alquiler") || name.includes("renta")) &&
    (desc.includes("alqu") || desc.includes("renta") || desc.includes("alquier"))
  ) {
    return true;
  }

  return false;
}

/** Bloquea el auto-fijo solo si el mes ya está cubierto (pago manual casi completo). */
export function isFixedFullyPaidManually(
  txs: Transaction[],
  fixed: FixedExpense,
  start: string,
  end: string
): boolean {
  const paid = manualFixedPaymentsForMonth(txs, fixed, start, end);
  return paid >= Number(fixed.amount) * 0.9;
}

/**
 * Parte de fijos del mes aún no reflejada en movimientos (solo mes en curso).
 * Ej.: alquiler 325 € con 87,50 € pagados a mano → devengo 237,50 €.
 */
export function unpaidFixedForMonth(
  fixedExpenses: FixedExpense[],
  monthTx: Transaction[],
  start: string,
  end: string
): number {
  let unpaid = 0;

  for (const fixed of fixedExpenses.filter((f) => f.active)) {
    const configured = Number(fixed.amount);
    const autoPaid = monthTx
      .filter(
        (t) =>
          t.type === "expense" &&
          t.fixed_expense_id === fixed.id &&
          t.date >= start &&
          t.date <= end
      )
      .reduce((acc, t) => acc + Number(t.amount), 0);

    if (autoPaid >= configured * 0.99) continue;

    const manualPaid = manualFixedPaymentsForMonth(
      monthTx,
      fixed,
      start,
      end
    );
    if (manualPaid >= configured * 0.9) continue;

    unpaid += Math.max(0, configured - autoPaid - manualPaid);
  }

  return unpaid;
}

export function isManualFixedDuplicateTx(
  txs: Transaction[],
  t: Transaction,
  fixedExpenses: FixedExpense[],
  start: string,
  end: string
): boolean {
  if (t.type !== "expense" || t.fixed_expense_id) return false;
  if (t.date < start || t.date > end) return false;

  return fixedExpenses.some((fixed) =>
    isManualFixedPayment(t, fixed, start, end)
  );
}

/** Gastos por categoría: fijos agrupados + variables sin duplicar fijos. */
export function expensesByCategoryForMonth(
  monthExpenses: Transaction[],
  fixedExpenses: FixedExpense[],
  monthStart: string,
  monthEnd: string,
  accrueConfigured = true
): { name: string; value: number }[] {
  const map = new Map<string, number>();

  if (accrueConfigured) {
    const fixedTotal = sumActiveFixedExpenses(fixedExpenses);
    if (fixedTotal > 0) {
      map.set(FIXED_CHART_CATEGORY, fixedTotal);
    }
  } else {
    const recordedFixed = monthExpenses
      .filter(
        (t) =>
          t.type === "expense" &&
          (Boolean(t.fixed_expense_id) ||
            isManualFixedDuplicateTx(
              monthExpenses,
              t,
              fixedExpenses,
              monthStart,
              monthEnd
            ))
      )
      .reduce((acc, t) => acc + Number(t.amount), 0);
    if (recordedFixed > 0) {
      map.set(FIXED_CHART_CATEGORY, recordedFixed);
    }
  }

  for (const t of monthExpenses) {
    if (t.type !== "expense") continue;
    if (t.fixed_expense_id) continue;
    if (
      isManualFixedDuplicateTx(
        monthExpenses,
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

  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export interface CategoryExpenseRow {
  id: string;
  description: string;
  amount: number;
  date: string;
  category: string;
  isPending?: boolean;
}

/** Gastos concretos de una categoría del gráfico. */
export function getCategoryExpensesForMonth(
  categoryName: string,
  monthExpenses: Transaction[],
  fixedExpenses: FixedExpense[],
  monthStart: string,
  monthEnd: string,
  accrueConfigured = true
): CategoryExpenseRow[] {
  if (categoryName === FIXED_CHART_CATEGORY) {
    const rows: CategoryExpenseRow[] = [];
    const seen = new Set<string>();

    for (const fixed of fixedExpenses.filter((f) => f.active)) {
      const configured = Number(fixed.amount);
      const autoTxs = monthExpenses.filter(
        (t) => t.type === "expense" && t.fixed_expense_id === fixed.id
      );
      const manualTxs = monthExpenses.filter((t) =>
        isManualFixedPayment(t, fixed, monthStart, monthEnd)
      );
      const linked = [...autoTxs, ...manualTxs];

      if (linked.length > 0) {
        for (const t of linked) {
          seen.add(t.id);
          rows.push({
            id: t.id,
            description: t.description || fixed.name,
            amount: Number(t.amount),
            date: t.date,
            category: fixed.category,
          });
        }
        const covered = linked.reduce((acc, t) => acc + Number(t.amount), 0);
        const remaining = configured - covered;
        if (accrueConfigured && remaining > 0.01) {
          rows.push({
            id: `pending-${fixed.id}`,
            description: `${fixed.name} (pendiente)`,
            amount: remaining,
            date: monthStart,
            category: fixed.category,
            isPending: true,
          });
        }
      } else if (accrueConfigured) {
        rows.push({
          id: `config-${fixed.id}`,
          description: fixed.name,
          amount: configured,
          date: monthStart,
          category: fixed.category,
          isPending: true,
        });
      }
    }

    for (const t of monthExpenses) {
      if (t.type !== "expense" || !t.fixed_expense_id || seen.has(t.id)) continue;
      rows.push({
        id: t.id,
        description: t.description || t.category,
        amount: Number(t.amount),
        date: t.date,
        category: t.category || "Fijos",
      });
    }

    return rows.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }

  return monthExpenses
    .filter(
      (t) =>
        t.type === "expense" &&
        !t.fixed_expense_id &&
        (t.category || "Otros") === categoryName &&
        !isManualFixedDuplicateTx(
          monthExpenses,
          t,
          fixedExpenses,
          monthStart,
          monthEnd
        )
    )
    .map((t) => ({
      id: t.id,
      description: t.description || t.category,
      amount: Number(t.amount),
      date: t.date,
      category: t.category || "Otros",
    }))
    .sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
}
