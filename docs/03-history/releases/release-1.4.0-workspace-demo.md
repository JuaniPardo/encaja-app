# Release 1.4.0 — Workspace Demo (Caja Demo)

## Resumen

Encaja 1.4.0 incorpora un flujo de **Workspace Demo (Caja Demo)** orientado a reducir fricción de onboarding y permitir que nuevos usuarios entiendan el valor del producto sin cargar datos manualmente.

El release implementa la creación completa de una caja demo con dataset realista, reglas de fechas robustas y consistencia con el modelo semántico de categorías del sistema.

## Objetivo del release

- acelerar onboarding con datos creíbles desde el primer ingreso
- enseñar funcionalidades clave (transacciones, transferencias, categorías, balances)
- mantener coherencia con arquitectura `workspace-first`
- evitar duplicación o drift de demo data por usuario

## Highlights

- soporte de **un único demo activo por usuario** (`is_demo` + índice único parcial)
- creación automática de medios demo:
  - Tarjeta de Débito (`debit_card`)
  - Efectivo (`cash`)
  - Tarjeta de Crédito (`credit_card`)
- motor determinístico `buildDemoSeed(referenceDate)` con:
  - mes anterior completo
  - mes actual hasta hoy
  - regla `resolvedDay = min(baseDay, lastDayOfMonth)`
  - transferencias dobles vinculadas (`transfer_group_id`)
- creación end-to-end de Caja Demo con rollback razonable ante fallo

## Cambios funcionales

### Added

- Flujo UI para crear Caja Demo desde Settings.
- Helpers de dominio para bootstrap demo (`payment_methods`, categoría de ajuste y dataset demo).
- Tests unitarios e integración service-level para el flujo demo.

### Changed

- RPC `create_workspace_with_defaults` extendida con `p_is_demo` y retorno de metadata demo.
- Modelo/types de workspace actualizado para incluir `isDemo`.
- Backfill de categoría de ajuste hacia key canónica `balance_adjustment`.

### Fixed

- Compatibilidad de migración de `balance_adjustment` con reglas de inmutabilidad de Smart Categories.
- Validación y mensajes de bloqueo claros para segundo demo activo.

## Impacto de datos y compatibilidad

- Requiere aplicar migraciones de MVP25 en remoto.
- Incluye backfill compatible para workspaces legacy, sin romper contratos de categorías sistema inmutables.
- No rompe flujos existentes de creación de workspace estándar.

## Notas operativas

Validar en post-deploy:

- creación de Caja Demo en usuarios sin demo previo
- bloqueo de segundo demo activo
- recreación de demo tras eliminación
- presencia de movimientos de mes anterior + mes actual sin fechas futuras
- creación correcta de transferencia de pago de tarjeta (par in/out)

## Versionado

- Release type: **MINOR**
- Version: `1.4.0`
- Fecha: `2026-04-19`
