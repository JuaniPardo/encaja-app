# Encaja App

Aplicación web de presupuesto y control financiero familiar.

## Estado actual

Implementado: **MVP1 — Base operativa inicial**

- autenticación (registro/login/logout)
- sesión persistida
- bootstrap automático de `profile + workspace + workspace_members + workspace_settings`
- shell protegida para rutas `/app/*`
- módulo Categorías (listar/crear/editar/activar/desactivar)
- módulo Medios de pago (listar/crear/editar/activar/desactivar)
- módulo Settings del workspace

## Stack

- Next.js 16 (App Router)
- TypeScript
- Mantine
- Supabase (Auth + Postgres + RLS)
- React Hook Form + Zod

## Setup

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar entorno

Copiar `.env.example` a `.env.local` y completar:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Si todavía usás key legacy, podés usar `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

### 3. Aplicar migración SQL

Crear las tablas/policies del MVP1 en Supabase con:

- [`supabase/migrations/20260410130000_mvp1_base_operativa.sql`](supabase/migrations/20260410130000_mvp1_base_operativa.sql)

### 4. Ejecutar

```bash
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000).

## Estructura principal

- `src/app/(auth)` login y registro
- `src/app/(protected)/app` área autenticada
- `src/lib/supabase` cliente y utilidades de sesión
- `src/lib/workspace/bootstrap.ts` bootstrap idempotente del workspace
- `src/proxy.ts` protección de rutas en Next 16
- `supabase/migrations` SQL del modelo y RLS

## Próximo hito

MVP2: presupuesto mensual (`budget_periods` + `budget_items`).

## Autoría

Desarrollado por Juan Pardo.

## Licencia

Este proyecto está bajo licencia MIT. Ver [LICENSE](./LICENSE).
