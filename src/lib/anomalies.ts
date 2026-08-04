import type { Transaction } from "@/lib/types";

export interface SpendingAnomaly {
  category: string;
  current: number;
  average: number;
  ratio: number;
  message: string;
}

function weekRange(offsetWeeks = 0) {
  const now = new Date();
  const day = now.getDay(); // 0 Sun
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset - offsetWeeks * 7);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    start: monday.toISOString().slice(0, 10),
    end: sunday.toISOString().slice(0, 10),
  };
}

function spendByCategory(
  transactions: Transaction[],
  start: string,
  end: string
) {
  const map = new Map<string, number>();
  for (const t of transactions) {
    if (t.type !== "expense" || t.date < start || t.date > end) continue;
    const cat = t.category || "Otros";
    map.set(cat, (map.get(cat) || 0) + Number(t.amount));
  }
  return map;
}

/**
 * Compara esta semana con la media de las 4 anteriores.
 * Marca anomalía si gastas ≥ 1.8× la media y al menos 15 € de diferencia.
 */
export function detectSpendingAnomalies(
  transactions: Transaction[],
  max = 3
): SpendingAnomaly[] {
  const current = weekRange(0);
  const currentMap = spendByCategory(
    transactions,
    current.start,
    current.end
  );

  const prevMaps = [1, 2, 3, 4].map((w) => {
    const r = weekRange(w);
    return spendByCategory(transactions, r.start, r.end);
  });

  const categories = new Set<string>([
    ...Array.from(currentMap.keys()),
    ...prevMaps.flatMap((m) => Array.from(m.keys())),
  ]);

  const anomalies: SpendingAnomaly[] = [];

  for (const category of Array.from(categories)) {
    const cur = currentMap.get(category) || 0;
    if (cur < 20) continue;

    const prevValues = prevMaps.map((m) => m.get(category) || 0);
    const weeksWithSpend = prevValues.filter((v) => v > 0).length;
    const avg =
      weeksWithSpend > 0
        ? prevValues.reduce((a, b) => a + b, 0) / 4
        : 0;

    if (avg < 5) {
      // Categoría nueva esta semana con gasto relevante
      if (cur >= 40) {
        anomalies.push({
          category,
          current: cur,
          average: avg,
          ratio: avg > 0 ? cur / avg : 99,
          message: `Esta semana llevas ${category} muy alto y casi no solías gastar ahí.`,
        });
      }
      continue;
    }

    const ratio = cur / avg;
    if (ratio >= 1.8 && cur - avg >= 15) {
      anomalies.push({
        category,
        current: cur,
        average: avg,
        ratio,
        message: `En ${category} llevas ~${Math.round(ratio * 10) / 10}× tu media semanal.`,
      });
    }
  }

  return anomalies
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, max);
}
