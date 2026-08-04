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
      .order("start_date", { ascending: false }),
    supabase.from("transactions").select("*").eq("user_id", user!.id),
  ]);

  const p = profile as Profile;
  const tripList = (trips || []) as Trip[];
  const tripIds = tripList.map((t) => t.id);

  const { data: allMembers } =
    tripIds.length > 0
      ? await supabase
          .from("trip_members")
          .select("trip_id")
          .in("trip_id", tripIds)
      : { data: [] as { trip_id: string }[] };

  const countByTrip = new Map<string, number>();
  for (const row of (allMembers || []) as { trip_id: string }[]) {
    countByTrip.set(row.trip_id, (countByTrip.get(row.trip_id) || 0) + 1);
  }

  const sharedTripIds = tripList
    .filter(
      (t) => t.user_id !== user!.id || (countByTrip.get(t.id) || 0) > 1
    )
    .map((t) => t.id);

  return (
    <div className="space-y-5">
      <header className="animate-rise space-y-2">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Modo viaje
        </h1>
        <p className="text-sm leading-relaxed text-ink-muted">
          Viajes individuales o compartidos. Invita con un código de un solo
          uso; cada uno ve cuánto ha gastado en su color.
        </p>
      </header>

      <TripsClient
        initialTrips={tripList}
        transactions={(txs || []) as Transaction[]}
        currency={p?.currency || "EUR"}
        userId={user!.id}
        sharedTripIds={sharedTripIds}
      />
    </div>
  );
}
