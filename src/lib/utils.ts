import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = "EUR") {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

/** YYYY-MM-DD en hora local. Evita el desfase de `toISOString()` (UTC). */
export function localISODate(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatDate(date: string | Date) {
  const d =
    typeof date === "string"
      ? new Date(/^\d{4}-\d{2}-\d{2}/.test(date) ? `${date.slice(0, 10)}T12:00:00` : date)
      : date;
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

export function currentMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    start: localISODate(start),
    end: localISODate(end),
  };
}

/** `monthKey` = "YYYY-MM". Si es inválido o vacío, mes actual. */
export function monthRangeFromKey(monthKey?: string | null) {
  const now = new Date();
  const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const key =
    monthKey && /^\d{4}-\d{2}$/.test(monthKey) ? monthKey : currentKey;
  const [y, m] = key.split("-").map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0);
  return {
    key,
    start: localISODate(start),
    end: localISODate(end),
    year: y,
    monthIndex: m - 1,
    isCurrent: key === currentKey,
    label: start.toLocaleDateString("es-ES", {
      month: "long",
      year: "numeric",
    }),
  };
}

export function shiftMonthKey(monthKey: string, delta: number) {
  const { year, monthIndex } = monthRangeFromKey(monthKey);
  const d = new Date(year, monthIndex + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
