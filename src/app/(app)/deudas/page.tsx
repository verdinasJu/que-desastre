import { createClient } from "@/lib/supabase/server";
import { DebtsClient } from "@/components/DebtsClient";
import type { Debt, Profile } from "@/lib/types";

export default async function DeudasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: debts }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user!.id).single(),
    supabase
      .from("debts")
      .select("*")
      .eq("user_id", user!.id)
      .order("settled", { ascending: true })
      .order("created_at", { ascending: false }),
  ]);

  const p = profile as Profile;

  return (
    <div className="space-y-5">
      <header className="animate-rise space-y-2">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Deudas
        </h1>
        <p className="text-sm leading-relaxed text-ink-muted">
          Lo que te deben y lo que debes tú. Es una lista aparte: no mueve el
          patrimonio hasta que lo registres como movimiento.
        </p>
      </header>

      <DebtsClient
        initialDebts={(debts || []) as Debt[]}
        currency={p?.currency || "EUR"}
      />
    </div>
  );
}
