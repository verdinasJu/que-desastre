import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchPricesForPositions } from "@/lib/investment-prices";
import type { InvestmentPosition } from "@/lib/types";

const STALE_MS = 15 * 60 * 1000; // 15 min

function isStale(pricedAt: string | null | undefined) {
  if (!pricedAt) return true;
  return Date.now() - new Date(pricedAt).getTime() > STALE_MS;
}

/**
 * Actualiza precios de la cartera si están caducados (inicio / cualquier página).
 * No toca posiciones con valor manual.
 */
export async function ensureInvestmentPrices(
  supabase: SupabaseClient,
  userId: string,
  existing?: InvestmentPosition[]
): Promise<boolean> {
  let positions = existing;
  if (!positions) {
    const { data } = await supabase
      .from("investment_positions")
      .select("*")
      .eq("user_id", userId);
    positions = (data || []) as InvestmentPosition[];
  }

  const toUpdate = positions.filter(
    (p) =>
      p.symbol &&
      p.asset_kind !== "other" &&
      p.manual_value == null &&
      isStale(p.priced_at)
  );

  if (!toUpdate.length) return false;

  const quotes = await fetchPricesForPositions(
    toUpdate.map((p) => ({
      asset_kind: p.asset_kind,
      symbol: p.symbol,
    }))
  );

  const now = new Date().toISOString();
  let any = false;

  for (let i = 0; i < toUpdate.length; i++) {
    const pos = toUpdate[i];
    const price = quotes[i]?.priceEur;
    if (price == null || price <= 0) continue;

    const value = Math.round(Number(pos.quantity) * price * 100) / 100;
    const { error } = await supabase
      .from("investment_positions")
      .update({
        last_price: price,
        last_value: value,
        priced_at: now,
        updated_at: now,
      })
      .eq("id", pos.id)
      .eq("user_id", userId);

    if (!error) any = true;
  }

  return any;
}
