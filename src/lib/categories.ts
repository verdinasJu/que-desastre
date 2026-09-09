import type { TransactionType } from "@/lib/types";
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  INVESTMENT_CATEGORIES,
} from "@/lib/constants";

const DEFAULTS: Record<TransactionType, readonly string[]> = {
  expense: EXPENSE_CATEGORIES,
  income: INCOME_CATEGORIES,
  investment: INVESTMENT_CATEGORIES,
};

export function mergeCategories(
  type: TransactionType,
  customNames: string[],
  current?: string
): string[] {
  // Primero las creadas por el usuario, luego las por defecto.
  const ordered = [
    ...customNames.map((n) => n.trim()).filter(Boolean),
    ...DEFAULTS[type],
  ];
  if (current?.trim()) ordered.push(current.trim());

  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of ordered) {
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

export function defaultCategories(type: TransactionType): readonly string[] {
  return DEFAULTS[type];
}
