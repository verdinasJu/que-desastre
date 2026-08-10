"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Check, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import type { Debt, DebtDirection } from "@/lib/types";

interface DebtsClientProps {
  initialDebts: Debt[];
  currency?: string;
}

function remaining(d: Debt) {
  return Math.max(0, Number(d.amount) - Number(d.paid_amount));
}

export function DebtsClient({
  initialDebts,
  currency = "EUR",
}: DebtsClientProps) {
  const router = useRouter();
  const [debts, setDebts] = useState(initialDebts);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [direction, setDirection] = useState<DebtDirection>("they_owe");
  const [person, setPerson] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");

  useEffect(() => {
    setDebts(initialDebts);
  }, [initialDebts]);

  const openDebts = useMemo(
    () => debts.filter((d) => !d.settled && remaining(d) > 0),
    [debts]
  );

  const theyOwe = useMemo(
    () =>
      openDebts
        .filter((d) => d.direction === "they_owe")
        .reduce((a, d) => a + remaining(d), 0),
    [openDebts]
  );

  const iOwe = useMemo(
    () =>
      openDebts
        .filter((d) => d.direction === "i_owe")
        .reduce((a, d) => a + remaining(d), 0),
    [openDebts]
  );

  async function addDebt() {
    const num = Number(amount.replace(",", "."));
    if (!person.trim() || !num || num <= 0) {
      toast.error("Indica persona e importe");
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

    const { data, error } = await supabase
      .from("debts")
      .insert({
        user_id: user.id,
        direction,
        person_name: person.trim(),
        description: description.trim(),
        amount: num,
        paid_amount: 0,
        due_date: dueDate || null,
        settled: false,
      })
      .select()
      .single();

    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }

    setDebts((prev) => [data as Debt, ...prev]);
    setPerson("");
    setDescription("");
    setAmount("");
    setDueDate("");
    setOpen(false);
    toast.success("Deuda añadida");
    router.refresh();
  }

  async function registerPayment(debt: Debt, payAll: boolean) {
    const rest = remaining(debt);
    if (rest <= 0) return;

    const add = payAll ? rest : rest;
    const newPaid = Number(debt.paid_amount) + add;
    const settled = newPaid >= Number(debt.amount);

    const supabase = createClient();
    const { data, error } = await supabase
      .from("debts")
      .update({ paid_amount: newPaid, settled })
      .eq("id", debt.id)
      .select()
      .single();

    if (error) {
      toast.error(error.message);
      return;
    }

    setDebts((prev) =>
      prev.map((d) => (d.id === debt.id ? (data as Debt) : d))
    );
    toast.success(settled ? "Saldo liquidado" : "Pago registrado");
    router.refresh();
  }

  async function removeDebt(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from("debts").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setDebts((prev) => prev.filter((d) => d.id !== id));
    toast.success("Eliminada");
    router.refresh();
  }

  function renderList(items: Debt[], type: DebtDirection) {
    const filtered = items.filter(
      (d) => d.direction === type && !d.settled && remaining(d) > 0
    );
    const settledItems = items.filter(
      (d) => d.direction === type && (d.settled || remaining(d) <= 0)
    );

    return (
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line bg-surface/50 px-4 py-6 text-center text-sm text-ink-muted">
            {type === "they_owe"
              ? "Nadie te debe nada pendiente."
              : "No debes nada pendiente."}
          </p>
        ) : (
          <ul className="space-y-2">
            {filtered.map((d) => {
              const rest = remaining(d);
              const overdue =
                d.due_date && d.due_date < new Date().toISOString().slice(0, 10);
              return (
                <li
                  key={d.id}
                  className={cn(
                    "rounded-2xl border bg-surface p-4 shadow-sm",
                    overdue ? "border-amber-200" : "border-line/80"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-ink">{d.person_name}</p>
                      {d.description ? (
                        <p className="mt-0.5 text-xs text-ink-muted leading-snug">
                          {d.description}
                        </p>
                      ) : null}
                      <p className="mt-1.5 text-sm">
                        <span className="font-semibold tabular-nums text-ink">
                          {formatCurrency(rest, currency)}
                        </span>
                        <span className="text-ink-muted">
                          {" "}
                          de {formatCurrency(Number(d.amount), currency)}
                        </span>
                      </p>
                      {d.due_date ? (
                        <p
                          className={cn(
                            "mt-0.5 text-xs",
                            overdue
                              ? "font-medium text-amber-700"
                              : "text-ink-muted"
                          )}
                        >
                          {overdue ? "Vencida · " : "Vence · "}
                          {formatDate(d.due_date)}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        title="Marcar como pagado"
                        onClick={() => registerPayment(d, true)}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => removeDebt(d.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {settledItems.length > 0 ? (
          <details className="text-sm">
            <summary className="cursor-pointer text-ink-muted hover:text-ink">
              Liquidadas ({settledItems.length})
            </summary>
            <ul className="mt-2 space-y-1.5">
              {settledItems.map((d) => (
                <li
                  key={d.id}
                  className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2 text-xs text-ink-muted"
                >
                  <span>{d.person_name}</span>
                  <span>{formatCurrency(Number(d.amount), currency)}</span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-800">
            <ArrowDownLeft className="h-3.5 w-3.5" /> Te deben
          </p>
          <p className="mt-1 font-display text-xl font-semibold tabular-nums text-emerald-950">
            {formatCurrency(theyOwe, currency)}
          </p>
        </div>
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
          <p className="flex items-center gap-1.5 text-xs font-medium text-rose-800">
            <ArrowUpRight className="h-3.5 w-3.5" /> Debes tú
          </p>
          <p className="mt-1 font-display text-xl font-semibold tabular-nums text-rose-950">
            {formatCurrency(iOwe, currency)}
          </p>
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOpen((v) => !v)}
        >
          <Plus className="h-4 w-4" /> Añadir deuda
        </Button>
      </div>

      {open ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nueva deuda</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDirection("they_owe")}
                className={cn(
                  "rounded-xl border px-3 py-2.5 text-left text-sm transition",
                  direction === "they_owe"
                    ? "border-emerald-300 bg-emerald-50 font-semibold text-emerald-900"
                    : "border-line bg-surface-2 text-ink-muted"
                )}
              >
                Me deben
              </button>
              <button
                type="button"
                onClick={() => setDirection("i_owe")}
                className={cn(
                  "rounded-xl border px-3 py-2.5 text-left text-sm transition",
                  direction === "i_owe"
                    ? "border-rose-300 bg-rose-50 font-semibold text-rose-900"
                    : "border-line bg-surface-2 text-ink-muted"
                )}
              >
                Debo yo
              </button>
            </div>
            <div className="space-y-1.5">
              <Label>Persona</Label>
              <Input
                placeholder="María, Juan, el casero…"
                value={person}
                onChange={(e) => setPerson(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Importe (€)</Label>
              <Input
                inputMode="decimal"
                placeholder="50"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Concepto (opcional)</Label>
              <Input
                placeholder="Cena, préstamo, alquiler…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Fecha límite (opcional)</Label>
              <DateInput
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <Button className="w-full" onClick={addDebt} disabled={loading}>
              {loading ? "Guardando…" : "Guardar"}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <section className="space-y-2">
        <h2 className="font-display text-lg font-semibold">Te deben</h2>
        {renderList(debts, "they_owe")}
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-lg font-semibold">Debes tú</h2>
        {renderList(debts, "i_owe")}
      </section>
    </div>
  );
}
