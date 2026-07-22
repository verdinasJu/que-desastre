"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import type { SavingsGoal } from "@/lib/types";

interface GoalsSectionProps {
  initialGoals: SavingsGoal[];
  currency?: string;
}

export function GoalsSection({
  initialGoals,
  currency = "EUR",
}: GoalsSectionProps) {
  const router = useRouter();
  const [goals, setGoals] = useState(initialGoals);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [current, setCurrent] = useState("");
  const [deadline, setDeadline] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function addGoal() {
    const t = Number(target.replace(",", "."));
    const c = Number(current.replace(",", ".")) || 0;
    if (!name.trim() || !t) return;
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
      .from("savings_goals")
      .insert({
        user_id: user.id,
        name: name.trim(),
        target_amount: t,
        current_amount: c,
        deadline: deadline || null,
      })
      .select()
      .single();
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setGoals((prev) => [data as SavingsGoal, ...prev]);
    setName("");
    setTarget("");
    setCurrent("");
    setDeadline("");
    setOpen(false);
    toast.success("Meta creada");
    router.refresh();
  }

  async function addProgress(goal: SavingsGoal, delta: number) {
    const next = Math.max(0, Number(goal.current_amount) + delta);
    const supabase = createClient();
    const { error } = await supabase
      .from("savings_goals")
      .update({ current_amount: next })
      .eq("id", goal.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setGoals((prev) =>
      prev.map((g) =>
        g.id === goal.id ? { ...g, current_amount: next } : g
      )
    );
    router.refresh();
  }

  async function removeGoal(id: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from("savings_goals")
      .delete()
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setGoals((prev) => prev.filter((g) => g.id !== id));
    toast.success("Meta eliminada");
    router.refresh();
  }

  return (
    <section className="animate-rise space-y-3" style={{ animationDelay: "80ms" }}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-xl font-semibold">Metas de ahorro</h2>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOpen((v) => !v)}
        >
          <Plus className="h-4 w-4" />
          Nueva
        </Button>
      </div>

      {open ? (
        <div className="space-y-3 rounded-2xl border border-line bg-surface p-4">
          <div className="space-y-1.5">
            <Label>Nombre</Label>
            <Input
              placeholder="Ej. Viaje, fondo emergencia…"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="min-w-0 space-y-1.5">
              <Label>Objetivo (€)</Label>
              <Input
                inputMode="decimal"
                placeholder="1000"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              />
            </div>
            <div className="min-w-0 space-y-1.5">
              <Label>Ya ahorrado (€)</Label>
              <Input
                inputMode="decimal"
                placeholder="0"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Fecha límite (opcional)</Label>
            <DateInput
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>
          <Button className="w-full" onClick={addGoal} disabled={loading}>
            {loading ? "Guardando…" : "Crear meta"}
          </Button>
        </div>
      ) : null}

      {goals.length === 0 && !open ? (
        <p className="rounded-2xl border border-dashed border-line bg-surface/50 px-4 py-6 text-center text-sm text-ink-muted">
          Crea una meta (ej. 1000 € en 6 meses) y ve el progreso.
        </p>
      ) : (
        <ul className="space-y-3">
          {goals.map((g) => {
            const cur = Number(g.current_amount);
            const tgt = Number(g.target_amount);
            const pct = Math.min(100, Math.round((cur / tgt) * 100));
            const done = cur >= tgt;
            return (
              <li
                key={g.id}
                className="rounded-2xl border border-line/80 bg-surface p-4 shadow-sm"
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">{g.name}</p>
                    <p className="text-xs text-ink-muted">
                      {formatCurrency(cur, currency)} /{" "}
                      {formatCurrency(tgt, currency)}
                      {g.deadline
                        ? ` · hasta ${formatDate(g.deadline)}`
                        : ""}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => removeGoal(g.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-surface-3">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      done ? "bg-emerald-500" : "bg-sky-500"
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-ink-muted">
                    {pct}%
                  </span>
                  <div className="flex gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => addProgress(g, 50)}
                    >
                      +50 €
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => addProgress(g, 100)}
                    >
                      +100 €
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
