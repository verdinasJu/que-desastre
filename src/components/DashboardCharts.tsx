"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

const COLORS = ["#0d9488", "#0284c7", "#d97706", "#e11d48", "#7c3aed", "#64748b"];

interface ChartsProps {
  evolution: {
    month: string;
    gastado: number;
    invertido: number;
    ingresos: number;
  }[];
  byCategory: { name: string; value: number }[];
  currency?: string;
}

export function DashboardCharts({
  evolution,
  byCategory,
  currency = "EUR",
}: ChartsProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="animate-rise" style={{ animationDelay: "120ms" }}>
        <CardHeader>
          <CardTitle>Evolución mensual</CardTitle>
        </CardHeader>
        <CardContent className="h-64 pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={evolution}>
              <defs>
                <linearGradient id="gGastado" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#e11d48" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#e11d48" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gInv" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0284c7" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#0284c7" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" width={40} />
              <Tooltip
                formatter={(value: number) => formatCurrency(value, currency)}
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid #e2e8f0",
                  fontSize: 12,
                }}
              />
              <Area
                type="monotone"
                dataKey="gastado"
                name="Gastado"
                stroke="#e11d48"
                fill="url(#gGastado)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="invertido"
                name="Invertido"
                stroke="#0284c7"
                fill="url(#gInv)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="animate-rise" style={{ animationDelay: "180ms" }}>
        <CardHeader>
          <CardTitle>Gastos por categoría</CardTitle>
        </CardHeader>
        <CardContent className="h-64 pt-2">
          {byCategory.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-ink-muted">
              Aún no hay gastos este mes
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={byCategory}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                >
                  {byCategory.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => formatCurrency(value, currency)}
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid #e2e8f0",
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
          {byCategory.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {byCategory.slice(0, 5).map((c, i) => (
                <span
                  key={c.name}
                  className="inline-flex items-center gap-1.5 text-[11px] text-ink-muted"
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: COLORS[i % COLORS.length] }}
                  />
                  {c.name}
                </span>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
