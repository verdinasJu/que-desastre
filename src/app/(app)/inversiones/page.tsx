import { createClient } from "@/lib/supabase/server";
import { InvestmentsClient } from "@/components/InvestmentsClient";
import type { InvestmentPosition, Profile } from "@/lib/types";

export default async function InversionesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: positions }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user!.id).single(),
    supabase
      .from("investment_positions")
      .select("*")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false }),
  ]);

  const p = profile as Profile;

  return (
    <div className="space-y-5">
      <header className="animate-rise space-y-2">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Inversiones
        </h1>
        <p className="text-sm leading-relaxed text-ink-muted">
          Lo que metiste en cada activo y cuánto vale ahora. Si bajó, lo verás
          en rojo; si subió, en verde. El patrimonio del inicio usa este valor.
        </p>
      </header>

      <InvestmentsClient
        initialPositions={(positions || []) as InvestmentPosition[]}
        currency={p?.currency || "EUR"}
      />
    </div>
  );
}
