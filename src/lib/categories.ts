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
  const set = new Set<string>([...DEFAULTS[type], ...customNames]);
  if (current) set.add(current);
  return Array.from(set);
}

export function defaultCategories(type: TransactionType): readonly string[] {
  return DEFAULTS[type];
}
