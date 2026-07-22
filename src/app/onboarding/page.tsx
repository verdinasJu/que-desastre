"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";

type FixedDraft = { name: string; amount: string; category: string };

const STEPS = ["Ingresos", "Patrimonio", "Gastos fijos"] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [salary, setSalary] = useState("");
  const [payday, setPayday] = useState("1");
  const [savings, setSavings] = useState("");
  const [investments, setInvestments] = useState("");
  const [fixed, setFixed] = useState<FixedDraft[]>([
    { name: "Alquiler", amount: "", category: "Vivienda" },
    { name: "Teléfono", amount: "", category: "Servicios" },
    { name: "Gym", amount: "", category: "Salud" },
  ]);

  function updateFixed(i: number, patch: Partial<FixedDraft>) {
    setFixed((prev) => prev.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  }

  async function finish() {
    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      toast.error("Sesión no válida");
      setLoading(false);
      return;
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .upsert({
        id: user.id,
        monthly_salary: Number(salary.replace(",", ".")) || 0,
        payday_day: Math.min(28, Math.max(1, Number(payday) || 1)),
        initial_savings: Number(savings.replace(",", ".")) || 0,
        initial_investments: Number(investments.replace(",", ".")) || 0,
        currency: "EUR",
        onboarding_completed: true,
        onboarding_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    if (profileError) {
      toast.error(profileError.message);
      setLoading(false);
      return;
    }

    const rows = fixed
      .filter((f) => f.name.trim() && Number(f.amount.replace(",", ".")) > 0)
      .map((f) => ({
        user_id: user.id,
        name: f.name.trim(),
        amount: Number(f.amount.replace(",", ".")),
        category: f.category || "Fijos",
        active: true,
      }));

    if (rows.length) {
      const { error } = await supabase.from("fixed_expenses").insert(rows);
      if (error) {
        toast.error(error.message);
        setLoading(false);
        return;
      }
    }

    setLoading(false);
    toast.success("¡Listo! Tu panel está preparado.");
    router.replace("/");
    router.refresh();
  }

  const fixedTotal = fixed.reduce(
    (acc, f) => acc + (Number(f.amount.replace(",", ".")) || 0),
    0
  );

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-5 py-8">
      <header className="mb-8 animate-rise space-y-3">
        <p className="font-display text-3xl font-semibold text-ink">
          Que Desastre
        </p>
        <p className="text-sm text-ink-muted">
          Configuración inicial · paso {step + 1} de {STEPS.length}
        </p>
        <div className="flex gap-2">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition ${
                i <= step ? "bg-brand" : "bg-surface-3"
              }`}
            />
          ))}
        </div>
      </header>

      <div className="flex-1 animate-rise space-y-5" key={step}>
        {step === 0 && (
          <>
            <h1 className="font-display text-2xl font-semibold">
              ¿Cuánto ingresas al mes?
            </h1>
            <p className="text-sm text-ink-muted">
              Nómina, autónomo, pensión, ayudas… Lo usamos para calcular cuánto
              te queda para gastar y ahorrar cada mes.
            </p>
            <div className="space-y-2">
              <Label htmlFor="salary">Ingreso mensual habitual (€)</Label>
              <Input
                id="salary"
                inputMode="decimal"
                placeholder="1700"
                value={salary}
                onChange={(e) => setSalary(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payday">¿Qué día del mes lo cobras?</Label>
              <Input
                id="payday"
                inputMode="numeric"
                type="number"
                min={1}
                max={28}
                placeholder="1"
                value={payday}
                onChange={(e) => setPayday(e.target.value)}
              />
              <p className="text-xs text-ink-muted leading-relaxed">
                Guardamos el día para registrar el ingreso solo a partir del
                próximo cobro. No se suma ahora a tu patrimonio (para no
                descuadrar lo que acabas de indicar).
              </p>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <h1 className="font-display text-2xl font-semibold">
              Tu patrimonio actual
            </h1>
            <p className="text-sm text-ink-muted">
              El ahorro e inversión inicial forman tu patrimonio. Las futuras
              inversiones no se “pierden”: se mueven de caja a invertido.
            </p>
            <div className="space-y-2">
              <Label htmlFor="savings">Ahorro actual (€)</Label>
              <Input
                id="savings"
                inputMode="decimal"
                placeholder="2000"
                value={savings}
                onChange={(e) => setSavings(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="investments">Inversiones actuales (€)</Label>
              <Input
                id="investments"
                inputMode="decimal"
                placeholder="5000"
                value={investments}
                onChange={(e) => setInvestments(e.target.value)}
              />
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="font-display text-2xl font-semibold">
              Gastos fijos del mes
            </h1>
            <p className="text-sm text-ink-muted">
              Alquiler, teléfono, gym… Se restan cada mes del disponible.
            </p>
            <div className="space-y-3">
              {fixed.map((f, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[1fr_100px_auto] gap-2 rounded-xl border border-line bg-surface p-3"
                >
                  <Input
                    placeholder="Nombre"
                    value={f.name}
                    onChange={(e) => updateFixed(i, { name: e.target.value })}
                  />
                  <Input
                    inputMode="decimal"
                    placeholder="€"
                    value={f.amount}
                    onChange={(e) => updateFixed(i, { amount: e.target.value })}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setFixed((prev) => prev.filter((_, idx) => idx !== i))
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() =>
                setFixed((prev) => [
                  ...prev,
                  { name: "", amount: "", category: "Fijos" },
                ])
              }
            >
              <Plus className="h-4 w-4" /> Añadir gasto fijo
            </Button>
            <p className="text-sm text-ink-muted">
              Total fijos:{" "}
              <span className="font-semibold text-ink">
                {formatCurrency(fixedTotal)}
              </span>
            </p>
          </>
        )}
      </div>

      <div className="mt-8 flex gap-3">
        {step > 0 ? (
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => setStep((s) => s - 1)}
          >
            Atrás
          </Button>
        ) : null}
        {step < STEPS.length - 1 ? (
          <Button
            type="button"
            className="flex-1"
            onClick={() => setStep((s) => s + 1)}
          >
            Continuar
          </Button>
        ) : (
          <Button
            type="button"
            className="flex-1"
            disabled={loading}
            onClick={finish}
          >
            {loading ? "Guardando…" : "Empezar"}
          </Button>
        )}
      </div>
    </main>
  );
}
