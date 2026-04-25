

# TASK-2026-04-003 — Workspace Demo: actualización del dataset para incluir compras en cuotas

## Objetivo

Actualizar el dataset sembrado del **workspace demo** para incluir compras con tarjeta de crédito del tipo **installment purchase**, de modo que el demo también exhiba esta funcionalidad en la vista de transacciones.

## Alcance

Esta task **solo actualiza los movimientos sembrados del workspace demo**.

### Incluye

- Incorporar compras en cuotas dentro del dataset demo
- Crear registros en `installment_purchases`
- Generar las transacciones visibles asociadas a las cuotas dentro del período demo
- Ajustar descripciones visibles para que el usuario entienda claramente el concepto de cuota
- Validar que el demo siga mostrando:
  - mes anterior completo
  - mes actual hasta la fecha actual

### No incluye

- Cambios en lógica de negocio
- Cambios en reglas contables
- Cambios en el modelo funcional de cuotas
- Refactor de creación de workspace demo
- Cambios en transferencias, balances o categorías ya implementadas
- Backfills ni compatibilidad legacy

## Contexto

El flujo end-to-end de creación del workspace demo ya existe y funciona correctamente.

El objetivo de esta task no es rediseñar el demo, sino **evolucionar el dataset actual** para que también muestre compras en cuotas, aprovechando la implementación existente de `installment_purchases`.

Actualmente existe un único workspace demo en toda la aplicación, y puede ser eliminado por el owner. Por lo tanto, esta actualización puede resolverse regenerando el demo sin necesidad de migraciones retrocompatibles.

## Escenario deseado

El dataset demo debe incluir dos compras en cuotas con tarjeta de crédito:

### Compra 1 — Mes anterior

- Concepto sugerido: **Celular**
- Tipo: `installment_purchase`
- Medio de pago: tarjeta de crédito
- Cantidad de cuotas: `6`
- La compra se realiza en el mes anterior

#### Resultado esperado

- En el **mes anterior** se ve la **cuota 1 de 6**
- En el **mes actual** se ve la **cuota 2 de 6**

### Compra 2 — Mes actual

- Concepto sugerido: **Ropa**
- Tipo: `installment_purchase`
- Medio de pago: tarjeta de crédito
- Cantidad de cuotas: `6`
- La compra se realiza en el mes actual

#### Resultado esperado

- En el **mes actual** se ve la **cuota 1 de 6**
- No deben mostrarse cuotas futuras

## Regla de dataset

El demo debe seguir sembrando:

- **mes anterior completo**
- **mes actual hasta hoy**

Por lo tanto, para compras en cuotas:

- debe crearse el registro maestro en `installment_purchases`
- deben generarse en `transactions` **solo las cuotas visibles dentro del período demo**
- no deben insertarse cuotas futuras todavía

## Comportamiento esperado en Transactions

Las transacciones derivadas de cuotas deben mostrarse con una descripción comprensible, por ejemplo:

- `Celular — cuota 1 de 6`
- `Celular — cuota 2 de 6`
- `Ropa — cuota 1 de 6`

El objetivo es que el usuario entienda visualmente, sin explicación adicional, que se trata de compras financiadas.

## Lineamientos de implementación

### 1. Ajustar únicamente el dataset demo

Modificar la plantilla o generador actual del dataset demo para incorporar compras en cuotas.

### 2. No tocar la lógica del dominio

La lógica de negocio de cuotas ya está implementada y no forma parte de esta task.

### 3. Mantener el resto del demo intacto

Deben conservarse tal como están:

- los 3 medios de pago demo
- los ajustes iniciales
- la transferencia de pago de tarjeta al inicio del mes actual
- el resto de transacciones comunes ya sembradas

### 4. Sembrar cuotas de forma consistente

Las transacciones derivadas deben quedar correctamente vinculadas mediante:

- `installment_purchase_id`
- `installment_number`
- `installment_count`

### 5. No generar datos futuros

En el mes actual solo deben mostrarse cuotas cuya fecha efectiva o visible ya haya ocurrido.

## Criterios de aceptación

- El workspace demo sigue creándose correctamente
- El demo incluye al menos **2 compras en cuotas** con tarjeta de crédito
- Existe una compra en cuotas iniciada en el mes anterior y otra iniciada en el mes actual
- En el mes anterior se visualiza solo la cuota 1 de 6 de la compra correspondiente
- En el mes actual se visualiza:
  - la cuota 2 de 6 de la compra iniciada en el mes anterior
  - la cuota 1 de 6 de la compra iniciada en el mes actual
- No aparecen cuotas futuras
- No se modifica la lógica de negocio existente
- No se altera el comportamiento actual de transferencias, balances ni categorías

## Riesgos

### Riesgo 1 — Duplicación de cuotas

Si el generador mezcla mal las compras maestras con las transacciones visibles, puede duplicar cuotas en `transactions`.

**Mitigación:** validar explícitamente la cantidad esperada de cuotas visibles por compra.

### Riesgo 2 — Mostrar cuotas futuras

Si la lógica de fechas no respeta el corte del mes actual hasta hoy, el demo puede mostrar información futura.

**Mitigación:** reutilizar el mismo criterio temporal del dataset actual y filtrar por fecha visible.

### Riesgo 3 — Romper el demo actual

Si el cambio toca más que la plantilla de datos, puede alterar funcionalidades ya estables.

**Mitigación:** limitar el alcance al dataset sembrado y evitar cambios en negocio.

## Estrategia recomendada

Como existe un único demo y puede eliminarse manualmente, la estrategia recomendada es:

1. Ajustar la plantilla/generador del dataset demo
2. Eliminar el workspace demo actual
3. Regenerarlo con el nuevo dataset
4. Validar visualmente el mes anterior y el mes actual

## Definición de terminado

Esta task se considera terminada cuando el workspace demo existente pueda regenerarse y mostrar correctamente compras en cuotas visibles en Transactions, sin introducir cambios en la lógica de negocio ni romper el resto del dataset demo.

## Título sugerido de PR

`[FEAT] update workspace demo dataset to include installment purchases`