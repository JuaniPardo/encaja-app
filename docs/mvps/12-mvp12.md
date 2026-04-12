

# Encaja App — MVP 12

## MVP 12 — Saldos y balance actual por medio de pago

---

## Objetivo

Evolucionar el concepto actual de `payment_methods` para que Encaja pueda mostrar de forma clara cuánto dinero tiene disponible hoy el usuario, cómo se distribuye entre sus distintos medios operativos y cuál es su balance financiero total.

Este MVP no introduce todavía una tabla nueva de `accounts`. En esta etapa, se aprovecha la entidad ya existente `payment_methods`, extendiéndola para que también pueda representar saldo o deuda actual cuando corresponda.

---

## Problema a resolver

Hoy Encaja ya permite entender:

- en qué se gasta
- cómo evoluciona el presupuesto
- cómo se comportan las categorías
- qué insights surgen del período

Pero todavía falta responder una pregunta básica y crítica:

**¿Cuánta plata tengo realmente hoy y dónde está?**

Además, el sistema ya tiene introducido el concepto de `payment_methods`, por lo que crear una entidad nueva de cuentas en este momento agregaría complejidad innecesaria y duplicación conceptual.

La meta de este MVP es dar visibilidad financiera real usando la base actual del modelo.

---

## Resultado esperado

Al finalizar este MVP, un usuario debe poder:

- ver todos sus medios de pago operativos relevantes en una sección visible del Dashboard
- entender el saldo o deuda actual de cada uno
- ver un balance total consolidado
- distinguir visualmente saldos positivos y negativos
- administrar estos medios de pago desde la pantalla correspondiente
- dejar el sistema preparado para una relación más rica entre transacciones y saldos en el futuro

---

## Alcance

### Incluye

#### 1. Evolución de `payment_methods`
Extender la entidad actual para soportar saldo o deuda actual.

Campos o conceptos a incorporar en esta etapa:

- `current_balance` o equivalente
- definición clara de qué métodos deben participar del balance principal

#### 2. Tipos iniciales soportados
Se sigue trabajando con tipos ya existentes como:

- `cash`
- `debit_card`
- `credit_card`
- `bank_transfer`
- `other`

#### 3. Visualización en Dashboard
Agregar una nueva sección o tarjeta visible en el Dashboard para mostrar:

- balance total consolidado
- listado de medios relevantes
- saldo o deuda individual

#### 4. Gestión
Permitir que el usuario pueda:

- crear medio de pago
- editar medio de pago
- activar / desactivar
- actualizar saldo actual si corresponde al modelo elegido

#### 5. Preparación para relación futura con transacciones
Dejar el sistema bien encaminado para que las transacciones puedan aprovechar esta capa financiera de forma más profunda más adelante.

---

### NO incluye

Este MVP no debe incluir:

- una nueva tabla `accounts`
- conciliación bancaria
- importación automática de movimientos
- límites de crédito
- disponible vs deuda de tarjeta por cierre
- transferencias entre cuentas
- múltiples monedas
- lógica contable avanzada
- cálculos sofisticados de flujo de caja

---

## Decisión de producto

En esta etapa, Encaja **no separa todavía**:

- `payment_method`
- `account`

En cambio, decide que ciertos `payment_methods` también funcionen como **instrumentos financieros visibles** dentro del producto.

Esto permite avanzar rápido, aprovechar el modelo actual y evitar duplicar entidades demasiado pronto.

---

## Reglas funcionales

### 1. Medio de pago operativo
Un `payment_method` puede representar no solo un mecanismo de pago, sino también un instrumento con saldo o deuda visible para el usuario.

### 2. Balance total
El balance total debe calcularse como la suma de los `payment_methods` activos que participen del balance.

Esto implica:

- saldos positivos suman
- saldos negativos restan

### 3. Crédito
En esta etapa, los `credit_card` deben mostrarse como posición negativa cuando corresponda.

No introducir todavía conceptos como:

- límite
- cierre
- vencimiento
- saldo disponible vs deuda refinada

### 4. Métodos que participan del balance
No todos los `payment_methods` necesariamente deben participar del balance principal de la misma forma.

Se debe definir una regla simple y clara para esta etapa.

Opciones viables:
- por tipo
- por flag específico
- por convención de uso

La implementación puede elegir el camino más simple que mejor encaje con el código actual.

### 5. Cantidad de medios
El usuario puede crear tantos medios de pago como necesite.

### 6. Orden de visualización
Regla recomendada para esta etapa:

- ordenar por saldo descendente
- mantener nombres claros y montos visibles

### 7. Estado
Los medios de pago pueden estar activos o inactivos.

Los inactivos no deberían participar del balance principal si eso mejora la claridad de la UX.

---

## Propuesta de estructura

### 1. Dashboard
Agregar una sección visible tipo:

**Cuentas** o **Medios financieros**

Con algo como:

- Balance total: `$ X.XXX.XXX`
- lista de instrumentos:
  - Efectivo → `$ 120.000`
  - Débito ICBC → `$ 850.000`
  - Crédito Visa → `-$ 320.000`

### 2. Gestión de medios
Aprovechar o evolucionar la pantalla de medios de pago para permitir:

- alta
- edición
- activación / desactivación
- actualización de saldo actual

### 3. Drill-down futuro
Idealmente, cada medio debería quedar preparado para permitir drill-down hacia transacciones filtradas por `payment_method`.

No es obligatorio explotar todo ese flujo en este MVP si complica demasiado, pero sí conviene pensarlo desde ahora.

---

## Criterios de aceptación

### Producto
- el usuario puede entender rápidamente cuánto dinero tiene disponible
- el usuario puede ver dónde está distribuido ese dinero
- el usuario entiende la diferencia entre saldos positivos y negativos

### Dashboard
- la nueva tarjeta o bloque se integra bien al Dashboard
- el balance total es visible y claro
- el listado de instrumentos se entiende fácilmente

### Gestión
- se pueden crear, editar y desactivar medios de pago
- se puede gestionar el saldo actual según el modelo elegido
- el sistema soporta múltiples instrumentos sin fricción

### Consistencia
- el diseño de esta nueva capa se siente parte del mismo sistema visual que el resto de Encaja
- no se siente como una pieza aislada o improvisada

### Técnica
- la entidad actual de `payment_methods` queda mejor preparada para integrarse con transacciones y drill-down más adelante

---

## Orden de implementación

### 1
- definir cómo evoluciona `payment_methods`
- agregar el campo de saldo actual o equivalente

### 2
- decidir qué métodos participan del balance principal

### 3
- construir o adaptar CRUD de medios de pago

### 4
- integrar la nueva sección al Dashboard

### 5
- calcular balance total consolidado

### 6
- preparar relación futura con transacciones y drill-down

### 7
- pulir UX, copy y consistencia visual

---

## Definición de terminado

El MVP está completo cuando Encaja permite visualizar y gestionar el saldo o deuda actual de los `payment_methods` relevantes, mostrando un balance total consolidado y una distribución clara del dinero del usuario, sin introducir todavía una tabla nueva de cuentas ni lógica financiera avanzada.

---

## Próximos pasos sugeridos

Después de este MVP, los siguientes incrementos posibles podrían ser:

- asociación más profunda entre `payment_methods` y transacciones
- drill-down desde cada medio a sus movimientos filtrados
- separación más fina entre saldo disponible y deuda
- transferencias entre instrumentos
- conciliación manual o automática