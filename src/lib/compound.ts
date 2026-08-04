export type CompoundFrequency = "monthly" | "yearly";

export interface CompoundInput {
  principal: number;
  monthlyContribution: number;
  annualRatePercent: number;
  years: number;
  frequency?: CompoundFrequency;
}

export interface CompoundYearPoint {
  year: number;
  total: number;
  contributed: number;
  interest: number;
}

export interface CompoundResult {
  finalAmount: number;
  totalContributed: number;
  totalInterest: number;
  series: CompoundYearPoint[];
}

/**
 * Interés compuesto con aportaciones mensuales.
 * Por defecto capitaliza mensualmente (lo habitual en fondos/planes).
 */
export function calculateCompoundInterest({
  principal,
  monthlyContribution,
  annualRatePercent,
  years,
  frequency = "monthly",
}: CompoundInput): CompoundResult {
  const p0 = Math.max(0, principal);
  const pmt = Math.max(0, monthlyContribution);
  const yearsSafe = Math.max(0, Math.min(50, years));
  const annualRate = Math.max(0, annualRatePercent) / 100;

  if (yearsSafe === 0) {
    return {
      finalAmount: p0,
      totalContributed: p0,
      totalInterest: 0,
      series: [{ year: 0, total: p0, contributed: p0, interest: 0 }],
    };
  }

  const series: CompoundYearPoint[] = [
    { year: 0, total: p0, contributed: p0, interest: 0 },
  ];

  let balance = p0;
  let contributed = p0;

  if (frequency === "yearly") {
    for (let y = 1; y <= yearsSafe; y++) {
      // 12 aportaciones a lo largo del año, luego interés anual (aprox. útil)
      for (let m = 0; m < 12; m++) {
        balance += pmt;
        contributed += pmt;
      }
      balance *= 1 + annualRate;
      series.push({
        year: y,
        total: round2(balance),
        contributed: round2(contributed),
        interest: round2(balance - contributed),
      });
    }
  } else {
    const r = annualRate / 12;
    const months = Math.round(yearsSafe * 12);

    for (let m = 1; m <= months; m++) {
      balance = balance * (1 + r) + pmt;
      contributed += pmt;
      if (m % 12 === 0 || m === months) {
        const year = Math.ceil(m / 12);
        series.push({
          year,
          total: round2(balance),
          contributed: round2(contributed),
          interest: round2(balance - contributed),
        });
      }
    }
  }

  const last = series[series.length - 1];
  return {
    finalAmount: last.total,
    totalContributed: last.contributed,
    totalInterest: last.interest,
    series,
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
