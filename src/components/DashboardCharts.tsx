"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AppSheet } from "@/components/AppSheet";
import {
  FIXED_CHART_CATEGORY,
  getCategoryExpensesForMonth,
} from "@/lib/fixed-expense-utils";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { FixedExpense, Transaction } from "@/lib/types";
import { cn } from "@/lib/utils";

const COLORS = [
  "#0f766e",
  "#0284c7",
  "#d97706",
  "#e11d48",
  "#7c3aed",
  "#64748b",
  "#059669",
  "#db2777",
];

interface ChartsProps {
  evolution: {
    month: string;
    gastado: number;
    invertido: number;
    ingresos: number;
  }[];
  byCategory: { name: string; value: number }[];
  monthExpenses: Transaction[];
  fixedExpenses: FixedExpense[];
  monthStart: string;
  monthEnd: string;
  currency?: string;
}

function ChartTooltip({
  active,
  payload,
  label,
  currency,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
  currency: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2.5 text-xs shadow-lg">
      <p className="mb-1.5 font-semibold text-ink">{label}</p>
      <ul className="space-y-1">
        {payload.map((entry) => (
          <li
            key={entry.name}
            className="flex items-center justify-between gap-4"
          >
            <span className="flex items-center gap-1.5 text-ink-muted">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: entry.color }}
              />
              {entry.name}
            </span>
            <span className="font-medium tabular-nums text-ink">
              {formatCurrency(entry.value, currency)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DashboardCharts({
  evolution,
  byCategory,
  monthExpenses,
  fixedExpenses,
  monthStart,
  monthEnd,
  currency = "EUR",
}: ChartsProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categoryTotal = byCategory.reduce((acc, c) => acc + c.value, 0);
  const categoryData = byCategory.map((c, i) => ({
    ...c,
    pct: categoryTotal ? Math.round((c.value / categoryTotal) * 100) : 0,
    fill: COLORS[i % COLORS.length],
  }));

  const selectedRows = useMemo(() => {
    if (!selectedCategory) return [];
    return getCategoryExpensesForMonth(
      selectedCategory,
      monthExpenses,
      fixedExpenses,
      monthStart,
      monthEnd
    );
  }, [
    selectedCategory,
    monthExpenses,
    fixedExpenses,
    monthStart,
    monthEnd,
  ]);

  const selectedTotal = selectedRows.reduce((acc, r) => acc + r.amount, 0);
  const selectedMeta = categoryData.find((c) => c.name === selectedCategory);

  function openCategory(name: string) {
    setSelectedCategory(name);
  }

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="animate-rise overflow-hidden" style={{ animationDelay: "120ms" }}>
          <CardHeader>
            <CardTitle>Evolución mensual</CardTitle>
            <CardDescription className="leading-relaxed">
              Compara los últimos 6 meses: cuánto has{" "}
              <span className="font-medium text-rose-600">gastado</span> (fijos
              automáticos + variables) y cuánto has{" "}
              <span className="font-medium text-sky-600">invertido</span>.
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-5 pt-2">
            <div className="mb-3 flex flex-wrap gap-3 text-[11px] font-medium">
              <span className="inline-flex items-center gap-1.5 text-ink-muted">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                Gastado
              </span>
              <span className="inline-flex items-center gap-1.5 text-ink-muted">
                <span className="h-2.5 w-2.5 rounded-full bg-sky-500" />
                Invertido
              </span>
            </div>
            <div className="h-56 sm:h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={evolution}
                  margin={{ top: 4, right: 4, left: -8, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="gGastado" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#e11d48" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#e11d48" stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="gInv" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0284c7" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#0284c7" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#e2e8f0"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 10, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                    width={36}
                    tickFormatter={(v) =>
                      v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)
                    }
                  />
                  <Tooltip
                    content={({ active, payload, label }) => (
                      <ChartTooltip
                        active={active}
                        label={label}
                        currency={currency}
                        payload={payload?.map((p) => ({
                          name: String(p.name),
                          value: Number(p.value),
                          color: String(p.color),
                        }))}
                      />
                    )}
                  />
                  <Area
                    type="monotone"
                    dataKey="gastado"
                    name="Gastado"
                    stroke="#e11d48"
                    fill="url(#gGastado)"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: "#e11d48", strokeWidth: 0 }}
                    activeDot={{ r: 5 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="invertido"
                    name="Invertido"
                    stroke="#0284c7"
                    fill="url(#gInv)"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: "#0284c7", strokeWidth: 0 }}
                    activeDot={{ r: 5 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="animate-rise overflow-hidden" style={{ animationDelay: "180ms" }}>
          <CardHeader>
            <CardTitle>Gastos por categoría</CardTitle>
              <CardDescription className="leading-relaxed">
                Reparto de lo gastado en el mes seleccionado. Toca una
                categoría para ver el detalle.
              </CardDescription>
          </CardHeader>
          <CardContent className="pb-5 pt-2">
            {categoryData.length === 0 ? (
              <div className="flex h-56 items-center justify-center rounded-xl border border-dashed border-line bg-surface-2/50 text-sm text-ink-muted sm:h-64">
                Aún no hay gastos este mes
              </div>
            ) : (
              <>
                <p className="mb-3 text-xs text-ink-muted">
                  Total del mes:{" "}
                  <span className="font-semibold text-ink">
                    {formatCurrency(categoryTotal, currency)}
                  </span>
                </p>
                <div className="h-56 sm:h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={categoryData}
                      layout="vertical"
                      margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
                      barCategoryGap="20%"
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#e2e8f0"
                        horizontal={false}
                      />
                      <XAxis
                        type="number"
                        hide
                        domain={[0, "dataMax"]}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={68}
                        tick={{ fontSize: 11, fill: "#475569" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        cursor={{ fill: "rgba(15, 118, 110, 0.06)" }}
                        content={({ active, payload }) => {
                          if (!active || !payload?.[0]) return null;
                          const d = payload[0].payload as (typeof categoryData)[0];
                          return (
                            <div className="rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-lg">
                              <p className="font-semibold text-ink">{d.name}</p>
                              <p className="mt-0.5 text-ink-muted">
                                {formatCurrency(d.value, currency)} · {d.pct}%
                              </p>
                              <p className="mt-1 text-[10px] text-brand">
                                Toca para ver detalle
                              </p>
                            </div>
                          );
                        }}
                      />
                      <Bar
                        dataKey="value"
                        radius={[0, 8, 8, 0]}
                        maxBarSize={28}
                        cursor="pointer"
                        onClick={(data) => {
                          const row = data as (typeof categoryData)[0];
                          if (row?.name) openCategory(row.name);
                        }}
                      >
                        {categoryData.map((entry) => (
                          <Cell key={entry.name} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <ul className="mt-4 space-y-1">
                  {categoryData.map((c) => (
                    <li key={c.name}>
                      <button
                        type="button"
                        onClick={() => openCategory(c.name)}
                        className="flex w-full items-center justify-between gap-2 rounded-xl px-2 py-2 text-left text-xs transition hover:bg-surface-2 active:bg-surface-2"
                      >
                        <span className="flex min-w-0 items-center gap-2 text-ink-muted">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ background: c.fill }}
                          />
                          <span className="truncate font-medium text-ink">
                            {c.name}
                          </span>
                        </span>
                        <span className="shrink-0 tabular-nums text-ink">
                          {c.pct}% · {formatCurrency(c.value, currency)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <AppSheet
        open={selectedCategory !== null}
        onClose={() => setSelectedCategory(null)}
        title={selectedCategory ?? "Gastos"}
        subtitle={
          selectedCategory
            ? `${selectedRows.length} movimiento${selectedRows.length === 1 ? "" : "s"} · ${formatCurrency(selectedTotal, currency)}`
            : undefined
        }
      >
        {selectedRows.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-muted">
            No hay gastos en esta categoría este mes.
          </p>
        ) : (
          <ul className="space-y-2 pb-2">
            {selectedRows.map((row) => (
              <li
                key={row.id}
                className={cn(
                  "flex items-center gap-3 rounded-2xl border px-3 py-3",
                  row.isPending
                    ? "border-dashed border-line bg-surface-2/60"
                    : "border-line/70 bg-surface shadow-sm"
                )}
              >
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-semibold"
                  style={{
                    background: `${selectedMeta?.fill ?? COLORS[0]}22`,
                    color: selectedMeta?.fill ?? COLORS[0],
                  }}
                >
                  {row.isPending ? "…" : row.description.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">
                    {row.description}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {row.category} · {formatDate(row.date)}
                    {row.isPending ? " · previsto" : ""}
                    {selectedCategory === FIXED_CHART_CATEGORY && !row.isPending
                      ? " · fijo"
                      : ""}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 text-sm font-semibold tabular-nums",
                    row.isPending ? "text-ink-muted" : "text-rose-700"
                  )}
                >
                  {row.isPending ? "~" : "−"}
                  {formatCurrency(row.amount, currency)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </AppSheet>
    </>
  );
}
