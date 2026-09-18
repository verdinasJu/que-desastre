import type { Transaction, TransactionType } from "@/lib/types";

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
  let s = raw.replace(/[€$£]/g, "").trim();
  s = s.replace(/[−–—]/g, "-");
  s = s.replace(/\b(eur|usd|gbp|chf)\b/gi, "").trim();
  s = s.replace(/(eur|usd|gbp|chf)$/i, "").trim();
  s = s.replace(/\s/g, "");
  if (!s) return null;

  const paren = s.match(/^\((.*)\)$/);
  if (paren) s = `-${paren[1]}`;

  if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, "");
  } else if (/^-?\d{1,3}(,\d{3})+$/.test(s)) {
    s = s.replace(/,/g, "");
  } else if (s.includes(",") && s.includes(".")) {
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

function recoverSplitAmount(cols: string[], amountIdx: number, sep: string): number | null {
  const direct = parseAmount(cols[amountIdx] || "");
  if (sep !== ",") return direct;
  const next = (cols[amountIdx + 1] || "").trim();
  if (!/^\d{2}$/.test(next)) return direct;
  const joined = parseAmount(`${cols[amountIdx] || ""}.${next}`);
  if (joined === null) return direct;
  if (direct === null) return joined;
  if (Number.isInteger(direct) && Math.abs(joined) > Math.abs(direct)) return joined;
  return direct;
}

function parseDate(raw: string): string | null {
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
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

const DATE_KEYS = [
  "date",
  "fecha",
  "bookingdate",
  "valuedate",
  "fechavalor",
  "fechacontable",
  "transactiondate",
  "timestamp",
];
const AMOUNT_KEYS = ["amount", "importe", "cantidad", "monto", "betrag", "value"];
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
  "note",
  "narration",
];
const DEBIT_KEYS = ["debe", "debit", "cargo", "cargos", "withdrawal", "salida"];
const CREDIT_KEYS = ["haber", "credit", "abono", "abonos", "deposit"];
const TYPE_KEYS = ["type", "tipo", "transactiontype", "naturaleza"];

function findCol(headers: string[], keys: string[], exclude: number[] = []) {
  const normalized = headers.map(normalizeHeader);
  const skip = new Set(exclude);
  for (const key of keys) {
    const idx = normalized.findIndex((h, i) => !skip.has(i) && h === key);
    if (idx >= 0) return idx;
  }
  for (const key of keys) {
    const idx = normalized.findIndex((h, i) => !skip.has(i) && h.includes(key));
    if (idx >= 0) return idx;
  }
  return -1;
}

const INCOME_DESC_RE =
  /nomina|salario|sueldo|payroll|paganomina|abono.?nomina|ingreso.?nomina|devolucion|refund|interes|dividend|bizum recibido|transferencia recibida/;
const EXPENSE_DESC_RE =
  /alquiler|hipoteca|recibo|mercadona|lidl|carrefour|aldi|uber|cabify|renfe|netflix|spotify|amazon|ikea|gasolina|farmacia|supermercado|compra/;
const INCOME_TYPE_RE =
  /abono|ingreso|deposit|credit|incoming|salary|nomina|refund|interest|payout/;
const EXPENSE_TYPE_RE =
  /cargo|debit|gasto|card|payment|purchase|compra|recibo|sepa|direct.?debit|fee|tax/;

export function isLikelySalaryDescription(description: string): boolean {
  const d = description
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return /nomina|salario|sueldo|payroll|ingreso mensual/.test(d);
}

function inferType(
  amountRaw: number,
  typeRaw: string,
  description: string,
  allNonNegative: boolean
): TransactionType {
  const t = typeRaw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (t && INCOME_TYPE_RE.test(t)) return "income";
  if (t && EXPENSE_TYPE_RE.test(t)) return "expense";
  const d = description
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (INCOME_DESC_RE.test(d)) return "income";
  if (EXPENSE_DESC_RE.test(d)) return "expense";
  if (amountRaw < 0) return "expense";
  if (allNonNegative) return "expense";
  return "income";
}

export function guessCategory(description: string, type: TransactionType): string {
  if (type === "income") {
    return isLikelySalaryDescription(description) ? "Ingreso habitual" : "Extra";
  }
  if (type === "investment") return "Otros";
  const d = description.toLowerCase();
  if (/alquiler|hipoteca|comunidad de vecinos|renta\b/.test(d)) return "Vivienda";
  if (/uber|cabify|renfe|metro|bus|gasolina|parking|transporte/.test(d))
    return "Transporte";
  if (/mercadona|lidl|carrefour|aldi|supermercado|comida|restaurant|bar|cafe|café/.test(d))
    return "Comida";
  if (/netflix|spotify|cine|steam|ocio/.test(d)) return "Ocio";
  if (/farmacia|gym|medico|médico|salud/.test(d)) return "Salud";
  if (/ikea|amazon|casa|leroymerlin/.test(d)) return "Casa";
  if (/airbnb|hotel|viaje|vuelo|ryanair|vueling/.test(d)) return "Viaje";
  return "Otros";
}

function normalizeDesc(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function descriptionsOverlap(a: string, b: string): boolean {
  const na = normalizeDesc(a);
  const nb = normalizeDesc(b);
  if (!na || !nb) return true;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  const tokensA = new Set(na.split(" ").filter((t) => t.length >= 4));
  const tokensB = nb.split(" ").filter((t) => t.length >= 4);
  if (!tokensA.size || !tokensB.length) return false;
  return tokensB.some((t) => tokensA.has(t));
}

export function isLikelyDuplicateTx(
  row: Pick<CsvPreviewRow, "date" | "amount" | "type" | "description">,
  tx: Pick<Transaction, "date" | "amount" | "type" | "description">
): boolean {
  if (tx.date !== row.date) return false;
  if (tx.type !== row.type) return false;
  if (Math.abs(Number(tx.amount) - row.amount) >= 0.02) return false;
  return descriptionsOverlap(tx.description, row.description);
}

/**
 * Parsea un CSV bancario genérico (TR, bancos ES, Debe/Haber, etc.) a filas importables.
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
  const debitIdx = findCol(headers, DEBIT_KEYS);
  const creditIdx = findCol(headers, CREDIT_KEYS);
  const typeIdx = findCol(headers, TYPE_KEYS, [dateIdx]);
  let amountIdx = findCol(headers, AMOUNT_KEYS, [dateIdx, debitIdx, creditIdx]);
  let descIdx = findCol(headers, DESC_KEYS, [dateIdx, amountIdx, debitIdx, creditIdx, typeIdx]);

  const hasDebitCredit = debitIdx >= 0 && creditIdx >= 0;

  if (dateIdx < 0) dateIdx = 0;
  if (!hasDebitCredit && amountIdx < 0) {
    amountIdx = headers.length > 2 ? headers.length - 1 : 1;
  }
  if (descIdx < 0) {
    descIdx = headers.findIndex(
      (_, i) =>
        i !== dateIdx &&
        i !== amountIdx &&
        i !== debitIdx &&
        i !== creditIdx &&
        i !== typeIdx
    );
    if (descIdx < 0) descIdx = Math.min(1, headers.length - 1);
  }

  const parsed: {
    date: string;
    amountRaw: number;
    description: string;
    typeHint: string;
    raw: string;
  }[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i], sep);
    const date = parseDate(cols[dateIdx] || "");
    const description = (cols[descIdx] || "").trim() || "Movimiento importado";
    const typeHint = typeIdx >= 0 ? cols[typeIdx] || "" : "";
    if (!date) continue;

    let amountRaw: number | null = null;
    if (hasDebitCredit) {
      const debit = parseAmount(cols[debitIdx] || "");
      const credit = parseAmount(cols[creditIdx] || "");
      if (debit && debit !== 0) amountRaw = -Math.abs(debit);
      else if (credit && credit !== 0) amountRaw = Math.abs(credit);
    } else {
      amountRaw = recoverSplitAmount(cols, amountIdx, sep);
    }
    if (amountRaw === null || amountRaw === 0) continue;
    parsed.push({
      date,
      amountRaw,
      description: description.slice(0, 120),
      typeHint,
      raw: lines[i],
    });
  }

  if (!parsed.length) {
    return {
      rows: [],
      error:
        "No pude leer movimientos. Prueba un CSV con columnas Fecha, Importe y Concepto.",
    };
  }

  const allNonNegative = parsed.every((r) => r.amountRaw >= 0);

  const rows: CsvPreviewRow[] = parsed.map((r) => {
    const type = inferType(r.amountRaw, r.typeHint, r.description, allNonNegative);
    return {
      date: r.date,
      amount: Math.abs(r.amountRaw),
      description: r.description,
      type,
      category: guessCategory(r.description, type),
      selected: true,
      raw: r.raw,
    };
  });

  return { rows };
}
