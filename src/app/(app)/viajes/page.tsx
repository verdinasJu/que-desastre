import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { TripsClient } from "@/components/TripsClient";
import type { Profile, Transaction, Trip } from "@/lib/types";

export default async function ViajesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: trips }, { data: txs }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user!.id).single(),
    supabase
      .from("trips")
      .select("*")
      .eq("user_id", user!.id)
      .order("start_date", { ascending: false }),
    supabase.from("transactions").select("*").eq("user_id", user!.id),
  ]);

  const p = profile as Profile;

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
          Modo viaje
        </h1>
        <p className="text-sm leading-relaxed text-ink-muted">
          Define fechas y presupuesto. Todos los gastos entre esas fechas
          cuentan para el viaje (así no tienes que etiquetar cada uno).
        </p>
      </header>

      <TripsClient
        initialTrips={(trips || []) as Trip[]}
        transactions={(txs || []) as Transaction[]}
        currency={p?.currency || "EUR"}
      />
    </div>
  );
}
