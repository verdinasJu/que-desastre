"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Trash2,
  Pencil,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AppSheet } from "@/components/AppSheet";
import { createClient } from "@/lib/supabase/client";
import {
  INVESTMENT_PRESETS,
  positionCurrentValue,
} from "@/lib/investment-prices";
import { formatCurrency, cn } from "@/lib/utils";
import type { AssetKind, InvestmentPosition } from "@/lib/types";

interface InvestmentsClientProps {
  initialPositions: InvestmentPosition[];
  currency?: string;
}

const KINDS: { value: AssetKind; label: string }[] = [
  { value: "crypto", label: "Crypto" },
  { value: "etf", label: "ETF / fondo" },
  { value: "stock", label: "Acción" },
  { value: "other", label: "Otro" },
];

function emptyForm() {
  return {
    name: "",
    kind: "crypto" as AssetKind,
    symbol: "",
    quantity: "",
    costBasis: "",
  };
}

export function InvestmentsClient({
  initialPositions,
  currency = "EUR",
}: InvestmentsClientProps) {
  const router = useRouter();
  const [positions, setPositions] = useState(initialPositions);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<InvestmentPosition | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [form, setForm] = useState(emptyForm());

  useEffect(() => {
    setPositions(initialPositions);
  }, [initialPositions]);

  useEffect(() => {
    if (!initialPositions.length) return;
    let cancelled = false;
    (async () => {
      const priced = initialPositions.filter((p) => p.symbol);
      if (!priced.length) return;
      try {
        const res = await fetch("/api/prices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: priced.map((p) => ({
              id: p.id,
              asset_kind: p.asset_kind,
              symbol: p.symbol,
            })),
          }),
        });
        const data = await res.json();
        if (!res.ok || cancelled) return;

        const supabase = createClient();
        const now = new Date().toISOString();
        const updated = [...initialPositions];
        let changed = false;

        for (const quote of data.quotes || []) {
          const idx = updated.findIndex((p) => p.id === quote.id);
          if (idx < 0) continue;
          const pos = updated[idx];
          const price = quote.priceEur != null ? Number(quote.priceEur) : null;
          if (price == null || price <= 0) continue;
          const value = Math.round(Number(pos.quantity) * price * 100) / 100;
          const { data: row, error } = await supabase
            .from("investment_positions")
            .update({
              last_price: price,
              last_value: value,
              manual_value: null,
              priced_at: now,
              updated_at: now,
            })
            .eq("id", pos.id)
            .select()
            .single();
          if (!error && row) {
            updated[idx] = row as InvestmentPosition;
            changed = true;
          }
        }

        if (changed && !cancelled) {
          setPositions(updated);
          router.refresh();
        }
      } catch {
        /* ok */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPositions.map((p) => p.id).join(",")]);

  const totals = useMemo(() => {
    let cost = 0;
    let value = 0;
    for (const p of positions) {
      cost += Number(p.cost_basis) || 0;
      value += positionCurrentValue({
        quantity: Number(p.quantity),
        last_price: p.last_price,
        last_value: p.last_value,
      });
    }
    return { cost, value, pnl: value - cost };
  }, [positions]);

  const refreshPrices = useCallback(async () => {
    const priced = positions.filter((p) => p.symbol);
    if (!priced.length) {
      toast.message("Añade un símbolo a cada posición para precio automático");
      return;
    }

    setRefreshing(true);
    try {
      const res = await fetch("/api/prices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: priced.map((p) => ({
            id: p.id,
            asset_kind: p.asset_kind,
            symbol: p.symbol,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error de precios");

      const supabase = createClient();
      const now = new Date().toISOString();
      const updated: InvestmentPosition[] = [...positions];
      let ok = 0;

      for (const quote of data.quotes || []) {
        const idx = updated.findIndex((p) => p.id === quote.id);
        if (idx < 0) continue;
        const pos = updated[idx];
        const price = quote.priceEur != null ? Number(quote.priceEur) : null;
        if (price == null || price <= 0) continue;

        const value = Number(pos.quantity) * price;
        const { data: row, error } = await supabase
          .from("investment_positions")
          .update({
            last_price: price,
            last_value: Math.round(value * 100) / 100,
            manual_value: null,
            priced_at: now,
            updated_at: now,
          })
          .eq("id", pos.id)
          .select()
          .single();

        if (!error && row) {
          updated[idx] = row as InvestmentPosition;
          ok += 1;
        }
      }

      setPositions(updated);
      toast.success(
        ok ? `Precios actualizados (${ok})` : "No se pudo obtener ningún precio"
      );
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo actualizar");
    } finally {
      setRefreshing(false);
    }
  }, [positions, router]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setSheetOpen(true);
  }

  function openEdit(p: InvestmentPosition) {
    setEditing(p);
    setForm({
      name: p.name,
      kind: p.asset_kind,
      symbol: p.symbol || "",
      quantity: String(p.quantity),
      costBasis: String(p.cost_basis),
    });
    setSheetOpen(true);
  }

  function closeSheet() {
    setSheetOpen(false);
    setEditing(null);
    setForm(emptyForm());
  }

  function applyPreset(preset: (typeof INVESTMENT_PRESETS)[number]) {
    setForm((f) => ({
      ...f,
      name: preset.name,
      kind: preset.asset_kind,
      symbol: preset.symbol,
    }));
  }

  async function savePosition() {
    const qty = Number(form.quantity.replace(",", "."));
    const cost = Number(form.costBasis.replace(",", "."));
    const sym = form.symbol.trim();

    if (!form.name.trim()) {
      toast.error("Pon un nombre");
      return;
    }
    if (!sym) {
      toast.error("El símbolo es obligatorio para actualizar el precio solo");
      return;
    }
    if (!(qty > 0) || Number.isNaN(qty) || !(cost >= 0) || Number.isNaN(cost)) {
      toast.error("Cantidad > 0 y lo metido ≥ 0");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    let lastPrice: number | null = null;
    let lastValue: number | null = null;
    let pricedAt: string | null = null;

    try {
      const res = await fetch("/api/prices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [{ asset_kind: form.kind, symbol: sym }],
        }),
      });
      const data = await res.json();
      const price = data?.quotes?.[0]?.priceEur;
      if (typeof price === "number" && price > 0) {
        lastPrice = price;
        lastValue = Math.round(qty * price * 100) / 100;
        pricedAt = new Date().toISOString();
      }
    } catch {
      /* ok */
    }

    if (lastPrice == null) {
      setLoading(false);
      toast.error(
        "No se pudo obtener el precio de ese símbolo. Revisa el ticker (ej. bitcoin, 0P0001CJGV.F)."
      );
      return;
    }

    const payload = {
      name: form.name.trim(),
      asset_kind: form.kind,
      symbol: sym,
      quantity: qty,
      cost_basis: cost,
      manual_value: null,
      last_price: lastPrice,
      last_value: lastValue,
      priced_at: pricedAt,
      updated_at: new Date().toISOString(),
    };

    if (editing) {
      const { data, error } = await supabase
        .from("investment_positions")
        .update(payload)
        .eq("id", editing.id)
        .select()
        .single();

      setLoading(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      setPositions((prev) =>
        prev.map((p) => (p.id === editing.id ? (data as InvestmentPosition) : p))
      );
      toast.success("Inversión actualizada");
    } else {
      const { data, error } = await supabase
        .from("investment_positions")
        .insert({ ...payload, user_id: user.id })
        .select()
        .single();

      setLoading(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      setPositions((prev) => [data as InvestmentPosition, ...prev]);
      toast.success("Inversión añadida");
    }

    closeSheet();
    router.refresh();
  }

  async function removePosition(id: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from("investment_positions")
      .delete()
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setPositions((prev) => prev.filter((p) => p.id !== id));
    toast.success("Eliminada");
    router.refresh();
  }

  const isEdit = editing != null;

  return (
    <div className="space-y-4">
      <Card className="animate-rise overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Resumen de cartera</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-surface-2/80 px-3 py-3">
              <p className="text-[11px] text-ink-muted">Lo metido</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums text-ink">
                {formatCurrency(totals.cost, currency)}
              </p>
            </div>
            <div className="rounded-2xl bg-surface-2/80 px-3 py-3">
              <p className="text-[11px] text-ink-muted">Valor ahora</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums text-ink">
                {formatCurrency(totals.value, currency)}
              </p>
            </div>
          </div>
          <div
            className={cn(
              "flex items-center justify-between rounded-2xl px-3 py-3",
              totals.pnl >= 0 ? "bg-emerald-50" : "bg-rose-50"
            )}
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              {totals.pnl >= 0 ? (
                <TrendingUp className="h-4 w-4 text-emerald-700" />
              ) : (
                <TrendingDown className="h-4 w-4 text-rose-700" />
              )}
              {totals.pnl >= 0 ? "Ganancia" : "Pérdida"}
            </span>
            <span
              className={cn(
                "text-sm font-semibold tabular-nums",
                totals.pnl >= 0 ? "text-emerald-800" : "text-rose-800"
              )}
            >
              {totals.pnl >= 0 ? "+" : ""}
              {formatCurrency(totals.pnl, currency)}
            </span>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => void refreshPrices()}
              disabled={refreshing || positions.length === 0}
            >
              <RefreshCw
                className={cn("mr-2 h-4 w-4", refreshing && "animate-spin")}
              />
              Actualizar precios
            </Button>
            <Button type="button" className="flex-1" onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Añadir
            </Button>
          </div>
          <p className="text-[11px] leading-relaxed text-ink-muted">
            Los precios se actualizan solos al abrir la app (CoinGecko /
            Yahoo). Valor ahora = cantidad × precio de mercado.
          </p>
        </CardContent>
      </Card>

      {positions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-surface/50 px-4 py-10 text-center">
          <p className="text-sm text-ink-muted">
            Aún no hay posiciones. Añade BTC, XRP o Fidelity MSCI…
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {positions.map((p) => {
            const value = positionCurrentValue({
              quantity: Number(p.quantity),
              last_price: p.last_price,
              last_value: p.last_value,
            });
            const cost = Number(p.cost_basis) || 0;
            const pnl = value - cost;
            return (
              <li
                key={p.id}
                className="rounded-2xl border border-line/70 bg-surface px-3 py-3 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => openEdit(p)}
                  >
                    <p className="truncate text-sm font-semibold text-ink">
                      {p.name}
                    </p>
                    <p className="text-xs text-ink-muted">
                      {KINDS.find((k) => k.value === p.asset_kind)?.label}
                      {p.symbol ? ` · ${p.symbol}` : ""}
                      {" · "}
                      {Number(p.quantity)} uds
                    </p>
                  </button>
                  <div className="flex shrink-0 items-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-ink-faint hover:text-brand"
                      onClick={() => openEdit(p)}
                      aria-label="Editar"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-ink-faint hover:text-rose-600"
                      onClick={() => void removePosition(p.id)}
                      aria-label="Eliminar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="text-ink-muted">Metido</p>
                    <p className="font-medium tabular-nums text-ink">
                      {formatCurrency(cost, currency)}
                    </p>
                  </div>
                  <div>
                    <p className="text-ink-muted">Ahora</p>
                    <p className="font-medium tabular-nums text-ink">
                      {formatCurrency(value, currency)}
                    </p>
                  </div>
                  <div>
                    <p className="text-ink-muted">Resultado</p>
                    <p
                      className={cn(
                        "font-medium tabular-nums",
                        pnl >= 0 ? "text-emerald-700" : "text-rose-700"
                      )}
                    >
                      {pnl >= 0 ? "+" : ""}
                      {formatCurrency(pnl, currency)}
                    </p>
                  </div>
                </div>
                {p.priced_at ? (
                  <p className="mt-1.5 text-[10px] text-ink-faint">
                    {p.last_price != null
                      ? `Precio ${formatCurrency(Number(p.last_price), currency)} · `
                      : ""}
                    actualizado{" "}
                    {new Date(p.priced_at).toLocaleString("es-ES", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <AppSheet
        open={sheetOpen}
        onClose={closeSheet}
        title={isEdit ? "Editar inversión" : "Nueva inversión"}
        subtitle="Solo cantidad + lo metido; el valor ahora viene de la API"
      >
        <div className="space-y-4 pb-2">
          {!isEdit ? (
            <div>
              <p className="mb-2 text-xs font-medium text-ink-muted">Rápido</p>
              <div className="flex flex-wrap gap-2">
                {INVESTMENT_PRESETS.map((preset) => (
                  <button
                    key={preset.symbol}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    className="rounded-full border border-line bg-surface-2 px-3 py-1.5 text-xs font-medium text-ink transition hover:border-brand/40"
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label>Nombre</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Bitcoin"
            />
          </div>

          <div className="space-y-2">
            <Label>Tipo</Label>
            <div className="grid grid-cols-2 gap-2">
              {KINDS.map((k) => (
                <button
                  key={k.value}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, kind: k.value }))}
                  className={cn(
                    "rounded-xl border px-3 py-2 text-xs font-medium transition",
                    form.kind === k.value
                      ? "border-brand bg-brand/10 text-brand"
                      : "border-line text-ink-muted"
                  )}
                >
                  {k.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Símbolo (obligatorio)</Label>
            <Input
              value={form.symbol}
              onChange={(e) =>
                setForm((f) => ({ ...f, symbol: e.target.value }))
              }
              placeholder={
                form.kind === "crypto" ? "bitcoin" : "0P0001CJGV.F"
              }
            />
            <p className="text-[11px] text-ink-muted leading-relaxed">
              Crypto: bitcoin, ripple. Tu fondo TR: usa el chip{" "}
              <strong>Fidelity MSCI World</strong> (ticker automático).
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Cantidad</Label>
              <Input
                inputMode="decimal"
                value={form.quantity}
                onChange={(e) =>
                  setForm((f) => ({ ...f, quantity: e.target.value }))
                }
                placeholder="0.01"
              />
            </div>
            <div className="space-y-2">
              <Label>Lo metido (€)</Label>
              <Input
                inputMode="decimal"
                value={form.costBasis}
                onChange={(e) =>
                  setForm((f) => ({ ...f, costBasis: e.target.value }))
                }
                placeholder="1000"
              />
            </div>
          </div>

          <Button
            type="button"
            className="w-full"
            disabled={loading}
            onClick={() => void savePosition()}
          >
            {loading
              ? "Obteniendo precio…"
              : isEdit
                ? "Guardar cambios"
                : "Guardar inversión"}
          </Button>
        </div>
      </AppSheet>
    </div>
  );
}
