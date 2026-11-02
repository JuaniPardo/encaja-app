# CHG-2026-11-002 — Corregir errores de tipos en tests

| Campo | Valor |
|---|---|
| Estado | Integrado |
| Fecha | 2026-11-02 |
| Rama | `feature/corregir-tipos-tests` |
| Release | Pendiente |
| Tarea relacionada | Ninguna |

## Pedido

> Arreglá los 3 errores de tipos que tira tsc en los tests

## Qué cambió

`tsc` pasa de 3 errores a ninguno. No cambia el comportamiento de la app ni lo que verifican los tests.

## Por qué

- El mock `rpc` de `bootstrap.test.ts` tomaba su tipo solo de `create_workspace_with_defaults` y rechazaba la fila de `delete_workspace`.
- `filterSeedRowsByMonth` en `demo-seed.test.ts` perdía el tipo de fila y, con él, `description`.
- Se corrigieron los tests y no el código de producción, porque el problema estaba en sus tipos.

## Áreas afectadas

- Pantallas o flujos: ninguno.
- Archivos principales: `src/lib/workspace/bootstrap.test.ts`, `src/lib/workspace/demo-seed.test.ts`.
- Tablas, policies o funciones: ninguna.

## Migraciones

Ninguna.

## Verificación

- Lint, tipos, tests y build: lint limpio, `tsc` sin errores, 67 tests pasan y el build compila.
- Seguridad: aprobado, sin hallazgos.
- UI: omitida; no cambió ningún `.tsx`, `.css` ni `dictionaries.ts`.
- Clean code: aprobado, con un hallazgo menor.
- Ciclos de corrección usados: 0 de 2.

## No verificado

Nada relevante: el cambio solo toca anotaciones de tipos en tests. No se ejecutó la app, porque el cambio no la afecta.

## Qué vigilar

Ningún síntoma en producción: las anotaciones se borran al compilar. `tsc` no corre en `npm test`, `npm run lint` ni CI, así que errores como estos pueden volver sin aviso.

## Rollback

1. Revertir el merge según `docs/01-engineering/traceability.md`. Volverían los 3 errores de `tsc`.
2. No hay datos ni migraciones que compensar.

## Commits

```bash
git log --all --grep="Change-Id: CHG-2026-11-002"
```
