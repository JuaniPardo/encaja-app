# CHG-2026-11-012 — Consejos y avisos, lote 2

| Campo | Valor |
|---|---|
| Estado | En producción |
| Fecha | 2026-11-04 |
| Rama | `feature/consejos-lote-2` |
| Release | v1.10.0 |
| Tarea relacionada | Review de consejos y avisos (lote 2); sigue a CHG-2026-11-011 |
| Clasificación | L, riesgo alto, UI, financiero |
| Revisores por ciclo | Ciclo 0: tester, clean-code, seguridad, ui |
| Diagnóstico | No |
| Informes | `.claude/fabrica/runs/CHG-2026-11-012-consejos-lote-2/`, solo en la copia local |

Estados posibles: `Entregado`, `Integrado`, `En producción`, `Revertido`.

## Pedido

> ok. Adelante con los cambion

Decisiones del usuario sobre el lote 2:

> - Proyección del ingreso fijo: "Sí, usar el presupuesto (Recommended)"
> - Tarjeta impaga: "Aviso desde mitad de mes (Recommended)"
> - Mes del dashboard: "Fijos en hoy, con rótulo (Recommended)"
> - Contador del presupuesto: ""En riesgo", por ritmo (Recommended)"

Ítems del review: K4, K3, K9, K15, K5 y M1.

## Qué cambió

- **Ingreso esperado (K4):** para los consejos y el estado financiero, el ingreso fijo de cada categoría es el mayor entre lo cobrado y lo presupuestado, mientras el mes está abierto. Así, antes de que entre el sueldo presupuestado, el estado deja de salir "Crítico". Sin ingreso fijo cobrado ni presupuestado, un balance proyectado negativo da como máximo "Atento" hasta el último día del mes.
- **Tarjeta impaga (K3):** del 1 al 15 es informativo, desde el 16 es advertencia. Nunca es alerta.
- **Dashboard (K9):** el estado financiero y el consejo principal llevan el rótulo "Hoy" y se ocultan al mirar un mes pasado.
- **Frase del estado (M1):** la tarjeta de estado financiero explica el motivo del nivel en una frase. "Presión futura" pasa a "Por pagar de tarjeta".
- **"En riesgo" (K15):** el contador del presupuesto cuenta solo gastos variables que van más de 10 puntos por encima de la parte del mes transcurrida, o que ya superaron lo previsto. Reemplaza a "críticas". Ingresos y Ahorro muestran solo la cantidad de categorías.
- **Ahorro (K5):** en Presupuesto, superar lo previsto se ve en el color del ahorro, con "Ahorrado", "Por ahorrar" y "Superado". Ya no cuenta en el contador. Queda coherente con el dashboard.

## Por qué

El review encontró falsos "Crítico" antes del sueldo, una alerta de tarjeta todos los meses desde el día 1, un dashboard que mezclaba el mes elegido con el actual, un contador que marcaba gastos fijos pagados y ahorro como "crítico", y una explicación del estado que se calculaba pero no se mostraba. Las cuatro reglas de producto las decidió el usuario. Cambian BR §9, §11, §13 y §14, y se agregan FIN-09 y FIN-10. FIN-03 y FIN-04 siguen igual; FIN-04 se extiende al ingreso esperado.

## Áreas afectadas

- Pantallas o flujos: dashboard (estado financiero y consejo principal), Consejos (`/insights`: severidad de tarjeta impaga e ingreso proyectado), Presupuesto (líneas de ahorro y contador).
- Archivos principales: `src/features/dashboard/lib/dashboard-domain-rules.ts`, `src/features/insights/data.ts`, `financial-state.ts`, `modules/credit-card.ts`, `src/features/dashboard/lib/insights-view-state.ts`, las tarjetas de estado y de consejo, `src/features/budget/line-status.ts`, `category-budget-row.tsx`, las páginas de dashboard y presupuesto, `dictionaries.ts`, `docs/00-product/business-rules.md`, `financial-invariants.md` y `ui-guidelines.md`.
- Tablas, policies o funciones: ninguna cambia. Los consejos ahora leen `budget_periods` y `budget_items` del workspace (solo lectura, con RLS existente).

## Migraciones

Ninguna.

## Verificación

- Lint, tipos, tests y build: lint y typecheck sin errores; 36 archivos y 1433 tests en verde (base: 1360); build con placeholders exitosa; `npm audit --omit=dev` sin vulnerabilidades. Los tests de FIN-03 y FIN-04 no se tocaron.
- Seguridad: aprobado, sin hallazgos. La lectura nueva se filtra por el período del propio workspace y la respalda RLS.
- UI: aprobado, con menores. Revisión estática, sin navegador.
- Clean code: aprobado, con menores.
- Ciclos de corrección usados: 0 de 2.

## No verificado

El dueño no informó una prueba en develop antes del release v1.10.0. Todo lo de esta sección sigue sin verificar en producción.

- La lectura de `budget_items` en los consejos no tiene test ni se ejecutó contra la base. Verificar en develop: con el sueldo presupuestado y sin cobrar, a principio de mes, el estado no debería salir "Crítico".
- Nada se vio en un navegador: el rótulo "Hoy", la frase en 375 px, el ocultamiento con un mes pasado, el ahorro en modo oscuro y el contador en mobile.
- Que las policies de RLS en producción y develop coincidan con las migraciones del repo.

## Qué vigilar

- "Crítico" o "Atento" a principio de mes con el sueldo presupuestado: el ingreso esperado no se está leyendo.
- Un gasto fijo marcado "en riesgo": falta `expense_behavior` en la consulta de categorías.
- Con disponible negativo, la frase de margen puede decir "-$ X disponibles" junto a "Tenés margen".
- Avisos de uso y deuda de tarjeta altos antes del sueldo: siguen usando el ingreso cobrado (pendiente para el lote 4).

## Rollback

No hay migraciones ni datos. Revertir el merge de la rama:

```bash
git revert -m 1 <commit de merge con Change-Id: CHG-2026-11-012>
```

Revertir también restaura las reglas de BR §9, §11, §13 y §14 y quita FIN-09 y FIN-10 del documento de invariantes.

## Commits

```bash
git log --all --grep="Change-Id: CHG-2026-11-012"
```
