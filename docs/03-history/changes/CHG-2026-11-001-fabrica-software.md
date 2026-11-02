# CHG-2026-11-001 — Fábrica de software y trazabilidad

| Campo | Valor |
|---|---|
| Estado | En producción |
| Fecha | 2026-11-02 |
| Rama | `feature/fabrica` |
| Release | v1.7.1 |
| Tarea relacionada | Ninguna |

## Pedido

> Automatizar una fábrica de software: recibir pedidos en lenguaje simple y pasarlos por agentes con responsabilidades distintas (planificación, tests, seguridad y UI), revisar hasta 2 veces, pedir ayuda si no se resuelve y entregar el código antes de decidir el pase a producción. Revisar clean code y documentar cada cambio para poder rastrearlo, localizar bugs y hacer rollback.

## Qué cambió

- Se agregó la skill `/fabrica` y seis agentes: planificador, implementador, tester, seguridad, UI y clean code.
- Se agregó este registro de cambios, con un identificador por cambio que también va en los commits.
- Se agregó una guía para localizar bugs y hacer rollback.

## Por qué

- Los pedidos necesitan pasar por las mismas revisiones sin que quien escribe el código sea quien lo aprueba.
- El historial no conectaba un pedido con sus commits, sus migraciones y la forma de deshacerlo.

## Áreas afectadas

- Pantallas o flujos: ninguno; no cambia la app.
- Archivos principales: `.claude/agents/`, `.claude/skills/fabrica/`, `docs/03-history/changes/`, `docs/01-engineering/`.
- Tablas, policies o funciones: ninguna.

## Migraciones

Ninguna.

## Verificación

- Lint, tipos, tests y build: no aplica; no cambia el código de la app.
- Seguridad: los revisores no tienen herramientas de edición y se les prohíbe tocar Supabase y `.env.local`.
- UI: no aplica.
- Clean code: revisión manual de la fábrica; el contrato de veredicto se centralizó en un solo archivo.
- Guía de trazabilidad: consultas, `git bisect run`, `Change-Id`, `--no-ff` y revert de un merge probados en un clon descartable.
- Ciclos de corrección usados: no aplica; esta fábrica no se construyó con sí misma.

## No verificado

Todavía no se ejecutó una corrida completa: los agentes se cargan al abrir una sesión nueva.

## Qué vigilar

- Revisores que aprueben sin evidencia o sin la línea final de veredicto.
- Registros que no coincidan con lo que muestra `git log`.

## Rollback

1. Revertir el merge siguiendo `docs/01-engineering/traceability.md`.
2. No hay datos ni migraciones que compensar.

## Commits

```bash
git log --all --grep="Change-Id: CHG-2026-11-001"
```
