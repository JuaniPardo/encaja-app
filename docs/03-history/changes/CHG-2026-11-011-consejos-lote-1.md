# CHG-2026-11-011 — Consejos y avisos, lote 1

| Campo | Valor |
|---|---|
| Estado | Entregado |
| Fecha | 2026-11-04 |
| Rama | `feature/consejos-lote-1` |
| Release | Pendiente |
| Tarea relacionada | Review de consejos y avisos (lote 1 de 5) |
| Clasificación | L, riesgo alto, UI, financiero |
| Revisores por ciclo | Ciclo 0: tester, clean-code, seguridad, ui |
| Diagnóstico | No |
| Informes | `.claude/fabrica/runs/CHG-2026-11-011-consejos-lote-1/`, solo en la copia local |

Estados posibles: `Entregado`, `Integrado`, `En producción`, `Revertido`.

## Pedido

> Haz un review de los consejos y avisos que la aplicacion le da al usuario. Luego elabora un plan para eliminar lo innecesario, corregir lo que este mal, mejorar lo que este flojo, y agregar lo que creas conveniente

Tras recibir el review, el usuario dijo "comencemos". Esta corrida es el lote 1 del review, el que no necesita decisiones: K1, K2, E1, E2, K6, K7, K8, K10, K12 y A4.

## Qué cambió

- **Porcentajes (K1):** los consejos y el estado financiero muestran "62%" en lugar de "$ 62%" o "Bs 62%".
- **Tarjeta (K2):** los mensajes de tarjeta impaga y de deuda que pasa al próximo resumen ya no dicen "Esto reduce el dinero disponible". El de deuda muestra cuánto se pagó.
- **Sin tarjetas (E1):** si el workspace no tiene tarjetas de crédito, no hay consejos de tarjeta ni sección de tarjeta en Consejos.
- **Alerta doble (E2):** se eliminó la alerta de "presión del resumen", que repetía la de uso de tarjeta. Un consumo de tarjeta entre el 35% y el 80% de los ingresos ya no genera aviso; desde el 80% avisa la de uso.
- **Ahorro en el dashboard (K6):** ahorrar más de lo previsto se ve en positivo y ahorrar menos en negativo.
- **"En lo previsto" (K7):** una línea del presupuesto con el real igual al previsto dice "En lo previsto" en lugar de "Disponible: $ 0" o "Por recibir: $ 0".
- **Balance del presupuesto (K8):** con balance 0 dice que está balanceado, también en mobile. Con balance negativo dice "Asignaste X por encima de tus ingresos" en lugar de "Estás excedido".
- **Dashboard (K10):** mientras cargan los consejos se ve un esqueleto y, si fallan, un mensaje de error. Nunca muestra "Estable · bajo control" sin datos. Con la tarjeta de primeros pasos no se muestra el estado financiero.
- **Cuotas (K12):** al editar una compra en cuotas, menos de 2 cuotas da error en el campo. El aviso de respaldo tiene un título propio ("Cantidad de cuotas inválida").
- **Tests de texto final (A4):** generan los consejos con el diccionario real, en español e inglés y con ARS y BOB, y fallan si queda "{{", una clave sin traducir o una moneda junto a un porcentaje. Encontraron un bug más: el título del consejo de categoría concentrada mostraba "{{categoryName}}" literal. Quedó corregido.

## Por qué

El review encontró que estos mensajes mostraban datos mal formateados, decían algo falso (BR §5 y §8.3), duplicaban alertas o afirmaban un estado sin datos (BR §14). Decisiones:
- No se muestra el monto inferido del resumen anterior (FIN-45, no confirmada), solo el monto pagado.
- El mínimo de 2 cuotas se exige en el formulario solo si el campo está visible, para no dejar un error en un campo oculto. La mutación y la base siguen validando FIN-23.
- Los porcentajes van sin decimales y sin espacio antes del "%".

## Áreas afectadas

- Pantallas o flujos: dashboard (estado financiero, consejo principal, desvíos de ahorro), Consejos (`/insights`), Presupuesto (líneas y resumen de balance), modal de transacción (edición de compras en cuotas).
- Archivos principales: `src/features/insights/*` (motor, módulos, `intl.ts`, `use-insights-v2.ts`), `src/features/dashboard/lib/insights-view-state.ts`, `src/features/dashboard/components/dashboard-insights-status-card.tsx`, `src/features/budget/balance-summary.ts`, `src/features/budget/line-status.ts`, `src/features/transactions/schema.ts`, `transaction-form-modal.tsx`, `dictionaries.ts`, `docs/00-product/ui-guidelines.md`.
- Tablas, policies o funciones: ninguna.

## Migraciones

Ninguna.

## Verificación

- Lint, tipos, tests y build: lint y typecheck sin errores; 36 archivos y 1360 tests en verde (base: 34 y 1239); build con placeholders exitosa; `npm audit --omit=dev` sin vulnerabilidades. Antes de corregir, los tests de A4 fallaban contra el código viejo (64 fallos, según el implementador).
- Seguridad: aprobado, sin hallazgos. Ningún camino permite guardar una compra en cuotas con menos de 2.
- UI: aprobado, con menores. Revisión estática, sin navegador.
- Clean code: aprobado, con menores.
- Ciclos de corrección usados: 0 de 2.

## No verificado

Nada se probó en un navegador:

- El esqueleto y el error del dashboard, y la tarjeta de primeros pasos a ancho completo en escritorio.
- "En lo previsto" en el presupuesto, en claro y oscuro, y que entre en el ancho de mobile.
- El resumen de balance a 375 px.
- El error de cuotas en el modal al editar una compra en cuotas, y el aviso al cambiar a un medio que no es tarjeta.
- RLS, la base y el RPC de compras en cuotas: no se ejecutó nada contra Supabase.

## Qué vigilar

- Ahorro superado: el dashboard lo muestra en positivo, pero Presupuesto lo sigue marcando en rojo como "Excedido" y lo cuenta como crítico hasta K5 (lote 2).
- Un consejo con "{{", una clave cruda o "$ 62%": los tests de A4 deberían haberlo frenado.
- Que el dashboard quede en esqueleto o en error con datos válidos.
- Que no se pueda guardar una edición válida de una compra en cuotas.

## Rollback

No hay migraciones ni datos. Revertir el merge de la rama:

```bash
git revert -m 1 <commit de merge con Change-Id: CHG-2026-11-011>
```

## Commits

```bash
git log --all --grep="Change-Id: CHG-2026-11-011"
```
