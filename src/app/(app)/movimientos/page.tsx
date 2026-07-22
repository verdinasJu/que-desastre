"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { FilterBar } from "@/components/FilterBar";
import { TransactionList } from "@/components/TransactionList";
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

  return (
    <div className="space-y-5">
      <header className="animate-rise space-y-1">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Movimientos
        </h1>
        <p className="text-sm text-ink-muted">
          Filtra por fechas o busca en descripción y categoría.
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
        <TransactionList items={filtered} onDelete={handleDelete} />
      )}
    </div>
  );
}
