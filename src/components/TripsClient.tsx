"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Plane, Share2, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { ShareSpendBar, type ShareSpendRow } from "@/components/ShareSpendBar";
import { RedeemInviteCard } from "@/components/RedeemInviteCard";
import type { Trip, Transaction } from "@/lib/types";

interface TripsClientProps {
  initialTrips: Trip[];
  transactions: Transaction[];
  currency?: string;
  userId: string;
  sharedTripIds: string[];
}

export function TripsClient({
  initialTrips,
  transactions,
  currency = "EUR",
  userId,
  sharedTripIds,
}: TripsClientProps) {
  const router = useRouter();
  const [trips, setTrips] = useState(initialTrips);
  const [name, setName] = useState("");
  const [budget, setBudget] = useState("");
  const [start, setStart] = useState(new Date().toISOString().slice(0, 10));
  const [end, setEnd] = useState(new Date().toISOString().slice(0, 10));
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [inviteShown, setInviteShown] = useState<Record<string, string>>({});
  const [shareSpend, setShareSpend] = useState<Record<string, ShareSpendRow[]>>(
    {}
  );
  const sharedSet = useMemo(() => new Set(sharedTripIds), [sharedTripIds]);

  useEffect(() => {
    setTrips(initialTrips);
  }, [initialTrips]);

  useEffect(() => {
    async function loadShared() {
      const ids = trips.filter((t) => sharedSet.has(t.id)).map((t) => t.id);
      if (!ids.length) {
        setShareSpend({});
        return;
      }
      const supabase = createClient();
      const next: Record<string, ShareSpendRow[]> = {};
      await Promise.all(
        ids.map(async (id) => {
          const { data, error } = await supabase.rpc("trip_shared_spending", {
            p_trip_id: id,
          });
          if (!error && data) {
            next[id] = (data as ShareSpendRow[]).map((r) => ({
              ...r,
              spent: Number(r.spent),
            }));
          } else if (error) {
            toast.error(error.message);
          }
        })
      );
      setShareSpend(next);
    }
    loadShared();
  }, [trips, sharedSet]);

  const today = new Date().toISOString().slice(0, 10);

  function spentInDates(trip: Trip) {
    const byId = transactions
      .filter((t) => t.type === "expense" && t.trip_id === trip.id)
      .reduce((acc, t) => acc + Number(t.amount), 0);
    if (byId > 0) return byId;
    return transactions
      .filter(
        (t) =>
          t.type === "expense" &&
          t.date >= trip.start_date &&
          t.date <= trip.end_date
      )
      .reduce((acc, t) => acc + Number(t.amount), 0);
  }

  async function createTrip() {
    const b = Number(budget.replace(",", ".")) || 0;
    if (!name.trim() || !start || !end || end < start) {
      toast.error("Revisa nombre y fechas");
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
      .from("trips")
      .insert({
        user_id: user.id,
        name: name.trim(),
        start_date: start,
        end_date: end,
        budget: b,
      })
      .select()
      .single();
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setTrips((prev) => [data as Trip, ...prev]);
    setName("");
    setBudget("");
    setOpen(false);
    toast.success("Viaje creado");
    router.refresh();
  }

  async function removeTrip(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from("trips").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setTrips((prev) => prev.filter((t) => t.id !== id));
    toast.success("Viaje eliminado");
    router.refresh();
  }

  async function invite(id: string) {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("create_share_invite", {
      p_resource_type: "trip",
      p_resource_id: id,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    const code = String(data);
    setInviteShown((prev) => ({ ...prev, [id]: code }));
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Código copiado (un solo uso)");
    } catch {
      toast.success(`Código: ${code}`);
    }
  }

  const active = useMemo(
    () =>
      trips.find((t) => t.start_date <= today && t.end_date >= today) || null,
    [trips, today]
  );

  return (
    <div className="space-y-5">
      {active ? (
        <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
          <p className="font-semibold flex items-center gap-2">
            <Plane className="h-4 w-4" /> Viaje activo: {active.name}
          </p>
          <p className="mt-1 text-sky-900/80">
            {formatDate(active.start_date)} → {formatDate(active.end_date)}.
            Los gastos entre esas fechas cuentan para el presupuesto del viaje.
          </p>
        </div>
      ) : null}

      <RedeemInviteCard hint="Si te han pasado un código de viaje, únete aquí (un solo uso)." />

      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOpen((v) => !v)}
        >
          <Plus className="h-4 w-4" /> Nuevo viaje
        </Button>
      </div>

      {open ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Crear viaje</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nombre</Label>
              <Input
                placeholder="Lisboa, puente de mayo…"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="min-w-0 space-y-1.5">
                <Label>Inicio</Label>
                <DateInput
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </div>
              <div className="min-w-0 space-y-1.5">
                <Label>Fin</Label>
                <DateInput
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Presupuesto (€)</Label>
              <Input
                inputMode="decimal"
                placeholder="500"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
              />
            </div>
            <Button className="w-full" onClick={createTrip} disabled={loading}>
              {loading ? "Guardando…" : "Crear"}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {trips.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-surface/50 px-4 py-10 text-center text-sm text-ink-muted">
          Crea un viaje con fechas y presupuesto. Puedes dejarlo solo tuyo o
          invitar con un código de un solo uso.
        </div>
      ) : (
        <ul className="space-y-3">
          {trips.map((trip) => {
            const isShared = sharedSet.has(trip.id);
            const isOwner = trip.user_id === userId;
            const spent = spentInDates(trip);
            const limit = Number(trip.budget) || 0;
            const pct =
              limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 0;
            const over = limit > 0 && spent > limit;
            const isActive =
              trip.start_date <= today && trip.end_date >= today;
            const rows = shareSpend[trip.id] || [];

            return (
              <li
                key={trip.id}
                className="rounded-2xl border border-line/80 bg-surface p-4 shadow-sm space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">
                      {trip.name}
                      {isActive ? (
                        <span className="ml-2 text-xs font-medium text-sky-600">
                          ahora
                        </span>
                      ) : null}
                      {isShared ? (
                        <span className="ml-2 text-xs font-medium text-ink-muted">
                          compartido
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-ink-muted">
                      {formatDate(trip.start_date)} →{" "}
                      {formatDate(trip.end_date)}
                    </p>
                    {!isShared ? (
                      <p className="mt-1 text-xs text-ink-muted">
                        Gastado {formatCurrency(spent, currency)}
                        {limit > 0
                          ? ` de ${formatCurrency(limit, currency)}`
                          : " (sin tope)"}
                        {over ? " · te has pasado" : ""}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-1">
                    {isOwner ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => invite(trip.id)}
                      >
                        <Share2 className="h-3.5 w-3.5" />
                        Invitar
                      </Button>
                    ) : null}
                    {isOwner ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => removeTrip(trip.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                </div>

                {inviteShown[trip.id] ? (
                  <div className="flex items-center justify-between gap-2 rounded-xl bg-surface-2 px-3 py-2 text-sm">
                    <span className="font-mono tracking-widest font-semibold">
                      {inviteShown[trip.id]}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={async () => {
                        await navigator.clipboard.writeText(
                          inviteShown[trip.id]
                        );
                        toast.success("Copiado");
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                ) : null}

                {isShared && rows.length > 0 ? (
                  <ShareSpendBar
                    rows={rows}
                    limit={limit}
                    currency={currency}
                    currentUserId={userId}
                  />
                ) : limit > 0 && !isShared ? (
                  <>
                    <div className="h-2.5 overflow-hidden rounded-full bg-surface-3">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          over
                            ? "bg-rose-500"
                            : pct >= 80
                              ? "bg-amber-500"
                              : "bg-sky-500"
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="mt-1 text-right text-xs text-ink-muted">
                      {pct}%
                    </p>
                  </>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
