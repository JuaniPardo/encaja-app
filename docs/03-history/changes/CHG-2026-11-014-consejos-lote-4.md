# CHG-2026-11-014 — Consejos y avisos, lote 4 (motor de consejos)

| Campo | Valor |
|---|---|
| Estado | En producción |
| Fecha | 2026-11-04 |
| Rama | `feature/consejos-lote-4` |
| Release | v1.11.0 |
| Tarea relacionada | Review de consejos y avisos (lote 4) |
| Clasificación | L, riesgo alto, UI, financiero |
| Revisores por ciclo | Ciclo 0: tester, clean-code, seguridad, ui |
| Diagnóstico | No |
| Informes | `.claude/fabrica/runs/CHG-2026-11-014-consejos-lote-4/`, solo en la copia local |

Estados posibles: `Entregado`, `Integrado`, `En producción`, `Revertido`.

## Pedido

> Sí, lote 4

Lote 4 del review de consejos y avisos (motor de insights): K13, K14, M2, M4, A1, A2, y usar el ingreso esperado en los consejos de tarjeta (pendiente del lote 2).

## Qué cambió

- **Tarjeta contra el ingreso esperado:** los consejos de uso, deuda y cuotas del mes siguiente comparan contra lo que esperás cobrar este mes (con el sueldo presupuestado como piso), no solo contra lo cobrado. Antes del sueldo dejan de saltar con proporciones enormes.
- **"Estás usando más la tarjeta que el mes pasado":** compara lo gastado con tarjeta este mes contra el mes anterior a la misma fecha, desde el día 10. Antes comparaba contra la deuda total.
- **Categoría concentrada:** mira solo el gasto variable y exige el día 10, 5 movimientos y 2 categorías. Es advertencia, nunca alerta, y no dice "más peso del habitual".
- **Orden de los consejos:** un solo criterio, severidad y después prioridad. Se quitaron `urgency` e `impact` y se ajustaron prioridades para conservar el orden de hoy.
- **Etiquetas del dashboard:** cada tipo de consejo tiene su etiqueta. "Atención" ya no aparece.
- **Consejos nuevos de presupuesto** (sección "Presupuesto", solo con presupuesto variable): "Ya superaste tu presupuesto en X" (advertencia), "Podrías excederte en X si mantenés este ritmo" (informativo, misma regla que el contador "en riesgo") y "Vas 15% por debajo de lo previsto en gastos variables" (positivo, desde el día 10).
- Documentación: BR §9 y §13; invariantes FIN-11 y FIN-12.

## Por qué

El review encontró que los avisos de tarjeta saltaban antes del sueldo, que la aceleración comparaba contra la deuda y no contra el consumo, que el alquiler disparaba "desbalance" y que el motor no miraba el presupuesto, que es el consejo más útil de una app de presupuesto. La regla de "en riesgo" tiene una sola fuente (`resolveBudgetCategoryRisk`), compartida con el contador de Presupuesto.

## Áreas afectadas

- Pantallas o flujos: consejo principal del dashboard y página de Consejos (`/insights`).
- Archivos principales: `src/features/insights/*` (motor, módulos, `data.ts`, tipos, `thresholds.ts`, `context-math.ts`, `kind-label.ts`, `modules/budget.ts`), `src/features/budget/line-status.ts`, `dashboard-primary-insight-card.tsx`, `dictionaries.ts`, `docs/00-product/business-rules.md` y `financial-invariants.md`.
- Tablas, policies o funciones: ninguna. Sin consultas nuevas.

## Migraciones

Ninguna.

## Verificación

- Lint, tipos, tests y build: lint y typecheck sin errores; 41 archivos y 1586 tests en verde (base: 39 y 1480); build con placeholders exitosa; `npm audit --omit=dev` sin vulnerabilidades. Los tests de FIN-03, FIN-04, FIN-09 y FIN-10 no se tocaron.
- Seguridad: aprobado, sin hallazgos. Solo lectura y cálculo en memoria, sin escrituras ni consultas nuevas.
- UI: aprobado, con menores. Revisión estática, sin navegador.
- Clean code: aprobado, con menores.
- Ciclos de corrección usados: 0 de 2.

## No verificado

El dueño no informó una prueba en develop antes del release v1.11.0. Todo lo de esta sección sigue sin verificar en producción.

- Nada se vio en un navegador: los badges nuevos, la sección "Presupuesto" y cómo se cortan en mobile los títulos con nombre de categoría o porcentaje.
- Cuántas veces "En riesgo" ocupa el consejo principal a principio de mes: usa la misma regla que el contador, sin mínimo de días (el día 1 alcanza con más del 13% gastado).
- Que el consejo y el contador de Presupuesto partan de los mismos datos: el consejo no filtra categorías inactivas y la página sí, y la página no excluye ajustes.
- La carga de datos de `insights/data.ts` no tiene test propio.

## Qué vigilar

- "En riesgo" como consejo principal durante los primeros días de cada mes.
- Un consejo de presupuesto sobre una categoría que en Presupuesto no figura (inactiva).
- Avisos de tarjeta antes del sueldo: ahora comparan contra el ingreso esperado; sin presupuesto de ingreso siguen sin generarse.
- El último día de un mes largo (por ejemplo el 31 de marzo), la aceleración compara solo hasta el día 28.

## Rollback

No hay migraciones ni datos. Revertir el merge de la rama:

```bash
git revert -m 1 <commit de merge con Change-Id: CHG-2026-11-014>
```

Revertir también restaura BR §9 y §13 y quita FIN-11 y FIN-12.

## Commits

```bash
git log --all --grep="Change-Id: CHG-2026-11-014"
```
