"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { FilterBar } from "@/components/FilterBar";
import { TransactionList } from "@/components/TransactionList";
import { TransactionForm } from "@/components/TransactionForm";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { currentMonthRange } from "@/lib/utils";
import type { Transaction } from "@/lib/types";

export default function MovimientosPage() {
  const range = currentMonthRange();
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState(range.start);
  const [to, setTo] = useState(range.end);
  const [items, setItems] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    let q = supabase
      .from("transactions")
      .select("*")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    if (from) q = q.gte("date", from);
    if (to) q = q.lte("date", to);

    const { data, error } = await q;
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setItems((data || []) as Transaction[]);
  }, [from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (t) =>
        t.description.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        t.type.toLowerCase().includes(q)
    );
  }, [items, query]);

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
      <header className="animate-rise space-y-1">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Movimientos
        </h1>
        <p className="text-sm text-ink-muted">
          Filtra por fechas o busca. Toca un movimiento o el lápiz para editarlo.
        </p>
      </header>

      <FilterBar
        query={query}
        from={from}
        to={to}
        onQueryChange={setQuery}
        onFromChange={setFrom}
        onToChange={setTo}
      />

      {loading ? (
        <p className="text-sm text-ink-muted">Cargando…</p>
      ) : (
        <TransactionList
          items={filtered}
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
              onSubmit={handleEdit}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
