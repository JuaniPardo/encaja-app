

# Encaja App — MVP 21

## MVP 21 — Corrección del modelo de balance: balance total por cuenta vs resumen mensual

---

## Objetivo

Corregir y dejar explícita la lógica financiera central de Encaja para distinguir con claridad entre:

- el **balance total** de cada cuenta / medio de pago
- el **resumen mensual** del período actual

Este MVP busca eliminar inconsistencias conceptuales y de cálculo, asegurando que la app muestre correctamente:

- cuánto dinero o deuda tiene hoy cada cuenta
- cuánto ingresó, gastó y ahorró el usuario en el mes actual

---

## Problema a resolver

Hoy existe una tensión entre dos conceptos distintos:

### 1. Balance total de cuenta
Representa el saldo acumulado histórico de un medio de pago.

### 2. Resumen mensual
Representa los movimientos del período actual.

El problema aparece cuando:

- el usuario carga un saldo inicial al crear un medio de pago
- ese valor se guarda en `current_balance`
- pero la app no lo usa correctamente
- o se mezcla el resumen del mes con el balance total de la cuenta

Eso puede producir:

- balances incorrectos
- pérdida de confianza en la app
- inconsistencias entre lo que el usuario espera y lo que ve

---

## Resultado esperado

Al finalizar este MVP, Encaja debe mostrar correctamente y sin ambigüedad:

### Balance total por cuenta / medio de pago
- cuánto tiene hoy el usuario en cada cuenta
- cuánto debe hoy en una tarjeta o medio negativo

### Resumen mensual
- ingresos del mes
- gastos del mes
- ahorros del mes
- balance del mes

Estos conceptos deben convivir, pero nunca mezclarse ni reemplazarse entre sí.

---

## Alcance

### Incluye

#### 1. Reinterpretación de `current_balance`
Tomar el campo actual `payment_methods.current_balance` como si fuera conceptualmente un:

- `starting_balance`

En esta etapa no hace falta renombrar la columna físicamente en DB, pero sí corregir su significado y uso en producto y código.

#### 2. Cálculo correcto del balance total por cuenta
El balance total de una cuenta debe calcularse como:

```text
balance_total_cuenta = starting_balance + suma histórica de movimientos de esa cuenta
```

#### 3. Separación clara con el resumen mensual
El dashboard y los resúmenes del período deben seguir mostrando solo:

- ingresos del mes
- gastos del mes
- ahorros del mes
- balance del mes

#### 4. Ajuste de UI y copy
La app debe dejar claro que al crear o editar un medio de pago se está cargando un:

- saldo inicial

no un saldo dinámico calculado por la app.

#### 5. Consistencia transversal
Revisar que esta lógica se aplique en:

- dashboard
- medios financieros
- formularios de medios de pago
- cualquier vista que muestre balances de cuentas

---

### NO incluye

Este MVP no debe incluir:

- conciliación bancaria
- actualización automática de saldos externos
- caching avanzado de balances
- renombre físico de columna en DB si complica demasiado esta entrega
- lógica avanzada de cierres de tarjeta

---

## Decisiones de producto

### 1. Balance total ≠ resumen mensual
Estos son dos conceptos distintos y deben mantenerse separados.

#### Balance total por cuenta
Responde:
- cuánto tengo hoy
- cuánto debo hoy

#### Resumen mensual
Responde:
- cuánto ingresó este mes
- cuánto gasté este mes
- cuánto ahorré este mes

### 2. `current_balance` deja de ser “saldo actual mutable”
En esta etapa, el campo existente se interpreta como:

- saldo inicial

No debe usarse como una fuente de verdad dinámica independiente de las transacciones.

### 3. La fuente de verdad del movimiento son las transacciones
El balance total de una cuenta se construye a partir de:

- saldo inicial
- más movimientos acumulados

### 4. El resumen mensual sigue siendo del período
Nada de esto debe alterar la lógica ya existente de resumen mensual.

---

## Reglas funcionales

### 1. Balance total por cuenta
La app debe calcular el balance total de cada cuenta como:

```text
balance_total_cuenta = starting_balance + suma histórica de transacciones asociadas a esa cuenta
```

### 2. Resumen mensual
La app debe seguir calculando por período actual:

- `ingresos_mes`
- `gastos_mes`
- `ahorros_mes`
- `balance_mes`

### 3. No mezclar niveles
No se debe:

- usar solo los movimientos del mes para mostrar el balance total de una cuenta
- usar el balance total de una cuenta como reemplazo del balance del mes

### 4. UI de medios de pago
Cuando el usuario crea o edita un medio de pago, el campo debe llamarse:

- `Saldo inicial`

Texto de ayuda sugerido:

- `Este es el saldo desde el cual empezás a registrar movimientos en Encaja.`

### 5. Signo y semántica
La cuenta puede tener:

- saldo positivo
- saldo negativo

Y eso debe seguir mostrándose correctamente en UI.

---

## Propuesta técnica

### 1. Balance por medio de pago
La lógica de cálculo debe incorporar el saldo inicial más los movimientos acumulados.

Conceptualmente:

```sql
starting_balance +
SUM(
  CASE
    WHEN type = 'income' THEN amount
    WHEN type = 'expense' THEN -amount
    WHEN type = 'saving' THEN -amount
    ELSE 0
  END
)
```

> Ajustar la convención exacta de `saving` según la lógica ya definida en Encaja, pero mantener la regla de que el balance total se construye desde el saldo inicial más transacciones históricas.

### 2. Resumen mensual
Las queries del dashboard mensual deben seguir siendo independientes y filtrar por período.

### 3. Evolución futura
Más adelante se puede hacer una migración explícita:

```sql
ALTER TABLE payment_methods
RENAME COLUMN current_balance TO starting_balance;
```

Pero no es obligatoria en este MVP si complica el alcance.

---

## Propuesta de UX

### 1. Medios financieros
Cada card de medio de pago debe mostrar:

- nombre
- tipo
- balance total actual de esa cuenta

Ese valor debe incluir saldo inicial + movimientos acumulados.

### 2. Dashboard / Resumen
Debe seguir mostrando claramente:

- ingresos del mes
- gastos del mes
- ahorros del mes
- balance del mes

### 3. Formularios
En alta / edición de medio de pago:

- cambiar label a `Saldo inicial`
- agregar helper text explicativo

### 4. Claridad mental para el usuario
La app debe hacer evidente que:

- una cuenta tiene un saldo histórico total
- el mes tiene un comportamiento propio separado

---

## Criterios de aceptación

### Producto
- el saldo inicial cargado por el usuario tiene efecto real en los balances mostrados
- el usuario puede confiar en que la app refleja su situación financiera desde el primer uso

### Balance total por cuenta
- cada cuenta muestra su balance total real
- ese balance incluye el saldo inicial y movimientos históricos

### Resumen mensual
- ingresos, gastos y ahorros del mes siguen calculándose solo por período
- no se contaminan con saldos históricos de cuentas

### UX
- el formulario deja de hablar de “saldo actual” al crear un medio de pago
- se entiende claramente el concepto de saldo inicial

### Técnica
- los cálculos dejan de ignorar el valor guardado actualmente en `current_balance`
- la lógica queda consistente en toda la app

---

## Orden de implementación

### 1
- reinterpretar `current_balance` como saldo inicial a nivel de producto y código

### 2
- actualizar las queries o helpers de balance total por cuenta

### 3
- revisar dashboard y medios financieros para asegurar separación conceptual

### 4
- cambiar labels y helper text en formularios de medios de pago

### 5
- validar visual y funcionalmente que los balances sean coherentes

---

## Definición de terminado

El MVP está completo cuando Encaja distingue correctamente entre balance total por cuenta y resumen mensual, utiliza el saldo inicial cargado por el usuario como base real de cálculo, y muestra balances coherentes y confiables en toda la app sin mezclar conceptos históricos con datos del período actual.

---

## Próximos pasos sugeridos

Después de este MVP, los siguientes incrementos posibles podrían ser:

- renombrar físicamente `current_balance` a `starting_balance`
- mejorar manejo de tarjetas de crédito con cierre y vencimiento
- optimizar performance de balances con vistas o caché
- incorporar auditoría o reconciliación más avanzada