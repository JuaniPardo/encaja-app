# CHG-2026-11-004 — Renovar la sesión en el proxy

| Campo | Valor |
|---|---|
| Estado | En producción |
| Fecha | 2026-11-02 |
| Rama | `feature/renovar-sesion-proxy` |
| Release | v1.7.1 |
| Tarea relacionada | Ninguna |

## Pedido

> Arreglar el bug de sesión en src/proxy.ts: hoy un access token vencido se trata como inválido y se borra la cookie con el refresh token, así que el usuario vuelve al login aunque su sesión se pudiera renovar. Un fallo de red al validar el token tampoco debería cerrar la sesión.

## Qué cambió

- Con el access token vencido y el refresh token vigente, el proxy renueva la sesión y el usuario sigue en la app.
- Un fallo de red o del servidor de auth ya no borra la cookie ni se trata como sesión inválida.
- Si el servidor no puede validar la sesión por un fallo transitorio, se muestra una pantalla con la opción de reintentar.
- "Salir" y "Volver a ingresar" eliminan la sesión del navegador aunque falle la llamada a `/logout`.

## Por qué

- `isValidToken` no distinguía entre token vencido, sesión revocada y fallo de red, y en los tres casos borraba la cookie.
- Se usa `supabase-js` sin `@supabase/ssr`: evita una dependencia, una migración del cliente de navegador y un cambio de formato de cookie.
- Solo el proxy renueva, porque los Server Components no escriben cookies, y cada renovación usa un cliente nuevo para no compartir sesión entre usuarios.
- La renovación es reactiva, para no competir con el `autoRefreshToken` del navegador.
- Seguridad detectó que, al dejar de borrar la cookie en `/login`, un logout fallido parecía exitoso con la sesión intacta. Se corrigió en el ciclo 1.

## Áreas afectadas

- Pantallas o flujos: inicio y renovación de sesión, salir, pantalla nueva de error del árbol protegido.
- Archivos principales: `src/proxy.ts`, `src/lib/supabase/session-refresh.ts`, `auth-errors.ts`, `session-cookie.ts`, `server-verifier.ts`, `browser-client.ts`, `config.ts`, `src/lib/workspace/server-context.ts`, `src/features/workspace/workspace-provider.tsx`, `src/app/(protected)/error.tsx`, `src/features/i18n/dictionaries.ts`.
- Tablas, policies o funciones: ninguna.

## Migraciones

Ninguna.

## Verificación

- Lint, tipos, tests y build: pasan; 166 tests en 20 archivos contra 67 de la línea de base, también en orden aleatorio.
- Seguridad: hallazgo mayor S1 corregido en el ciclo 1; aprobado con hallazgos menores.
- UI: aprobado con hallazgos menores.
- Clean code: aprobado con hallazgos menores.
- Ciclos de corrección usados: 1 de 2.

## No verificado

Las revisiones de la fábrica no probaron contra Supabase real ni en un navegador real. Un rechazo de tokens inválidos se comprobó en develop contra Supabase real, y el dueño informó una prueba manual en develop antes del release, sin detalle de los casos cubiertos. Sigue sin confirmación específica:

- Renovación real, rotación de tokens y pedidos simultáneos.
- *Reuse interval* mayor a 0 en el proyecto; hay que confirmarlo en el dashboard.
- Que la respuesta de reuso entregue una sesión válida.
- `isDefinitiveAuthRejection` trata como definitivo todo 4xx salvo 408 y 429. Sin confirmar: un 409 en refresh concurrente podría borrar la cookie del ganador, y un 401 de gateway por API key inválida podría borrar la de cada usuario.
- Render de `error.tsx` y su botón de reintento.
- Pasaje de los headers `x-middleware-*` en la plataforma real de despliegue.

## Qué vigilar

- Usuarios que vuelven al login o rebotan por `/login`: carrera de renovación o error mal clasificado.
- Sesiones cerradas de forma masiva: revisar 401 de gateway y la API key.
- Errores 429 de auth: todas las renovaciones salen de la IP del servidor, y cualquiera puede consumir ese límite con cookies inventadas.
- Riesgos aceptados al entregar:
  - Con auth intermitente, una renovación en vuelo puede reescribir una sesión válida después de un logout.
  - Si `/logout` falla, la sesión no se revoca en Supabase.
  - `error.tsx` no ofrece salir y usa un título de sesión para cualquier error del árbol protegido.

## Rollback

1. Revertir el merge según `docs/01-engineering/traceability.md`.
2. No hay datos ni migraciones que compensar, y el formato de la cookie no cambia, así que las sesiones siguen funcionando.
3. Revertir devuelve el bug original: se pierde la sesión cuando vence el access token y ante fallos de red.

## Commits

```bash
git log --all --grep="Change-Id: CHG-2026-11-004"
```
