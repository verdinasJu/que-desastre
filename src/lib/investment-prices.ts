export type AssetKind = "crypto" | "etf" | "stock" | "other";

export interface InvestmentPreset {
  name: string;
  asset_kind: AssetKind;
  /** CoinGecko id o ticker Yahoo (ej. VWCE.DE) */
  symbol: string;
  hint: string;
}

/** ISIN conocidos → ticker Yahoo que sí cotiza. */
const ISIN_TO_YAHOO: Record<string, string> = {
  IE00BYX5P602: "0P0001CJGV.F", // Fidelity MSCI World P EUR Hedged Acc (TR)
  IE00BYX5NX33: "0P0001CLDK.F", // Fidelity MSCI World P EUR Acc (sin hedge)
};

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
    name: "Fidelity MSCI World",
    asset_kind: "etf",
    symbol: "0P0001CJGV.F",
    hint: "Fidelity MSCI World EUR Hedged (el de Trade Republic)",
  },
  {
    name: "MSCI World (VWCE)",
    asset_kind: "etf",
    symbol: "VWCE.DE",
    hint: "Vanguard FTSE All-World",
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

function isIsin(s: string) {
  return /^[A-Z]{2}[A-Z0-9]{9}\d$/i.test(s.trim());
}

/** Resuelve ISIN / alias a un símbolo Yahoo usable. */
export async function resolveYahooSymbol(input: string): Promise<string> {
  const raw = input.trim();
  if (!raw) return "";

  const upper = raw.toUpperCase();
  if (ISIN_TO_YAHOO[upper]) return ISIN_TO_YAHOO[upper];

  if (!isIsin(upper) && !upper.includes(" ")) return raw;

  try {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
      raw
    )}&quotesCount=8&newsCount=0`;
    const res = await fetch(url, {
      next: { revalidate: 3600 },
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 QueDesastre/1.0",
      },
    });
    if (!res.ok) return raw;
    const data = await res.json();
    const quotes = (data?.quotes || []) as {
      symbol?: string;
      quoteType?: string;
    }[];
    const fund = quotes.find(
      (q) =>
        q.symbol &&
        (q.quoteType === "MUTUALFUND" ||
          q.quoteType === "ETF" ||
          q.symbol.includes("."))
    );
    if (fund?.symbol) return fund.symbol;
    if (quotes[0]?.symbol) return quotes[0].symbol;
  } catch {
    /* fallback */
  }
  return raw;
}

/** Precio de un ticker vía Yahoo Finance chart (sin API key). */
export async function fetchYahooPriceEur(
  ticker: string
): Promise<number | null> {
  const resolved = await resolveYahooSymbol(ticker);
  if (!resolved) return null;

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    resolved
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

    if (
      item.asset_kind === "etf" ||
      item.asset_kind === "stock" ||
      item.asset_kind === "other"
    ) {
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

/** Valor = cantidad × último precio API (o último valor cacheado). Sin manual. */
export function positionCurrentValue(opts: {
  quantity: number;
  last_price: number | null | undefined;
  last_value: number | null | undefined;
  manual_value?: number | null | undefined;
}): number {
  const qty = Number(opts.quantity) || 0;
  const price = Number(opts.last_price);
  if (qty > 0 && price > 0) return qty * price;
  if (opts.last_value != null && Number(opts.last_value) >= 0) {
    return Number(opts.last_value);
  }
  return 0;
}
