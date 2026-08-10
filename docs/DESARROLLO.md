# Notas para desarrolladores

## Scripts

```bash
npm run dev      # desarrollo
npm run build    # build producción
npm run start    # servir build
npm run lint     # ESLint
```

## Variables de entorno

Solo cliente/servidor Next + Supabase anon:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

No hace falta API key para CoinGecko (tier free, rate limit) ni Yahoo chart (no oficial; puede fallar o limitar).

## Flujo de sync (`AutoFinanceSync`)

Montado en `src/app/(app)/layout.tsx` (server component):

1. `ensureMonthlyIncome` — `src/lib/auto-income.ts`
2. `ensureFixedExpenseTransactions` — `src/lib/auto-fixed-expenses.ts`
3. `ensureInvestmentPrices` — `src/lib/auto-investment-prices.ts`
4. Si hay posiciones y `initial_investments > 0` → se pone a `0` (migración a cartera)

## Patrimonio (`src/lib/stats.ts`)

```ts
calcPatrimonio(profile, txs, fixedExpenses, monthStart, monthEnd, positions)
```

- Inversiones de mercado: `calcInvestmentsMarketValue(profile, positions)`
- Devengo fijos: `unpaidFixedForMonth` en `fixed-expense-utils.ts`

## Precios

- Cliente/servidor → `POST /api/prices`
- Lógica: `src/lib/investment-prices.ts`
  - Crypto → CoinGecko `simple/price`
  - Resto → Yahoo `v8/finance/chart` (+ resolución ISIN / mapa `IE00BYX5P602` → `0P0001CJGV.F`)

## Tablas principales

| Tabla | Uso |
|-------|-----|
| `profiles` | nómina, ahorro, payday, horas, legado `initial_investments` |
| `fixed_expenses` | fijos activos |
| `transactions` | income / expense / investment; opcional `fixed_expense_id`, `trip_id` |
| `investment_positions` | cartera |
| `budgets` / invites | presupuestos compartidos |
| `trips` / invites | viajes |
| `debts` | deudas |
| `savings_goals` | metas |
| `custom_categories` | categorías |

## UI patterns

- Bottom nav + menú **Más** (`MoreMenu` + `AppSheet` con portal)
- Sheets en `document.body` para evitar freeze por stacking context
- Formularios cliente + `router.refresh()` tras mutaciones Supabase

## Tag útil

`stable-pre-inversiones` — estado estable antes de la cartera con API.
