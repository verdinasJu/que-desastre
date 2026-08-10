import { NextResponse } from "next/server";
import {
  fetchPricesForPositions,
  type AssetKind,
} from "@/lib/investment-prices";

export const dynamic = "force-dynamic";

interface PriceRequestItem {
  id?: string;
  asset_kind: AssetKind;
  symbol: string | null;
}

/**
 * POST { items: [{ id?, asset_kind, symbol }] }
 * → { quotes: [{ id?, symbol, priceEur, source }] }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const items = (body?.items || []) as PriceRequestItem[];
    if (!Array.isArray(items) || items.length > 40) {
      return NextResponse.json({ error: "Lista inválida" }, { status: 400 });
    }

    const quotes = await fetchPricesForPositions(
      items.map((i) => ({
        asset_kind: i.asset_kind,
        symbol: i.symbol,
      }))
    );

    return NextResponse.json({
      quotes: quotes.map((q, idx) => ({
        id: items[idx]?.id,
        ...q,
      })),
    });
  } catch (e) {
    console.error("prices api", e);
    return NextResponse.json(
      { error: "No se pudieron obtener precios" },
      { status: 502 }
    );
  }
}
