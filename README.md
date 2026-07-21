# Que Desastre

App web de finanzas personales (PWA). En el móvil puedes **Añadir a pantalla de inicio** y se comporta como una app nativa.

## Qué hace

- Configuras nómina, ahorro e inversión inicial y gastos fijos
- Añades gastos / ingresos / inversiones del día a día
- Dashboard con: patrimonio total, disponible para gastar, gastado del mes, invertido del mes y ahorro del mes
- Listado de movimientos con filtro por fechas y por palabra
- Las **inversiones** restan del dinero disponible del mes, pero **no restan del patrimonio** (siguen siendo tuyas)

## Stack (todo gratis)

- **Next.js 14** + TypeScript + Tailwind
- **Supabase** (Auth + Postgres + RLS)
- **Vercel** (hosting + HTTPS)

## 1. Crear proyecto en Supabase (gratis)

1. Entra en [https://supabase.com](https://supabase.com) y crea un proyecto
2. Ve a **Project Settings → API** y copia:
   - Project URL
   - `anon` `public` key
3. Ve a **SQL Editor**, pega el contenido de `supabase/migrations/001_initial.sql` y pulsa **Run**
4. En **Authentication → Providers**, deja Email habilitado
   - Opcional: en **Authentication → Settings**, desactiva “Confirm email” para probar más rápido en local

## 2. Variables de entorno locales

```bash
cp .env.example .env.local
```

Rellena `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```

## 3. Arrancar en local

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000)

## 4. Subir a Internet gratis (GitHub + Vercel)

### GitHub

```bash
git init
git add .
git commit -m "Initial commit: Que Desastre PWA"
```

Crea un repo vacío en GitHub y súbelo:

```bash
git remote add origin https://github.com/TU_USUARIO/que-desastre.git
git branch -M main
git push -u origin main
```

### Vercel (gratis)

1. Entra en [https://vercel.com](https://vercel.com) con tu cuenta de GitHub
2. **Add New Project** → importa el repo
3. En **Environment Variables** añade las mismas dos variables de `.env.local`
4. Deploy

Te dará una URL tipo `https://que-desastre.vercel.app` con HTTPS.

### Instalar como app en el móvil

1. Abre la URL en Chrome (Android) o Safari (iPhone)
2. Menú → **Añadir a pantalla de inicio** / **Instalar app**
3. Queda el icono a pantalla completa, sin barra del navegador

## Lógica de estadísticas

| Métrica | Cálculo |
|--------|---------|
| Patrimonio total | ahorro inicial + inversión inicial + Σ ingresos − Σ gastos *(inversiones no restan)* |
| Disponible para gastar | nómina + ingresos del mes − fijos − inversiones del mes − gastos variables |
| Gastado este mes | fijos activos + gastos variables del mes |
| Invertido este mes | Σ inversiones del mes *(se muestra aparte)* |
| Ahorro del mes | nómina − fijos − inversiones − gastos variables |

## Estructura

```
src/app/login          → acceso / registro
src/app/onboarding     → primera configuración
src/app/(app)/         → dashboard, movimientos, ajustes
src/lib/stats.ts       → cálculos de patrimonio / disponible
supabase/migrations/   → SQL de tablas + RLS
public/manifest.json   → PWA
```

## Seguridad

Cada tabla tiene **Row Level Security**: un usuario solo ve y edita sus propios datos (`user_id = auth.uid()`).
