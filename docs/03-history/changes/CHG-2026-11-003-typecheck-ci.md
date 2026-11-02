# CHG-2026-11-003 — Chequeo de tipos en CI y en la fábrica

| Campo | Valor |
|---|---|
| Estado | En producción |
| Fecha | 2026-11-02 |
| Rama | `feature/typecheck-ci` |
| Release | v1.7.1 |
| Tarea relacionada | Depende de CHG-2026-11-002 |

## Pedido

> suma a la fabrica la correccion de los errores de riesgo que mencionaste.

Se interpretó como los pendientes señalados en la entrega de CHG-2026-11-002: `tsc` no corría de forma automática y el planificador podía incluir tareas del registro `CHG` en sus planes.

## Qué cambió

- Se agregó `npm run typecheck`.
- Se agregó CI en GitHub Actions: lint, tipos, tests y build en cada pull request y en cada push a `develop` y `main`.
- El implementador ahora corre siempre lint, tipos y tests antes de terminar.
- La línea de base y el tester usan `npm run typecheck`.
- El planificador ya no incluye el registro `CHG` ni los commits como pasos.

## Por qué

- Los 3 errores de CHG-2026-11-002 pasaron desapercibidos porque nada ejecutaba `tsc`.
- Sin CI, un error llega a `develop` o `main` sin que nadie lo vea.
- En una prueba, el planificador incluyó el registro `CHG` en su plan, y eso podía duplicar el trabajo.

## Áreas afectadas

- Pantallas o flujos: ninguno; no cambia la app.
- Archivos principales: `package.json`, `.github/workflows/ci.yml`, `.claude/agents/`, `.claude/skills/fabrica/SKILL.md`, `README.md`, `docs/01-engineering/dev-workflow.md`.
- Tablas, policies o funciones: ninguna.

## Migraciones

Ninguna.

## Verificación

- Lint, tipos, tests y build: ejecutados en local con los mismos comandos del workflow.
- Seguridad: el workflow solo tiene permiso de lectura y usa valores ficticios, sin secretos.
- UI: no aplica.
- Clean code: revisión manual; esta modificación de la fábrica no pasó por la fábrica.
- Ciclos de corrección usados: no aplica.

## No verificado

Nada pendiente. El workflow pasó en GitHub Actions en su primera ejecución, el 2026-11-02, sobre el commit `14c5b13`.

## Qué vigilar

- La primera ejecución en GitHub.
- Tiempo de ejecución y consumo de minutos de Actions.
- CI en rojo si este cambio llega a una rama sin CHG-2026-11-002.

## Rollback

1. Revertir el merge según `docs/01-engineering/traceability.md`.
2. No hay datos ni migraciones que compensar.

## Commits

```bash
git log --all --grep="Change-Id: CHG-2026-11-003"
```
