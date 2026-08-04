"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { calculateCompoundInterest } from "@/lib/compound";
import { formatCurrency, cn } from "@/lib/utils";

interface CompoundCalculatorProps {
  initialPrincipal?: number;
  currency?: string;
}

export function CompoundCalculator({
  initialPrincipal = 0,
  currency = "EUR",
}: CompoundCalculatorProps) {
  const [principal, setPrincipal] = useState(
    initialPrincipal > 0 ? String(initialPrincipal) : "5000"
  );
  const [monthly, setMonthly] = useState("200");
  const [rate, setRate] = useState("7");
  const [years, setYears] = useState("10");
  const [frequency, setFrequency] = useState<"monthly" | "yearly">("monthly");

  const result = useMemo(() => {
    return calculateCompoundInterest({
      principal: Number(principal.replace(",", ".")) || 0,
      monthlyContribution: Number(monthly.replace(",", ".")) || 0,
      annualRatePercent: Number(rate.replace(",", ".")) || 0,
      years: Number(years.replace(",", ".")) || 0,
      frequency,
    });
  }, [principal, monthly, rate, years, frequency]);

  function applyMyInvestments() {
    if (initialPrincipal > 0) setPrincipal(String(initialPrincipal));
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tus números</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="principal">Capital inicial (€)</Label>
            <Input
              id="principal"
              inputMode="decimal"
              value={principal}
              onChange={(e) => setPrincipal(e.target.value)}
            />
            {initialPrincipal > 0 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-1"
                onClick={applyMyInvestments}
              >
                Usar mis inversiones actuales (
                {formatCurrency(initialPrincipal, currency)})
              </Button>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="monthly">Aportación mensual (€)</Label>
            <Input
              id="monthly"
              inputMode="decimal"
              value={monthly}
              onChange={(e) => setMonthly(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="rate">Interés anual (%)</Label>
              <Input
                id="rate"
                inputMode="decimal"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
              />
            </div>
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="years">Años</Label>
              <Input
                id="years"
                inputMode="numeric"
                type="number"
                min={1}
                max={50}
                value={years}
                onChange={(e) => setYears(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Capitalización</Label>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { value: "monthly", label: "Mensual" },
                  { value: "yearly", label: "Anual" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFrequency(opt.value)}
                  className={cn(
                    "rounded-xl border px-3 py-2.5 text-sm font-semibold transition",
                    frequency === opt.value
                      ? "border-brand bg-brand/10 text-brand"
                      : "border-line text-ink-muted hover:bg-surface-2"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-ink-muted leading-relaxed">
              Mensual es lo habitual en fondos indexados o planes de inversión.
              El % es una estimación: la rentabilidad real varía.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        <ResultTile
          label="Capital final"
          value={formatCurrency(result.finalAmount, currency)}
          tone="brand"
        />
        <ResultTile
          label="Aportado por ti"
          value={formatCurrency(result.totalContributed, currency)}
        />
        <ResultTile
          label="Intereses generados"
          value={formatCurrency(result.totalInterest, currency)}
          tone="positive"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Evolución estimada</CardTitle>
        </CardHeader>
        <CardContent className="h-64 pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={result.series}
              margin={{ top: 4, right: 4, left: -8, bottom: 0 }}
            >
              <defs>
                <linearGradient id="gTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0f766e" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#0f766e" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="gContrib" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0284c7" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#0284c7" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis
                dataKey="year"
                tick={{ fontSize: 10, fill: "#64748b" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${v}a`}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#64748b" }}
                axisLine={false}
                tickLine={false}
                width={40}
                tickFormatter={(v) =>
                  v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
                }
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div className="rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-lg">
                      <p className="mb-1 font-semibold">Año {label}</p>
                      {payload.map((p) => (
                        <p key={String(p.dataKey)} className="text-ink-muted">
                          {p.name}:{" "}
                          <span className="font-medium text-ink">
                            {formatCurrency(Number(p.value), currency)}
                          </span>
                        </p>
                      ))}
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="total"
                name="Total"
                stroke="#0f766e"
                fill="url(#gTotal)"
                strokeWidth={2.5}
              />
              <Area
                type="monotone"
                dataKey="contributed"
                name="Aportado"
                stroke="#0284c7"
                fill="url(#gContrib)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
          <div className="mt-2 flex flex-wrap gap-3 text-[11px] font-medium text-ink-muted">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-brand" /> Total
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-sky-500" /> Aportado
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ResultTile({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "brand" | "positive";
}) {
  const styles = {
    default: "border-line bg-surface",
    brand: "border-teal-100 bg-teal-50/80",
    positive: "border-emerald-100 bg-emerald-50/80",
  };
  return (
    <div className={cn("rounded-2xl border p-4 shadow-sm", styles[tone])}>
      <p className="text-xs font-medium uppercase tracking-wider text-ink-muted">
        {label}
      </p>
      <p className="mt-1 font-display text-xl font-semibold tabular-nums tracking-tight">
        {value}
      </p>
    </div>
  );
}
