# Encaja App — Modelo de Datos v1

## Fecha
2026-04-12

## Estado
Vigente

## Autor
Juan Pardo

---

## 1. Principios del modelo

- Supabase como backend (Postgres + Auth + RLS)
- Multi-tenant por `workspace`
- Los datos financieros pertenecen al workspace (no al usuario)
- MVP single-workspace, diseño listo para multiusuario
- Separación clara entre planificación (presupuesto) y ejecución (transacciones)

---

## 2. Entidades principales

- profiles
- workspaces
- workspace_members
- categories
- payment_methods
- budget_periods
- budget_items
- transactions
- workspace_settings

---

## 3. Tablas

### 3.1 profiles
Extiende `auth.users`.

Campos:
- id (uuid, pk, = auth.users.id)
- email (text)
- full_name (text, null)
- created_at (timestamptz)
- updated_at (timestamptz)

---

### 3.2 workspaces

Campos:
- id (uuid, pk)
- name (text)
- slug (text, null)
- created_by (uuid, fk -> profiles.id)
- created_at (timestamptz)
- updated_at (timestamptz)

---

### 3.3 workspace_members

Campos:
- id (uuid, pk)
- workspace_id (uuid, fk -> workspaces.id)
- user_id (uuid, fk -> profiles.id)
- role (text)
- created_at (timestamptz)

Restricción:
- unique(workspace_id, user_id)
- check role in ('owner', 'admin', 'member')

Roles válidos:
- owner
- admin
- member

---

### 3.4 categories

Campos:
- id (uuid, pk)
- workspace_id (uuid, fk -> workspaces.id)
- name (text)
- type (text)
- expense_behavior (text, null; aplica a type=expense)
- is_active (boolean)
- sort_order (integer, null)
- color (text, null)
- icon (text, null)
- created_by (uuid, fk -> profiles.id)
- created_at (timestamptz)
- updated_at (timestamptz)

Restricción:
- unique(workspace_id, name)
- check type in ('income', 'expense', 'saving')
- check expense_behavior:
  - si type = expense -> ('fixed', 'variable')
  - si type in ('income', 'saving') -> null

Tipos:
- income
- expense
- saving

Comportamiento de gasto (`expense_behavior`):
- fixed
- variable

---

### 3.5 payment_methods

Campos:
- id (uuid, pk)
- workspace_id (uuid, fk -> workspaces.id)
- name (text)
- type (text)
- is_active (boolean)
- current_balance (numeric(14,2), default 0)
- include_in_balance (boolean, default true)
- closing_day (smallint, null)
- due_day (smallint, null)
- created_by (uuid, fk -> profiles.id)
- created_at (timestamptz)
- updated_at (timestamptz)

Tipos:
- cash
- debit_card
- credit_card

Checks:
- closing_day between 1 and 31 (o null)
- due_day between 1 and 31 (o null)

---

### 3.6 budget_periods

Campos:
- id (uuid, pk)
- workspace_id (uuid, fk -> workspaces.id)
- year (integer)
- month (smallint)
- status (text)
- created_by (uuid, fk -> profiles.id)
- created_at (timestamptz)
- updated_at (timestamptz)

Restricción:
- unique(workspace_id, year, month)
- check year between 2000 y 2200
- check month between 1 y 12
- check status in ('draft', 'active', 'closed')

Estados:
- draft
- active
- closed

---

### 3.7 budget_items

Campos:
- id (uuid, pk)
- budget_period_id (uuid, fk -> budget_periods.id)
- category_id (uuid, fk -> categories.id)
- amount (numeric(14,2))
- created_at (timestamptz)
- updated_at (timestamptz)

Restricción:
- unique(budget_period_id, category_id)
- check amount >= 0

Integridad:
- trigger para validar que `budget_period_id` y `category_id` pertenezcan al mismo workspace

---

### 3.8 transactions

Campos:
- id (uuid, pk)
- workspace_id (uuid, fk -> workspaces.id)
- transaction_date (date)
- effective_date (date, null)
- type (text)
- category_id (uuid, fk -> categories.id)
- payment_method_id (uuid, fk -> payment_methods.id, null)
- amount (numeric(14,2))
- description (text, null)
- notes (text, null)
- is_recurring (boolean, default false)
- created_by (uuid, fk -> profiles.id)
- created_at (timestamptz)
- updated_at (timestamptz)

Tipos:
- income
- expense
- saving

Checks:
- check amount > 0
- check type in ('income', 'expense', 'saving')

Integridad:
- trigger para validar:
  - categoría y transacción en el mismo workspace
  - medio de pago (si existe) en el mismo workspace
  - type de transacción igual al type de categoría

---

### 3.9 workspace_settings

Campos:
- id (uuid, pk)
- workspace_id (uuid, fk -> workspaces.id)
- start_year (integer)
- savings_rate_mode (text)
- deferred_income_enabled (boolean)
- deferred_income_day (smallint, null)
- currency_code (text, default 'ARS')
- show_cents (boolean, default false)
- created_at (timestamptz)
- updated_at (timestamptz)

Restricción:
- unique(workspace_id)
- check savings_rate_mode in ('manual', 'percentage')
- check deferred_income:
  - si deferred_income_enabled = false -> deferred_income_day = null
  - si deferred_income_enabled = true -> deferred_income_day between 1 and 31

---

## 4. Relaciones

- profile → workspace_members → workspace
- workspace → categories
- workspace → payment_methods
- workspace → budget_periods → budget_items
- workspace → transactions
- workspace → workspace_settings

---

## 5. Reglas estructurales clave

- Los datos financieros principales usan `workspace_id` directo
- `budget_items` hereda ownership vía `budget_period_id` (y se valida consistencia con `category_id` por trigger)
- No hay datos financieros directos en `profiles`
- Presupuesto y ejecución están separados
- Categorías y medios de pago son por workspace

---

## 6. Decisiones importantes

- `workspace_id` en transactions para ownership claro
- `budget_periods` separado de `budget_items` para flexibilidad
- `type` duplicado (categoría + transacción) para validación futura

---

## 7. Fuera de alcance v1

- cuentas bancarias
- splits de transacciones
- adjuntos
- tags
- recurrencia avanzada
- múltiples monedas

---

## 8. Tipos recomendados

- UUID para PK
- NUMERIC(14,2) para montos
- DATE para fechas operativas
- TIMESTAMPTZ para auditoría

---

## 9. Próximos pasos

- Reglas de negocio v1
- Script SQL para Supabase
- Definición de MVPs

---

## 10. Resumen

Modelo base orientado a presupuesto + ejecución + análisis, con estructura multi-tenant y preparado para escalar sin refactorizaciones grandes.
