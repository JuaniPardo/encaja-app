# CHG-2026-11-005 — Entorno de Supabase para desarrollo

| Campo | Valor |
|---|---|
| Estado | En producción |
| Fecha | 2026-11-02 |
| Rama | `feature/entorno-supabase-dev` |
| Release | v1.7.2 |
| Tarea relacionada | Ninguna |

## Pedido

> Sí, prepararlo

Respuesta a la propuesta de preparar un proyecto Supabase separado para `develop`, porque hoy comparte base con producción.

## Qué cambió

- Se agregó `scripts/supabase-dev-migrate.sh`, que simula por defecto, exige una URL explícita y rechaza producción.
- Se agregó `docs/01-engineering/environments.md`, con el mapa de entornos, las reglas y los pasos de creación.
- `AGENTS.md` advierte que `supabase db push` sin `--db-url` apunta a producción.

## Por qué

- `develop`, el entorno local y producción usan el mismo proyecto de Supabase, comprobado en los despliegues el 2026-11-02. Cualquier prueba corre sobre datos reales.
- `supabase db push` usa `--linked` por defecto, y el proyecto enlazado es producción.
- Crear el proyecto y configurar Vercel son acciones de la cuenta del dueño, así que este cambio solo deja el camino preparado.

## Áreas afectadas

- Pantallas o flujos: ninguno; no cambia la app.
- Archivos principales: `scripts/supabase-dev-migrate.sh`, `docs/01-engineering/environments.md`, `AGENTS.md`, `docs/README.md`.
- Tablas, policies o funciones: ninguna.

## Migraciones

Ninguna.

## Verificación

- Lint, tipos, tests y build: no aplica; no cambia el código de la app.
- Seguridad: protecciones del script probadas con un CLI simulado, sin conectarse a ninguna base.
- UI: no aplica.
- Clean code: revisión manual; este cambio no pasó por la fábrica.
- Ciclos de corrección usados: no aplica.

## No verificado

- El script nunca corrió contra una base real. Las 45 migraciones nunca se aplicaron sobre una base vacía; la revisión de su contenido no encontró dependencias de datos previos.
- La protección compara la URL con `supabase/.temp/project-ref`: si ese archivo cambia al enlazar otro proyecto, deja de proteger a producción.

## Qué vigilar

- Que los valores de desarrollo en Vercel queden solo en Preview.
- Que nadie ejecute `supabase link` con otro proyecto.

## Rollback

1. Revertir el merge según `docs/01-engineering/traceability.md`.
2. No hay datos ni migraciones que compensar en producción.

## Commits

```bash
git log --all --grep="Change-Id: CHG-2026-11-005"
```
