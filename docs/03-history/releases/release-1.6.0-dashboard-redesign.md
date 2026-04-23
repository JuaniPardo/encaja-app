# Release 1.6.0 — Dashboard Redesign + Projection & Insight Engine

## Resumen

Encaja 1.6.0 consolida la evolución funcional y visual del dashboard en torno a una lectura financiera inmediata: primero lo crítico, después contexto, y recién al final el detalle operativo.

Este release integra la base de reglas consolidada del dashboard, el motor de proyección/comportamiento, el motor de estado financiero e insights, y el rediseño jerárquico de MVP28.

## Objetivo del release

- reducir el tiempo de interpretación del dashboard a segundos
- priorizar señales críticas (disponible, tarjeta, presión futura)
- mantener coherencia con reglas de negocio y fecha gobernante
- degradar detalle para evitar ruido visual

## Highlights

- nueva jerarquía visual del dashboard:
  - Prioridades del mes
  - Estado financiero + insight principal
  - Flujo del mes + top categorías
  - Presupuesto resumido
  - Últimas transacciones + cuotas/deuda
  - detalle de gastos colapsado al final
- motor de proyección con clasificación fijo/variable y estimación de cierre mensual
- motor de estado financiero con niveles `healthy/stable/attention/critical`
- corrección de métricas de tarjeta para resumen anterior, saldo pendiente/a favor y presión futura

## Cambios funcionales

### Added

- Motor de proyección y comportamiento para ingresos/gastos (`fixed`/`variable`) con totales proyectados mensuales.
- Motor de insights con priorización por severidad para seleccionar el insight principal del dashboard.
- Bloque compacto de `Cuotas y deuda` para lectura rápida de compromisos de tarjeta.

### Changed

- Rediseño de layout del dashboard con jerarquía guiada y bloques secundarios colapsables.
- Resumen de presupuesto vs gasto en formato compacto para evitar dominancia visual.
- Ajuste del gráfico `Flujo del mes` a estilo liviano con curva monotone.

### Fixed

- Corrección de cálculo de `Resumen del mes anterior` y `Saldo pendiente o a favor` usando balance real de tarjeta + flujos gobernados.
- Corrección de `Presión futura` incluyendo arrastre (`rolled carryover`).
- Mejora de copy para reemplazar terminología técnica de deuda rolada.

## Impacto y compatibilidad

- No rompe contratos de datos existentes.
- Mantiene reglas de negocio vigentes de dashboard/insights.
- No introduce cambios incompatibles en APIs públicas.

## Versionado

- Release type: **MINOR**
- Version: `1.6.0`
- Fecha: `2026-04-23`
