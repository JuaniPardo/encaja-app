# CHG-2026-11-013 — Mensajes de error para el usuario

| Campo | Valor |
|---|---|
| Estado | En producción |
| Fecha | 2026-11-04 |
| Rama | `feature/errores-usuario` |
| Release | v1.10.1 |
| Tarea relacionada | Review de consejos y avisos (lote 3, K11) |
| Clasificación | L, riesgo alto, UI |
| Revisores por ciclo | Ciclo 0: tester, clean-code, seguridad, ui |
| Diagnóstico | No |
| Informes | `.claude/fabrica/runs/CHG-2026-11-013-errores-usuario/`, solo en la copia local |

Estados posibles: `Entregado`, `Integrado`, `En producción`, `Revertido`.

## Pedido

> Sí, lote 3

Lote 3 del review de consejos y avisos (K11): unas 40 notificaciones mostraban el error crudo de Supabase/PostgREST. Crear un helper único que nunca muestre el texto crudo, lo registre en `console.error` y traduzca los códigos conocidos; reemplazar los dos `getErrorMessage` duplicados y "Unknown insights error"; no romper el traductor de login.

## Qué cambió

- **Traductor único de errores** (`src/lib/errors/user-facing-error.ts`): nunca muestra el texto técnico de un error; lo registra en la consola del navegador. Traduce a mensajes en español e inglés los casos conocidos: sin permiso, sesión vencida, dato duplicado, dato inválido, datos vinculados, sin conexión y demora. Reconoce los mensajes útiles que lanza la base (por ejemplo "No encontramos ese email…") y los muestra traducidos. Para lo demás usa el mensaje de respaldo de cada pantalla.
- **Unos 80 lugares en 21 archivos** dejaron de mostrar el error crudo: avisos de dashboard, movimientos, transferencias, categorías, medios de pago, presupuesto, inicio, consejos, configuración, perfil, feedback y registro, y la pantalla "No pudimos cargar tu sesión".
- Se eliminaron los dos `getErrorMessage` duplicados y "Unknown insights error".
- Los mensajes que la app ya traducía (Caja Demo existente, nombre mínimo, errores de sesión) se marcan como `UserFacingError` y se siguen viendo tal cual.
- El login no cambia: sigue con su propio traductor.
- Un test recorre el código y falla si alguien vuelve a mostrar `error.message` en pantalla.

## Por qué

El review encontró avisos en inglés, técnicos y a veces con detalles internos ("violates row-level security policy", nombres de constraints). Decisiones:
- El helper recibe el mensaje de respaldo ya traducido, para que el test del diccionario siga controlando que exista.
- Los mensajes de negocio de la base se reconocen por su texto exacto. Si una migración futura lo cambia, se cae al mensaje de respaldo, que sigue siendo seguro.
- El rollback de la Caja Demo y el borrado de Caja relanzan el error original con su código, en lugar de envolverlo en un texto crudo.

## Áreas afectadas

- Pantallas o flujos: todos los avisos de error de datos, la pantalla de error de sesión y el registro.
- Archivos principales: `src/lib/errors/user-facing-error.ts`, `src/features/auth/error-messages.ts`, `src/lib/workspace/bootstrap.ts`, `src/features/workspace/workspace-provider.tsx`, `src/features/budget/load-state.ts`, `dictionaries.ts` y los hooks y páginas que muestran errores.
- Tablas, policies o funciones: ninguna.

## Migraciones

Ninguna.

## Verificación

- Lint, tipos, tests y build: lint y typecheck sin errores; 39 archivos y 1480 tests en verde (base: 36 y 1433); build con placeholders exitosa; `npm audit --omit=dev` sin vulnerabilidades. El grep de errores crudos solo encuentra el traductor nuevo y el de login.
- Seguridad: aprobado, sin hallazgos. Ningún camino muestra texto de backend; el registro va solo a la consola del navegador del usuario, sin telemetría.
- UI: aprobado, con menores. Revisión estática, sin navegador.
- Clean code: aprobado, con menores.
- Ciclos de corrección usados: 0 de 2.

## No verificado

El dueño no informó una prueba en develop antes del release v1.10.1. Todo lo de esta sección sigue sin verificar en producción.

- Nada se probó en un navegador ni contra la base: cómo se ven los avisos, la pantalla de sesión y qué forma tienen los errores de red reales en Safari, Chrome y Firefox (una forma desconocida cae en el mensaje genérico).
- Que los textos de negocio reconocidos coincidan exactamente con los `raise exception` vigentes en la base. Si no coinciden, se ve el mensaje de respaldo, nunca el crudo.
- El login y el registro siguen mostrando el texto crudo de auth cuando no lo conocen (fuera de alcance).

## Qué vigilar

- Un aviso que diga solo "Ocurrió un error inesperado" donde antes había un mensaje útil: falta ese texto en la tabla de negocio. La consola del navegador muestra el error original con "[encaja] error".
- Que la creación de la Caja Demo o el borrado de una Caja dejen de avisar cuando fallan.
- Con un corte de red, el dashboard puede mostrar varios avisos iguales de "No pudimos conectarnos".

## Rollback

No hay migraciones ni datos. Revertir el merge de la rama:

```bash
git revert -m 1 <commit de merge con Change-Id: CHG-2026-11-013>
```

## Commits

```bash
git log --all --grep="Change-Id: CHG-2026-11-013"
```
