export type AssetKind = "crypto" | "etf" | "stock" | "other";

export interface InvestmentPreset {
  name: string;
  asset_kind: AssetKind;
  /** CoinGecko id o ticker Yahoo (ej. VWCE.DE) */
  symbol: string;
  hint: string;
}

/** Presets frecuentes (Trade Republic / Europa). */
export const INVESTMENT_PRESETS: InvestmentPreset[] = [
  {
    name: "Bitcoin",
    asset_kind: "crypto",
    symbol: "bitcoin",
    hint: "BTC · precio en vivo (CoinGecko)",
  },
  {
    name: "XRP",
    asset_kind: "crypto",
    symbol: "ripple",
    hint: "Ripple · precio en vivo (CoinGecko)",
  },
  {
    name: "MSCI World (VWCE)",
    asset_kind: "etf",
    symbol: "VWCE.DE",
    hint: "Vanguard FTSE All-World · si en TR usas otro, cambia el ticker",
  },
  {
    name: "MSCI World (IWDA)",
    asset_kind: "etf",
    symbol: "IWDA.AS",
    hint: "iShares Core MSCI World · Amsterdam",
  },
];

export async function fetchCryptoPricesEur(
  coinIds: string[]
): Promise<Record<string, number>> {
  const unique = Array.from(new Set(coinIds.filter(Boolean)));
  if (!unique.length) return {};

  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(
    unique.join(",")
  )}&vs_currencies=eur`;

  const res = await fetch(url, {
    next: { revalidate: 60 },
    headers: { Accept: "application/json" },
  });
  if (!res.ok) return {};

  const data = (await res.json()) as Record<string, { eur?: number }>;
  const out: Record<string, number> = {};
  for (const id of unique) {
    const p = data[id]?.eur;
    if (typeof p === "number" && p > 0) out[id.toLowerCase()] = p;
  }
  return out;
}

/** Precio de un ticker vía Yahoo Finance chart (sin API key). */
export async function fetchYahooPriceEur(
  ticker: string
): Promise<number | null> {
  const symbol = ticker.trim().toUpperCase();
  if (!symbol) return null;

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol
  )}?interval=1d&range=1d`;

  try {
    const res = await fetch(url, {
      next: { revalidate: 60 },
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 QueDesastre/1.0",
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    const price =
      Number(meta?.regularMarketPrice) ||
      Number(meta?.previousClose) ||
      Number(data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close?.at(-1));
    if (!price || price <= 0) return null;

    const currency = String(meta?.currency || "EUR").toUpperCase();
    if (currency === "EUR") return price;

    // Conversión aproximada USD/GBP → EUR si hace falta
    if (currency === "USD" || currency === "GBP") {
      const fx = await fetchFxToEur(currency);
      return fx ? price * fx : null;
    }
    return price;
  } catch {
    return null;
  }
}

async function fetchFxToEur(from: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://api.frankfurter.app/latest?from=${from}&to=EUR`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const rate = Number(data?.rates?.EUR);
    return rate > 0 ? rate : null;
  } catch {
    return null;
  }
}

export interface PriceQuote {
  symbol: string;
  priceEur: number | null;
  source: "coingecko" | "yahoo" | "none";
}

export async function fetchPricesForPositions(
  items: { asset_kind: AssetKind; symbol: string | null }[]
): Promise<PriceQuote[]> {
  const cryptos = items
    .filter((i) => i.asset_kind === "crypto" && i.symbol)
    .map((i) => i.symbol!.toLowerCase());
  const cryptoPrices = await fetchCryptoPricesEur(cryptos);

  const results: PriceQuote[] = [];

  for (const item of items) {
    const symbol = (item.symbol || "").trim();
    if (!symbol) {
      results.push({ symbol: "", priceEur: null, source: "none" });
      continue;
    }

    if (item.asset_kind === "crypto") {
      const p = cryptoPrices[symbol.toLowerCase()] ?? null;
      results.push({
        symbol,
        priceEur: p,
        source: p != null ? "coingecko" : "none",
      });
      continue;
    }

    if (item.asset_kind === "etf" || item.asset_kind === "stock") {
      const p = await fetchYahooPriceEur(symbol);
      results.push({
        symbol,
        priceEur: p,
        source: p != null ? "yahoo" : "none",
      });
      continue;
    }

    results.push({ symbol, priceEur: null, source: "none" });
  }

  return results;
}

export function positionCurrentValue(opts: {
  quantity: number;
  last_price: number | null | undefined;
  last_value: number | null | undefined;
  manual_value: number | null | undefined;
}): number {
  if (opts.manual_value != null && Number(opts.manual_value) >= 0) {
    return Number(opts.manual_value);
  }
  const qty = Number(opts.quantity) || 0;
  const price = Number(opts.last_price);
  if (qty > 0 && price > 0) return qty * price;
  if (opts.last_value != null && Number(opts.last_value) >= 0) {
    return Number(opts.last_value);
  }
  return 0;
}
