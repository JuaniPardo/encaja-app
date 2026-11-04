# CHG-AAAA-MM-NNN — Título

| Campo | Valor |
|---|---|
| Estado | Entregado |
| Fecha | AAAA-MM-DD |
| Rama | `feature/slug` |
| Release | Pendiente |
| Tarea relacionada | Ninguna |
| Clasificación | Tamaño, riesgo y si es financiero |
| Revisores por ciclo | Ciclo 0: ... |
| Diagnóstico | Sí o no |
| Informes | `.claude/fabrica/runs/<CHG>-<slug>/`, solo en la copia local |

Estados posibles: `Entregado`, `Integrado`, `En producción`, `Revertido`.

## Pedido

> Texto original del pedido.

## Qué cambió

Comportamiento nuevo o corregido, en lenguaje simple.

## Por qué

Problema que resuelve y decisiones tomadas.

## Áreas afectadas

- Pantallas o flujos:
- Archivos principales:
- Tablas, policies o funciones:

## Migraciones

Ninguna.

| Archivo | Qué hace | Cómo compensarla |
|---|---|---|
| `supabase/migrations/...` | ... | ... |

## Verificación

- Lint, tipos, tests y build:
- Seguridad:
- UI:
- Clean code:
- Ciclos de corrección usados:

## No verificado

Lo que no se ejecutó, por ejemplo RLS, migraciones o pantallas.

## Qué vigilar

Síntomas que indicarían que este cambio causó un problema.

## Rollback

Pasos concretos para este cambio, según `docs/01-engineering/traceability.md`. Indicar si deshacer el código exige también compensar datos o migraciones, y en qué orden.

## Commits

```bash
git log --all --grep="Change-Id: CHG-AAAA-MM-NNN"
```
