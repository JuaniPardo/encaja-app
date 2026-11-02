# CHG-2026-11-006 — Actualizar Next y dependencias vulnerables

| Campo | Valor |
|---|---|
| Estado | Integrado |
| Fecha | 2026-11-02 |
| Rama | `feature/actualizar-next-dependencias` |
| Release | Pendiente |
| Tarea relacionada | Ninguna |

## Pedido

> Actualizar Next a una versión que corrija la vulnerabilidad crítica que reporta npm audit, y también las dependencias de producción con vulnerabilidades altas cuando se pueda, como zod, sin romper la app.

Durante la implementación, el usuario decidió ampliar el alcance con: "Hacer el refactor", para resolver los errores nuevos de lint en presupuesto.

## Qué cambió

- `next` y `eslint-config-next` pasan a 16.4.4 y `zod` a 4.6.7. `npm audit --omit=dev` pasa de 8 vulnerabilidades a 0.
- `error.tsx` usa `retry`, porque Next 16.4 dejó de pasar `unstable_retry`.
- Presupuesto: la carga se deriva de lo pedido y lo resuelto, solo cuenta el último mes elegido, y un error de carga bloquea el formulario y ofrece "Reintentar".
- Si falla la carga base, presupuesto muestra el error en vez de decir que no hay categorías activas.
- Settings e insights se ajustaron a las reglas nuevas de `eslint-plugin-react-hooks`.

## Por qué

- Next 16.2.3 tenía una vulnerabilidad crítica, con denegación de servicio y bypass del proxy, en producción.
- Sin el cambio a `retry`, el botón "Reintentar" se rompería en producción sin que lint, tipos, tests ni build lo detectaran.
- Antes, un error al cargar un período dejaba editables los datos del mes anterior, y guardar escribía en ese mes.
- `load-state.ts` concentra las reglas de carga para poder probarlas sin renderizar la página.

## Áreas afectadas

- Pantallas o flujos: presupuesto, pantalla de error, modal de borrar workspace, insights.
- Archivos principales: `package.json`, `package-lock.json`, `src/app/(protected)/error.tsx`, `src/app/(protected)/app/[workspaceSlug]/budget/page.tsx`, `src/features/budget/load-state.ts`, `src/features/budget/components/budget-load-error-alert.tsx`, `src/features/insights/use-insights-v2.ts`, `settings/hooks/use-settings-lifecycle.ts`, `src/features/i18n/dictionaries.ts`.
- Tablas, policies o funciones: ninguna.

## Migraciones

Ninguna.

## Verificación

- Lint, tipos, tests y build: pasan; 201 tests contra 166 de la línea de base.
- Seguridad: aprobado. Dependencias del registro oficial con firmas verificadas, y proxy revisado contra la versión instalada.
- UI: dos hallazgos mayores corregidos en el ciclo 1; aprobado.
- Clean code: aprobado con hallazgos menores.
- Ciclos de corrección usados: 1 de 2.

## No verificado

Nada se ejecutó en un navegador ni contra Supabase. Sin probar:

- `budget/page.tsx`: el cableado no tiene tests; solo se cubren `load-state.ts` y la alerta. Cambio rápido de mes, guardar, copiar, revertir y reintentar con la red cortada.
- "Reintentar" de `error.tsx` dentro de Next real.
- Modal de borrar workspace e insights, cambiados sin tests.
- `npm ci` en Linux hasta que corra el CI. Versión de Node en Vercel.
- Login, renovación de sesión y redirecciones con Next 16.4.4.

## Qué vigilar

- Fallos en presupuesto: pantallas bloqueadas o cargando de más.
- Errores nuevos de hidratación o de despliegue tras subir de versión.
- Un fallo solo de subcategorías o de configuración ahora bloquea presupuesto. Antes seguía con datos parciales.
- Tras guardar, si la recarga falla, el formulario queda vacío aunque lo guardado esté bien.
- `npm audit` completo sigue reportando 24 vulnerabilidades de desarrollo, que no llegan a producción.

## Rollback

1. Revertir el merge según `docs/01-engineering/traceability.md`. Incluye `package-lock.json`.
2. Ejecutar `npm ci`. Volverían la vulnerabilidad crítica y el comportamiento anterior de presupuesto.
3. No hay datos ni migraciones que compensar.

## Commits

```bash
git log --all --grep="Change-Id: CHG-2026-11-006"
```
