import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { CompoundCalculator } from "@/components/CompoundCalculator";
import type { Profile } from "@/lib/types";

export default async function CalculadoraPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user!.id)
    .single();

  const p = profile as Profile | null;
  const invested = Number(p?.initial_investments || 0);

  return (
    <div className="space-y-5">
      <header className="animate-rise space-y-2">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" /> Inicio
        </Link>
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
