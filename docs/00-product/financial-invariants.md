# Invariantes financieras

## Objetivo

Listar lo que tiene que seguir siendo cierto en los cálculos de dinero, con su fuente real. Este documento no crea reglas ni cambia código: registra lo que ya dicen `business-rules.md`, el código, los tests y las migraciones, y marca dónde no coinciden.

## Estados

| Estado | Significado |
|---|---|
| `Confirmada` | Hay una regla o restricción vigente y un test o constraint que la hace cumplir. |
| `Sin test` | La regla y el código coinciden, pero ningún test lo comprueba. |
| `No confirmada` | Hay una contradicción o falta la regla. No usarla como criterio: la decide el usuario. |

Las fuentes de base de datos son la última definición de cada objeto, reconstruyendo `supabase/migrations/` en orden. Se verificó el texto de las migraciones, no la base en ejecución.

---

## 1. Cálculo

| ID | Invariante | Fuente | Estado |
|---|---|---|---|
| FIN-01 | El dashboard imputa cada transacción por `effective_date ?? transaction_date`. | `business-rules.md` §4; `buildGovernedDateRangeFilter` y `buildGovernedDateBeforeFilter` en `dashboard-domain-rules.ts`; test `builds governed date filters with effective date fallback` | `Confirmada` |
| FIN-02 | La deuda rolada es `resumen - pagos`, y puede ser negativa: no se fuerza a cero. | `business-rules.md` §8.3; `buildFinancialSummary`; test `supports negative rolled debt when the card is overpaid` | `Confirmada` |
| FIN-03 | Solo se proyecta el componente variable. El total proyectado es fijo real más variable proyectado. | `business-rules.md` §11; `buildProjectionBehaviorSummary`; test `projects only variable components and preserves fixed components` | `Confirmada` |
| FIN-04 | Un mes cerrado no se infla: lo proyectado y el ingreso esperado son iguales a lo real. | `projectVariableComponent` en `buildProjectionBehaviorSummary`; tests `does not inflate projection for a closed month` y `matches the received fixed income in a closed month (FIN-04)` | `Confirmada` |
| FIN-05 | Una categoría de ingreso `custom` o `income_extra` es variable; las demás de ingreso son fijas. Una de gasto es fija solo con `expense_behavior = fixed`. | `business-rules.md` §10; `resolveCategoryBehavior`; test `resolves behavior for income and expense categories` | `Confirmada` |
| FIN-06 | Las tarjetas de crédito no suman al disponible. | `business-rules.md` §5; filtro `row.type !== "credit_card"` en `buildFinancialSummary`; test `keeps internal transfers neutral...`, que espera -200 con +200 en la tarjeta | `Confirmada` |
| FIN-07 | Una transferencia interna entre cuentas de efectivo o débito no cambia el disponible total. | `business-rules.md` §7.1; signo por `direction` en `use-dashboard-data.ts` y `buildFinancialSummary`. El test `keeps internal transfers neutral...` no contiene ninguna fila `transfer`, y el impacto llega ya calculado | `Sin test` |
| FIN-08 | El pago de tarjeta reduce el disponible y no cuenta como gasto. | `business-rules.md` §5 y §7.1; mismo signo por `direction`. El test del punto anterior no contiene ninguna fila de pago | `Sin test` |
| FIN-09 | Con el mes abierto, el ingreso fijo esperado es la suma, por categoría de ingreso fija, del máximo entre lo cobrado y lo presupuestado. El ingreso esperado total es el fijo esperado más el variable proyectado. | `business-rules.md` §11; `buildProjectionBehaviorSummary`; tests de `expected income (FIN-09)` | `Confirmada` |
| FIN-10 | Sin ingreso fijo esperado y con el mes abierto, un balance proyectado negativo no da "Crítico". | `business-rules.md` §14; `resolveFinancialState`; test `caps the level at attention when there is no expected fixed income and the month is open` | `Confirmada` |
| FIN-11 | Los consejos de tarjeta que comparan contra ingresos (uso alto, deuda alta y compromiso del mes siguiente) usan el ingreso esperado, no el cobrado. | `business-rules.md` §11; `generateCreditCardInsights`; test `does not report high usage on day 5 when the salary is expected but not yet received` | `Confirmada` |
| FIN-12 | El consejo de presupuesto en riesgo o excedido y el contador de la pantalla de Presupuesto usan la misma regla. | `business-rules.md` §9; `resolveBudgetCategoryRisk`, del que depende `isBudgetCategoryAtRisk`; test `counts the same categories as the budget page counter` | `Confirmada` |

## 2. Base de datos

| ID | Invariante | Fuente | Estado |
|---|---|---|---|
| FIN-20 | El monto de una transacción es mayor que cero. | `transactions.amount check (amount > 0)` en `20260410190000_mvp3_transactions.sql`; sin cambios posteriores | `Confirmada` |
| FIN-21 | El monto presupuestado es mayor o igual a cero. | `budget_items.amount check (amount >= 0)` en `20260410142000_mvp2_presupuesto_mensual.sql`; sin cambios posteriores. Ver FIN-43 | `Confirmada` |
| FIN-22 | La suma de las cuotas es igual al total de la compra. | Trigger diferido `ensure_installment_purchase_integrity`, función `validate_installment_purchase_integrity` en `20260420223000_mvp26_installment_purchases.sql`; también lo valida la creación en `20260513110000_mvp28_subcategories.sql` | `Confirmada` |
| FIN-23 | Una compra en cuotas tiene entre 2 y 120 cuotas. | `installment_purchases.installments_count check` en `20260420223000_mvp26_installment_purchases.sql` | `Confirmada` |
| FIN-24 | Una transferencia exige grupo, dirección y medio de pago. | `ensure_transaction_workspace_consistency` en `20260513110000_mvp28_subcategories.sql` | `Confirmada` |
| FIN-25 | Categoría, subcategoría y medio de pago pertenecen al workspace de la transacción, y su tipo coincide con el de la categoría. | `business-rules.md` §3 y §16; `ensure_transaction_workspace_consistency` en `20260513110000_mvp28_subcategories.sql` | `Confirmada` |
| FIN-26 | Hay un solo presupuesto por período, categoría y subcategoría. | `business-rules.md` §17; índice único `idx_budget_items_period_line_key` en `20260513110000_mvp28_subcategories.sql` | `Confirmada` |

## 3. Sin confirmar

Nada de esto cambia con este documento. Cada punto necesita una decisión del usuario antes de tomarse como regla.

| ID | Qué se observó | Fuente | Estado |
|---|---|---|---|
| FIN-40 | `resolveOperationalDate` usa `transaction_date` en la cuota 1 aunque exista `effective_date`, mientras §4 dice que `effective_date` tiene prioridad en todo el sistema. El dashboard sí la respeta, así que una misma cuota puede caer en meses distintos según la pantalla. | `transactions/utils.ts`; test `uses transaction_date for first installment`; `business-rules.md` §4 | `No confirmada` |
| FIN-41 | `saving` resta del saldo de la cuenta, pero §5 no lo menciona. | `buildFinancialSummary` y `use-dashboard-data.ts`; `business-rules.md` §5 | `No confirmada` |
| FIN-42 | §3 dice "tres tipos" y lista cuatro. | `business-rules.md` §3; `transactions_type_check` | `No confirmada` |
| FIN-43 | §17 dice "monto > 0", pero el presupuesto admite cero. Ver FIN-21. | `business-rules.md` §17 y §9 | `No confirmada` |
| FIN-44 | El balance solo cuenta medios `is_active` e `include_in_balance`, filtros que las reglas no mencionan. | `buildFinancialSummary` | `No confirmada` |
| FIN-45 | El resumen de tarjeta se infiere con `Math.max(0, ...)` y se toma el mayor con el guardado, sin regla que lo respalde. | `buildFinancialSummary`; `business-rules.md` §8.1 | `No confirmada` |
| FIN-46 | `parseBudgetAmount("Bs. 12.5")` da 125 y `"Bs 1,234.50"` da 1.23. | `features/budget/amount-format.ts`; `CHG-2026-11-007` | `No confirmada` |
| FIN-47 | Cambiar la moneda del workspace solo cambia la etiqueta: no convierte los montos guardados. §2 dice que no hay conversión, pero no define qué pasa con los montos al cambiarla. | `use-settings-general.ts`; `business-rules.md` §2 | `No confirmada` |
