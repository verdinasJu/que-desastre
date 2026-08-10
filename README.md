# Que Desastre

PWA de finanzas personales: patrimonio, gastos, ingresos, cartera de inversiones con precios en vivo, presupuestos, viajes, deudas y más.

**Producción:** [https://que-desastre.vercel.app](https://que-desastre.vercel.app)  
**Repositorio:** [https://github.com/verdinasJu/que-desastre](https://github.com/verdinasJu/que-desastre)

En el móvil: abre la URL → **Añadir a pantalla de inicio** / Instalar app.

---

## Índice

1. [Qué incluye la app](#qué-incluye-la-app)
2. [Cómo se calculan las cifras](#cómo-se-calculan-las-cifras)
3. [Inversiones y precios API](#inversiones-y-precios-api)
4. [Gastos fijos automáticos](#gastos-fijos-automáticos)
5. [Stack y estructura](#stack-y-estructura)
6. [Setup local](#setup-local)
7. [Migraciones Supabase](#migraciones-supabase)
8. [Deploy (GitHub + Vercel)](#deploy-github--vercel)
9. [Seguridad](#seguridad)
10. [Punto de restauración](#punto-de-restauración)
11. [Guía de usuario](./docs/GUIA_USUARIO.md)
12. [Notas para desarrolladores](./docs/DESARROLLO.md)

---

## Qué incluye la app

| Zona | Qué hace |
|------|----------|
| **Login / registro** | Auth con email (Supabase) |
| **Onboarding** | Ingreso mensual, día de cobro, ahorro/liquidez, gastos fijos |
| **Inicio** | Patrimonio, disponible, gastado, invertido, ahorro del mes, metas, gráficas, avisos |
| **Movimientos** | Gastos, ingresos e inversiones (movimientos); filtros por fecha y texto; editar/borrar; import CSV |
| **Presupuestos** | Topes por categoría; compartir con código de un solo uso |
| **Ajustes** | Nómina, payday, horas/mes, ahorro, gastos fijos, categorías custom, cerrar sesión |
| **Más → Inversiones** | Cartera (BTC, XRP, fondos…): lo metido vs valor de mercado vía API |
| **Más → Viajes** | Presupuesto de viaje; modo compartido con código |
| **Más → Deudas** | Te deben / debes tú (no mueve patrimonio hasta registrarlo como movimiento) |
| **Más → Calculadora** | Interés compuesto (usa el valor de la cartera si existe) |
| **Botón +** | Alta rápida de gasto / ingreso / inversión |

### Automatismos al abrir la app

En cada visita (`AutoFinanceSync`):

1. **Ingreso mensual automático** tras el día de cobro (si aún no existe ese mes)
2. **Gastos fijos del mes** como movimientos (día 1), sin duplicar pagos manuales casi completos
3. **Precios de la cartera** si tienen más de ~15 minutos

---

## Cómo se calculan las cifras

| Métrica | Fórmula |
|---------|---------|
| **Patrimonio total** | ahorro (liquidez) + **valor de cartera** + Σ ingresos − Σ gastos − fijos pendientes del mes |
| **Valor de cartera** | Σ (cantidad × precio API) de `investment_positions`. Si no hay posiciones, se usa el legado `initial_investments` (oculto en UI) |
| **Disponible para gastar** | ingreso base del mes + extras − fijos configurados − inversiones del mes − gastos variables |
| **Gastado este mes** | fijos activos (config) + variables del mes (sin duplicar pagos parciales de fijos) |
| **Invertido este mes** | Σ movimientos tipo `investment` del mes (caja → invertido; **no** restan del patrimonio) |
| **Ahorro del mes** | ingreso base − fijos − invertido − variables |

### Notas importantes

- Las **inversiones de cartera** (BTC, fondos…) viven en **Más → Inversiones** y actualizan el patrimonio con el **precio de mercado**.
- Un movimiento tipo “inversión” en Movimientos **no** resta patrimonio (el dinero sigue siendo tuyo).
- Los **fijos** del dashboard son la suma de la tabla `fixed_expenses` (ej. 325+39+9+12,50).
- Si un fijo está pagado solo en parte a mano (ej. alquiler 87,50 de 325), el resto se **devenga** en patrimonio hasta cubrirlo.

---

## Inversiones y precios API

Cada posición guarda:

- `quantity` — unidades / participaciones / monedas  
- `cost_basis` — lo metido en € (cantidad × precio medio de compra en el bróker)  
- `symbol` — **obligatorio** para precio automático  
- `last_price` / `last_value` — caché del último precio API  

**Valor ahora = cantidad × precio.** No hay valor manual en la UI.

| Tipo | API | Ejemplo de símbolo |
|------|-----|-------------------|
| Crypto | [CoinGecko](https://www.coingecko.com/) | `bitcoin`, `ripple`, `ethereum` |
| ETF / fondo / acción | Yahoo Finance (chart) | `VWCE.DE`, `0P0001CJGV.F` (Fidelity MSCI World EUR Hedged, típico en Trade Republic), `AAPL` |

Ruta interna: `POST /api/prices` con `{ items: [{ id?, asset_kind, symbol }] }`.

Presets en la UI: Bitcoin, XRP, Fidelity MSCI World, VWCE.

Al crear/editar una posición, si el símbolo no devuelve precio, el guardado se rechaza (evita cartera “ciega”).

Detalle de uso diario: [docs/GUIA_USUARIO.md](./docs/GUIA_USUARIO.md).

---

## Gastos fijos automáticos

- Configuración en **Ajustes** (o onboarding).
- Cada mes se crea un movimiento `Gasto fijo (automático): …` con `fixed_expense_id`.
- Si ya pagaste ≥ ~90 % a mano (mismo nombre/alquiler/importe), no se duplica el auto.
- Pago parcial (ej. alquiler): no se crea el auto completo; el pendiente resta del patrimonio vía devengo.

---

## Stack y estructura

- **Next.js 14** (App Router) + TypeScript + Tailwind  
- **Supabase** Auth + Postgres + RLS  
- **Vercel** hosting  
- **Recharts** gráficas  

```
src/app/
  login/              Auth
  onboarding/         Primera config
  (app)/              Shell con nav + AutoFinanceSync
    page.tsx          Dashboard
    movimientos/
    presupuestos/
    ajustes/
    inversiones/
    viajes/
    deudas/
    calculadora/
  api/prices/         Proxy precios CoinGecko / Yahoo

src/lib/
  stats.ts                  Patrimonio y stats del mes
  fixed-expense-utils.ts    Fijos, categorías, devengo
  auto-fixed-expenses.ts    Crear movimientos de fijos
  auto-income.ts            Nómina automática
  investment-prices.ts      APIs + presets
  auto-investment-prices.ts Refresh de cartera
  …

supabase/migrations/        001 … 011 (aplicar en orden)
docs/                       Guía usuario + notas dev
```

---

## Setup local

### 1. Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com)
2. **Settings → API**: copia Project URL y `anon` key
3. **SQL Editor**: ejecuta las migraciones de `supabase/migrations/` **en orden** (`001` → `011`)
4. Auth Email activo (opcional: desactivar confirmación de email en desarrollo)

### 2. Entorno

```bash
cp .env.example .env.local
```

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```

### 3. Arrancar

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000)

```bash
npm run build   # comprobar producción
npm run lint
```

---

## Migraciones Supabase

Aplicar **en orden** (SQL Editor o CLI):

| Archivo | Contenido |
|---------|-----------|
| `001_initial.sql` | profiles, fixed_expenses, transactions, RLS |
| `002_budgets_goals_payday.sql` | presupuestos, metas, payday |
| `003_onboarding_completed_at.sql` | marca onboarding |
| `004_trips_hours.sql` | viajes, horas/mes |
| `005_custom_categories.sql` | categorías propias |
| `006_sharing_invites.sql` | invitaciones compartir |
| `007_sharing_hardening.sql` | endurecimiento share |
| `008_auto_fixed_expenses.sql` | `fixed_expense_id` en transactions |
| `009_fix_auto_fixed_duplicates.sql` | índice único anti-duplicados |
| `010_debts.sql` | deudas |
| `011_investment_positions.sql` | cartera de inversiones |

---

## Deploy (GitHub + Vercel)

1. Push a `main` en GitHub  
2. En [vercel.com](https://vercel.com): importar el repo  
3. Variables de entorno: las mismas que `.env.local`  
4. Deploy → URL tipo `https://que-desastre.vercel.app`

Cada push a `main` puede redeploy automático si está enlazado.

---

## Seguridad

- **RLS** en todas las tablas de usuario: solo `auth.uid() = user_id`
- La app **no** se conecta a bancos (Trade Republic, etc.): los precios son de mercado público
- No subir `.env.local` ni claves al repo

---

## Punto de restauración

Tag Git **antes** de la cartera con API:

```bash
git checkout stable-pre-inversiones
```

Estado actual de documentación / app en `main` (incluye inversiones automáticas).

---

## Licencia / uso

Proyecto personal / educativo. Úsalo y adáptalo libremente.
