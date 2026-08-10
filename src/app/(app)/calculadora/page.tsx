import { createClient } from "@/lib/supabase/server";
import { CompoundCalculator } from "@/components/CompoundCalculator";
import { calcInvestmentsMarketValue } from "@/lib/stats";
import type { InvestmentPosition, Profile } from "@/lib/types";

export default async function CalculadoraPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: positions }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user!.id).single(),
    supabase
      .from("investment_positions")
      .select("*")
      .eq("user_id", user!.id),
  ]);

  const p = profile as Profile | null;
  const invested = calcInvestmentsMarketValue(
    p || ({ initial_investments: 0 } as Profile),
    (positions || []) as InvestmentPosition[]
  );

  return (
    <div className="space-y-5">
      <header className="animate-rise space-y-2">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Calculadora
        </h1>
        <p className="text-sm leading-relaxed text-ink-muted">
          Estima cómo puede crecer tu dinero con interés compuesto. No es una
          predicción: es una simulación con la rentabilidad que indiques.
        </p>
      </header>

      <CompoundCalculator
        initialPrincipal={invested}
        currency={p?.currency || "EUR"}
      />
    </div>
  );
}
