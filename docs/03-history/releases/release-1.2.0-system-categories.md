# Release 1.2.0 — System Categories Normalization

## Resumen

Encaja 1.2.0 introduce una normalización semántica de categorías para mejorar la calidad analítica, la consistencia funcional entre workspaces y la mantenibilidad del modelo.

El cambio central es la incorporación de un catálogo global de categorías del sistema (`system_categories`) y la evolución de las categorías del workspace para distinguir claramente entre categorías `system` y `custom`.

## Objetivo del release

- consolidar una base de categorías semánticas estable para reporting e insights
- mantener flexibilidad para categorías personalizadas por workspace
- mejorar la calidad histórica de datos mediante backfill y mapeos controlados
- endurecer migraciones para releases más seguros e idempotentes

## Highlights

- nuevo catálogo de categorías del sistema (`system_categories`)
- soporte explícito de `source` (`system` | `custom`) en `categories`
- asociación semántica por `system_category_id`
- expansión de buckets semánticos (incluye `expense_subscriptions`, `expense_other`, `expense_deliveries`)
- mapeo manual y por alias de categorías legacy a categorías del sistema
- cleanup de huérfanos y colisiones de `budget_items` tras mapeos

## Cambios funcionales

### Added

- Catálogo semántico global para flujos de ingreso, gasto, ahorro y transferencias.
- Seeding/backfill automático por workspace para instancias de categorías del sistema.
- Reglas de mapeo para reclasificar categorías históricas custom y mejorar consistencia analítica.

### Changed

- Modelo de categorías actualizado para incluir:
  - `source`
  - `system_category_id`
- UI de categorías y transacciones ajustada al nuevo modelo semántico.
- Se removió el input manual de `sort_order` en alta de categorías para reducir fricción.

### Fixed

- Hardening de migraciones (idempotencia, orden de constraints, recreación segura de policies y validaciones de tipos).
- Migraciones de limpieza para resolver colisiones en presupuesto y eliminar categorías huérfanas luego de mapeo.

## Impacto de datos y compatibilidad

- Requiere ejecutar migraciones de base de datos de este release en orden.
- El release está diseñado para preservar continuidad funcional sobre workspaces existentes mediante backfill y reglas de mapping.
- No introduce ruptura de flujo de uso para usuarios finales; sí modifica la base semántica interna del dominio de categorías.

## Notas operativas

- Validar en post-deploy:
  - creación/edición de categorías custom
  - alta de transacciones con categorías mapeadas
  - consistencia de presupuesto por categoría tras limpieza
  - render de vistas de categorías/transacciones en workspaces con datos legacy

## Versionado

- Release type: **MINOR**
- Version: `1.2.0`
- Fecha: `2026-04-18`
