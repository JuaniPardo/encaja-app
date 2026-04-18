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
exclude `transfer` type from dashboard summaries and charts to avoid misleading aggregates (internal movements have no net impact)

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
