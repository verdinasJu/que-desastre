import type { TransactionType } from "@/lib/types";

export interface CsvPreviewRow {
  date: string;
  amount: number;
  description: string;
  type: TransactionType;
  category: string;
  selected: boolean;
  raw: string;
}

function detectSeparator(headerLine: string) {
  const commas = (headerLine.match(/,/g) || []).length;
  const semis = (headerLine.match(/;/g) || []).length;
  const tabs = (headerLine.match(/\t/g) || []).length;
  if (tabs >= commas && tabs >= semis) return "\t";
  if (semis >= commas) return ";";
  return ",";
}

function parseCsvLine(line: string, sep: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === sep && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function normalizeHeader(h: string) {
  return h
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function parseAmount(raw: string): number | null {
  let s = raw.replace(/[€$£\s]/g, "").trim();
  if (!s) return null;
  // 1.234,56 or 1234,56
  if (s.includes(",") && s.includes(".")) {
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (s.includes(",")) {
    s = s.replace(",", ".");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function parseDate(raw: string): string | null {
  const s = raw.trim();
  // ISO / yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  // dd/mm/yyyy or dd.mm.yyyy or dd-mm-yyyy
  const m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
  if (m) {
    const d = m[1].padStart(2, "0");
    const mo = m[2].padStart(2, "0");
    let y = m[3];
    if (y.length === 2) y = `20${y}`;
    return `${y}-${mo}-${d}`;
  }
  return null;
}

const DATE_KEYS = ["date", "fecha", "bookingdate", "valuedate", "fechavalor", "fechacontable", "transactiondate"];
const AMOUNT_KEYS = ["amount", "importe", "cantidad", "value", "monto", "betrag"];
const DESC_KEYS = [
  "description",
  "descripcion",
  "concepto",
  "details",
  "detalle",
  "memo",
  "payee",
  "nombre",
  "title",
  "counterparty",
];

function findCol(headers: string[], keys: string[]) {
  const normalized = headers.map(normalizeHeader);
  for (const key of keys) {
    const idx = normalized.findIndex(
      (h) => h === key || h.includes(key)
    );
    if (idx >= 0) return idx;
  }
  return -1;
}

function guessCategory(description: string, type: TransactionType): string {
  if (type === "income") return "Extra";
  if (type === "investment") return "Otros";
  const d = description.toLowerCase();
  if (/uber|cabify|renfe|metro|bus|gasolina|parking|transporte/.test(d))
    return "Transporte";
  if (/mercadona|lidl|carrefour|aldi|supermercado|comida|restaurant|bar|cafe|café/.test(d))
    return "Comida";
  if (/netflix|spotify|cine|steam|ocio/.test(d)) return "Ocio";
  if (/farmacia|gym|medico|médico|salud/.test(d)) return "Salud";
  if (/ikea|amazon|ikea|casa|leroymerlin/.test(d)) return "Casa";
  if (/alquiler|airbnb|hotel|viaje|vuelo|ryanair|vueling/.test(d))
    return "Viaje";
  return "Otros";
}

/**
 * Parsea un CSV bancario genérico (TR, bancos ES, etc.) a filas importables.
 */
export function parseBankCsv(content: string): {
  rows: CsvPreviewRow[];
  error?: string;
} {
  const cleaned = content.replace(/^\uFEFF/, "").trim();
  if (!cleaned) return { rows: [], error: "El archivo está vacío" };

  const lines = cleaned.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return { rows: [], error: "No hay filas de datos en el CSV" };
  }

  const sep = detectSeparator(lines[0]);
  const headers = parseCsvLine(lines[0], sep);
  let dateIdx = findCol(headers, DATE_KEYS);
  let amountIdx = findCol(headers, AMOUNT_KEYS);
  let descIdx = findCol(headers, DESC_KEYS);

  // Fallback: first 3 columns date / desc / amount or date / amount / desc
  if (dateIdx < 0) dateIdx = 0;
  if (amountIdx < 0) {
    amountIdx = headers.length > 2 ? headers.length - 1 : 1;
  }
  if (descIdx < 0) {
    descIdx = headers.findIndex((_, i) => i !== dateIdx && i !== amountIdx);
    if (descIdx < 0) descIdx = Math.min(1, headers.length - 1);
  }

  const rows: CsvPreviewRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i], sep);
    const date = parseDate(cols[dateIdx] || "");
    const amountRaw = parseAmount(cols[amountIdx] || "");
    const description = (cols[descIdx] || "").trim() || "Movimiento importado";
    if (!date || amountRaw === null || amountRaw === 0) continue;

    const abs = Math.abs(amountRaw);
    const type: TransactionType = amountRaw < 0 ? "expense" : "income";
    // Algunos bancos exportan gastos en positivo con columna tipo; asumimos signo
    const category = guessCategory(description, type);

    rows.push({
      date,
      amount: abs,
      description: description.slice(0, 120),
      type,
      category,
      selected: true,
      raw: lines[i],
    });
  }

  if (!rows.length) {
    return {
      rows: [],
      error:
        "No pude leer movimientos. Prueba un CSV con columnas Fecha, Importe y Concepto.",
    };
  }

  return { rows };
}
