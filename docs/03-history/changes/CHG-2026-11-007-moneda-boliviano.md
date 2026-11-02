# CHG-2026-11-007 — Moneda boliviano (Bs)

| Campo | Valor |
|---|---|
| Estado | Integrado |
| Fecha | 2026-11-02 |
| Rama | `feature/moneda-boliviano` |
| Release | Pendiente |
| Tarea relacionada | Ninguna |

## Pedido

> agregar la posibilidad de elegir la moneda de "Pesos Bolivianos" (Bs)

## Qué cambió

- Configuración permite elegir `BOB · Boliviano (Bs)`, en español e inglés.
- Con BOB, los montos se muestran con `Bs` en Dashboard, Presupuesto, Transacciones, Medios de pago, Insights y Cajas vinculadas.
- Los campos para escribir montos muestran `Bs` en vez de `$` en una Caja en BOB.

## Por qué

- `Intl.NumberFormat` muestra `BOB 1.235` por defecto, así que `getCurrencyFormatOptions` aplica `narrowSymbol` solo a BOB. Aplicarlo a todas las monedas cambiaría ARS, USD, CLP y otras.
- No hace falta migración: `currency_code` es `text`, sin check, y los vínculos ya admiten monedas distintas.
- Se usa el nombre oficial, "Boliviano", y no "Pesos Bolivianos". Cambiarlo es editar dos líneas de `dictionaries.ts`.

## Áreas afectadas

- Pantallas o flujos: Configuración, Dashboard, Presupuesto, Transacciones, Medios de pago, Insights.
- Archivos principales: `src/features/i18n/formatting.ts`, `src/features/i18n/dictionaries.ts`, `settings/types.ts`, `src/features/dashboard/lib/dashboard-math.ts`, `src/features/transactions/hooks/use-transactions-data.ts`, los modales de transacción y transferencia, `category-budget-row.tsx`.
- Tablas, policies o funciones: ninguna.

## Migraciones

Ninguna.

## Verificación

- Lint, tipos, tests y build: pasan; 234 tests contra 201 de la línea de base.
- Seguridad: aprobado, sin hallazgos.
- UI: hallazgo mayor del `$` fijo en campos de monto corregido en el ciclo 1; aprobado.
- Clean code: aprobado con hallazgos menores.
- Ciclos de corrección usados: 1 de 2.

## No verificado

No se probó en un navegador ni contra Supabase:

- Guardar BOB, recargar y que `currency_code` quede en `BOB`. La conclusión de que no hay restricciones sale de las migraciones del repo; no se consultó la base. Debe probarse con un owner.
- Que los navegadores muestren `Bs`: solo se comprobó en Node 20.9 y 22. Con otros datos se vería `BOB`, sin error.
- Aspecto del prefijo `Bs`, con ancho estimado de 32 px, y montos largos en mobile.
- Cajas vinculadas con un vínculo real.

## Qué vigilar

- Montos que se vean como `BOB 1.235` en alguna pantalla.
- En Presupuesto mobile, con centavos, un monto de seis cifras puede no entrar en el campo.
- `parseBudgetAmount` lee `"Bs. 12.5"` como 125 y `"Bs 1,234.50"` como 1.23 si alguien los escribe o pega. Es un problema previo que BOB hace más probable; el valor se ve antes de guardar.

## Rollback

1. Revertir el merge según `docs/01-engineering/traceability.md`.
2. No hay migraciones. Las Cajas que ya estén en BOB siguen funcionando: el selector las muestra como moneda existente y sus montos se ven como `BOB 1.235`.
3. Para volver atrás del todo, un owner elige otra moneda en Configuración. Eso solo cambia la etiqueta: no convierte montos.

## Commits

```bash
git log --all --grep="Change-Id: CHG-2026-11-007"
```
