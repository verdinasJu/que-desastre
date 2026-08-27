"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { FilterBar, type MovementTypeFilter } from "@/components/FilterBar";
import { TransactionList } from "@/components/TransactionList";
import { TransactionForm } from "@/components/TransactionForm";
import { CsvImportButton } from "@/components/CsvImportButton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { currentMonthRange, formatCurrency, cn } from "@/lib/utils";
import type { Profile, Transaction } from "@/lib/types";

export default function MovimientosPage() {
  const range = currentMonthRange();
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState(range.start);
  const [to, setTo] = useState(range.end);
  const [typeFilter, setTypeFilter] = useState<MovementTypeFilter>("all");
  const [items, setItems] = useState<Transaction[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let q = supabase
      .from("transactions")
      .select("*")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    if (from) q = q.gte("date", from);
    if (to) q = q.lte("date", to);

    const [{ data, error }, profileRes] = await Promise.all([
      q,
      user
        ? supabase.from("profiles").select("*").eq("id", user.id).single()
        : Promise.resolve({ data: null }),
    ]);

    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setItems((data || []) as Transaction[]);
    if (profileRes.data) setProfile(profileRes.data as Profile);
  }, [from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((t) => {
      if (typeFilter !== "all" && t.type !== typeFilter) return false;
      if (!q) return true;
      return (
        t.description.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        t.type.toLowerCase().includes(q)
      );
    });
  }, [items, query, typeFilter]);

  const totals = useMemo(() => {
    let gastos = 0;
    let ingresos = 0;
    let inversiones = 0;
    for (const t of filtered) {
      const n = Number(t.amount) || 0;
      if (t.type === "expense") gastos += n;
      else if (t.type === "income") ingresos += n;
      else if (t.type === "investment") inversiones += n;
    }
    return { gastos, ingresos, inversiones, count: filtered.length };
  }, [filtered]);

  const currency = profile?.currency || "EUR";

  async function handleDelete(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from("transactions").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Eliminado");
    setItems((prev) => prev.filter((t) => t.id !== id));
  }

  async function handleEdit(values: {
    type: Transaction["type"];
    amount: number;
    description: string;
    category: string;
    date: string;
  }) {
    if (!editing) return;
    setSaving(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("transactions")
      .update(values)
      .eq("id", editing.id)
      .select()
      .single();
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setItems((prev) =>
      prev.map((t) => (t.id === editing.id ? (data as Transaction) : t))
    );
    setEditing(null);
    toast.success("Movimiento actualizado");
  }

  return (
    <div className="space-y-5">
      <header className="animate-rise flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Movimientos
          </h1>
          <p className="text-sm text-ink-muted">
            Filtra, edita o importa un CSV de tu banco.
          </p>
        </div>
        <CsvImportButton onImported={load} />
      </header>

      <FilterBar
        query={query}
        from={from}
        to={to}
        typeFilter={typeFilter}
        onQueryChange={setQuery}
        onFromChange={setFrom}
        onToChange={setTo}
        onTypeFilterChange={setTypeFilter}
      />

      {!loading ? (
        <div className="rounded-2xl border border-line/80 bg-surface px-4 py-3 shadow-sm">
          <p className="mb-2 text-[11px] font-medium text-ink-muted">
            Suma del filtro · {totals.count} movimiento
            {totals.count === 1 ? "" : "s"}
          </p>
          <div
            className={cn(
              "grid gap-2",
              typeFilter === "all" ? "grid-cols-3" : "grid-cols-1"
            )}
          >
            {(typeFilter === "all" || typeFilter === "expense") && (
              <div className="rounded-xl bg-rose-50 px-3 py-2">
                <p className="text-[11px] text-rose-700/80">Gastos</p>
                <p className="text-sm font-semibold tabular-nums text-rose-700">
                  −{formatCurrency(totals.gastos, currency)}
                </p>
              </div>
            )}
            {(typeFilter === "all" || typeFilter === "income") && (
              <div className="rounded-xl bg-emerald-50 px-3 py-2">
                <p className="text-[11px] text-emerald-700/80">Ingresos</p>
                <p className="text-sm font-semibold tabular-nums text-emerald-700">
                  +{formatCurrency(totals.ingresos, currency)}
                </p>
              </div>
            )}
            {(typeFilter === "all" || typeFilter === "investment") && (
              <div className="rounded-xl bg-sky-50 px-3 py-2">
                <p className="text-[11px] text-sky-700/80">Inversiones</p>
                <p className="text-sm font-semibold tabular-nums text-sky-700">
                  →{formatCurrency(totals.inversiones, currency)}
                </p>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-ink-muted">Cargando…</p>
      ) : (
        <TransactionList
          items={filtered}
          currency={currency}
          monthlySalary={Number(profile?.monthly_salary || 0)}
          hoursPerMonth={Number(profile?.hours_per_month || 160)}
          onDelete={handleDelete}
          onEdit={setEditing}
        />
      )}

      <Dialog
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditing(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar movimiento</DialogTitle>
            <DialogDescription>
              Cambia importe, tipo, categoría o fecha.
            </DialogDescription>
          </DialogHeader>
          {editing ? (
            <TransactionForm
              key={editing.id}
              initial={editing}
              loading={saving}
              submitLabel="Guardar cambios"
              monthlySalary={Number(profile?.monthly_salary || 0)}
              hoursPerMonth={Number(profile?.hours_per_month || 160)}
              onSubmit={handleEdit}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
