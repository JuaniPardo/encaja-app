## [1.4.2] - 2026-04-21

### Added
- Added MVP26 credit card installments support with dedicated installment purchase model and automatic monthly distribution.
- Added installment purchase editing flow with transactional backend update and full installments regeneration.
- Added pending future commitments visibility in dashboard financial summary and payment-method breakdown.

### Changed
- Updated dashboard copy and hierarchy to clearly separate `Balance total`, `Este mes`, and `Compromisos futuros`.
- Improved credit card method cards with explicit sections for `Deuda total`, `Este mes (resumen)`, and `A futuro (cuotas)`.
- Adjusted transaction listing date behavior to show real operation date for installment 1 and monthly effective dates for subsequent installments.

### Fixed
- Added missing RLS update policy for `installment_purchases` required by installment editing RPC.
- Fixed ambiguous SQL reference in installment update flow (`installment_purchase_id`) to prevent runtime failures.

## [1.4.1] - 2026-04-20

### Added
- Added global dashboard quick actions FAB to create transactions and transfers with one tap.
- Added reusable payment methods UI components (`payment-method-card` and `payment-method-form-modal`) to simplify maintenance.

### Changed
- Refactored payment methods page flow to use the new componentized structure and `startingBalance` naming.
- Simplified dashboard onboarding CTA actions for low-activity workspaces.

### Fixed
- Enforced safe delete for payment methods with associated transactions via RLS delete policy guard.
- Improved transfer quick-action button contrast while keeping consistent visual size across breakpoints.

## [1.4.0] - 2026-04-19

### Added
- Added end-to-end Workspace Demo creation flow (`Caja Demo`) from Settings, including seeded realistic data for previous and current month.
- Added deterministic demo seed engine (`buildDemoSeed(referenceDate)`) with validated date rules, transfer pair generation, and no-future filtering for current month.
- Added automatic demo payment-method bootstrap (`Tarjeta de Débito`, `Efectivo`, `Tarjeta de Crédito`) with `current_balance = 0`.
- Added release documentation for MVP25 Workspace Demo under `docs/releases/`.

### Changed
- Extended workspace creation RPC contract to support demo workspaces (`p_is_demo`) and return demo metadata.
- Updated workspace domain/state model to include `isDemo`.
- Consolidated demo adjustment semantic key to `balance_adjustment` and ensured compatibility with legacy workspaces through migration-safe backfill logic.

### Fixed
- Enforced single active demo workspace per creator at database level (`workspaces.is_demo` + partial unique index).
- Added rollback safeguards in demo creation flow when post-workspace bootstrap steps fail.
- Fixed balance-adjustment migration compatibility with immutable system-category rules from Smart Categories hardening.

## [1.3.1] - 2026-04-19

### Changed
- Transfer creation now resolves system transfer category automatically from source/destination payment method types through backend RPC.
- Restricted payment method types to `cash`, `debit_card`, and `credit_card` across forms, dictionaries, and dashboard labels.

### Fixed
- Fixed transfer category resolution for card payment flows (`cash/debit_card -> credit_card`) with canonical system-category backfill for workspaces with legacy name collisions.
- Prevented invalid transfer combinations with `credit_card` as source account and surfaced clear validation feedback in transfer UI.

## [1.3.0] - 2026-04-19

### Added
- Added Smart Categories semantic contract fields for system and workspace category instances (`is_editable`, `is_exceptional`, `warning_message`).
- Added first exceptional system category for manual balance realignment (`expense_manual_adjustment`) with contextual guidance copy.
- Added contextual warning rendering in transaction creation when an exceptional category is selected.

### Changed
- Hardened system category behavior to keep semantic properties immutable at data level.
- Updated category management UI to reflect immutable system naming and exceptional category state.
- Updated workspace bootstrap function to instantiate new smart-category metadata for all new workspaces.

### Fixed
- Corrected changelog section formatting for release `1.2.1` (`### Changed`).

## [1.2.1] - 2026-04-18

### Changed
- Refactored Dashboard, Settings, and Transactions modules to reduce coupling and extract reusable components, hooks, and view-model logic without functional changes.
- Simplified Settings navigation by removing profile access from Settings, since it now has a dedicated page.

## [1.2.0] - 2026-04-18

### Added
- Added a system category catalog (`system_categories`) with semantic keys for income, expense, saving, and transfer flows.
- Added automatic workspace seeding/backfill for system category instances, including new semantic buckets like `expense_subscriptions`, `expense_other`, and `expense_deliveries`.
- Added manual and alias-based migration mappings to reclassify legacy custom categories into system categories for better historical analytics quality.

### Changed
- Revamped category model to support `source` (`system`/`custom`) and `system_category_id`.
- Updated category and transaction UIs to support the new semantic category model.
- Removed manual `sort_order` input from category creation flow to reduce user friction.

### Fixed
- Hardened migrations for idempotency and release safety (constraint ordering, policy recreation guards, robust type validation).
- Added cleanup migration to safely merge budget item collisions and delete orphaned custom categories after mapping.

## [1.1.5] - 2026-04-17

### Added
- Added onboarding CTA block in dashboard for workspaces with low initial activity.
- Added global feedback entrypoint in header with modal form.

### Changed
- Reorganized Settings into two top-level tabs (`Workspace` and `Cuenta/Account`).
- Unified workspace actions inside `Workspace` (General, Members, Connections, Danger zone) to reduce navigation friction.
- Moved feedback out of Settings primary navigation while keeping secondary access in Settings.

## [1.1.4] - 2026-04-16

### Changed
- Moved `workspace` selector to right side of header
- Changed workspace naming in Spanish to "Caja" to match branding

## [1.1.3] - 2026-04-16

### Changed
- Changed linked workspace to show accounts balance summary

## [1.1.2] - 2026-04-15

### Fixed
- Excluded `transfer` type from dashboard summaries and charts to avoid misleading aggregates (internal movements have no net impact)

## [1.1.1] - 2026-04-15

### Fixed
- prevent crash in transfer modal when categories or payment methods are undefined on initial render

## [1.1.0] - 2026-04-15

### Resumen
Primera evolución funcional post v1.0.0 enfocada en mejorar la consistencia financiera del sistema y corregir un problema conceptual clave: la duplicación de gastos al pagar tarjetas de crédito.

### Nuevas funcionalidades
- **Transferencias entre cuentas**:
  - Nuevo tipo de movimiento interno (`transfer`)
  - Permite mover dinero entre medios de pago sin afectar el presupuesto
  - Implementación basada en doble registro (in/out) con `transfer_group_id`

- **Pago de tarjetas correctamente modelado**:
  - Las transferencias hacia cuentas de tipo `credit_card` se presentan como "Pago de tarjeta"
  - Se elimina la duplicación de gasto en el sistema

### Mejoras
- **Separación conceptual sólida**:
  - Presupuesto = consumo real
  - Transferencias = movimiento interno

- **Cálculo de balances mejorado**:
  - Las transferencias ahora impactan correctamente en los balances de cuentas

- **Queries blindadas**:
  - Exclusión sistemática de `transfer` en:
    - dashboard
    - insights
    - budget
    - KPIs

- **UI/UX refinada**:
  - Nuevo color semántico para transferencias (Mantine Yellow)
  - Mejor claridad en la representación de movimientos

### Cambios técnicos
- Extensión de `transactions` con:
  - `transfer_group_id`
  - `direction` (in/out)
- Introducción de helpers de query (`excludeTransfers`)
- Validaciones para evitar transferencias inválidas

### Notas
- Este release mantiene compatibilidad hacia atrás
- Sienta las bases para futuras mejoras en manejo de tarjetas y conciliación

---

## [1.0.0] - 2026-04-15

### Resumen
Esta es la primera versión formal de **Encaja**, consolidando el trabajo realizado durante las fases iniciales de desarrollo y estableciendo una línea de base (baseline) para el crecimiento futuro del producto.

### Funcionalidades actuales (Baseline)
- **Gestión de Workspaces**: Soporte para múltiples espacios de trabajo con roles (Owner/Member).
- **Control de Transacciones**: Registro, edición y categorización de ingresos y gastos.
- **Presupuesto (Budget)**: Planificación mensual por categorías y seguimiento de ejecución.
- **Categorización Flexible**: Sistema de categorías personalizables por workspace.
- **Métodos de Pago**: Gestión de cuentas y tarjetas para el seguimiento de saldos.
- **Autenticación Segura**: Integración con Supabase Auth (Email/Password).
- **Interfaz Adaptativa**: Diseño responsive optimizado para gestión financiera usando Mantine.

### Notas
- Se establece esta versión como el punto de partida oficial para el versionado semántico.

---

## Pre-versioning phase

Antes de alcanzar la versión 1.0.0, Encaja evolucionó a través de múltiples iteraciones (MVPs) desarrolladas directamente sobre la rama principal. Durante esta fase:
- Se definieron los pilares del modelo de datos (Workspace-first).
- Se validó la lógica de negocio basada en plantillas de Excel reales.
- Se realizaron pruebas con usuarios reales (testers) para ajustar la usabilidad.
- No existe un histórico detallado de cambios commit-por-commit previo a esta versión, ya que el enfoque estuvo en la velocidad de desarrollo y validación del MVP funcional.
