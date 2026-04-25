

# Encaja App — MVP 22

## v1.1.0 — Transferencias entre medios de pago

---

## Tipo de release

MINOR (1.1.0)

---

## Decisión arquitectónica

Se implementan las transferencias como un tipo dentro de `transactions`:

- type = 'transfer'
- modelo basado en doble registro (in/out)

Motivo:
- velocidad de implementación
- reutilización de infraestructura existente
- coherencia con el modelo actual

---

## Modelo de datos

### Extensión de transactions

Agregar:

- transfer_group_id UUID
- direction TEXT CHECK ('in','out')

Reglas:

- toda transferencia genera EXACTAMENTE 2 registros
- ambos comparten transfer_group_id
- uno es 'out' (origen)
- otro es 'in' (destino)

---

## Reglas funcionales

### 1. Transferencia = movimiento interno

- NO es ingreso
- NO es gasto
- NO es ahorro

---

### 2. Impacto en presupuesto

Las transferencias deben ser excluidas SIEMPRE:

- dashboard
- insights
- reportes
- cálculos de presupuesto

Regla obligatoria:

```sql
WHERE type != 'transfer'
```

---

### 3. Impacto en balances

Las transferencias SÍ afectan balances:

balance_total =
starting_balance +
ingresos -
gastos -
ahorros -
transfer_out +
transfer_in

---

### 4. Pago de tarjeta

Si:

- destino.type = 'credit_card'

Entonces UX:

- mostrar como: "Pago de tarjeta"

Pero internamente:

- sigue siendo transfer

---

## Validaciones

### 1. Mínimo de cuentas

Para habilitar transferencias:

- deben existir al menos 2 payment_methods activos

Si no:

- deshabilitar acción
- mostrar mensaje: "Necesitás al menos dos cuentas para transferir dinero"

---

### 2. Origen != destino

Validar:

- no permitir transferir a la misma cuenta

---

### 3. Monto > 0

---

## UI / UX

### 1. Acción principal

- "Transferir"

Contextual:

- "Pagar tarjeta"

---

### 2. Representación en lista

Ejemplos:

- "Transferencia a Débito Galicia"
- "Transferencia desde Efectivo"
- "Pago de tarjeta VISA"

---

### 3. Color semántico

Usar Mantine:

- Yellow.0 como background

Motivo:

- neutro (no ingreso ni gasto)
- claramente diferenciable de teal/pink/indigo

---

## Queries (CRÍTICO)

### Regla global

Todas las queries de negocio deben excluir transferencias por defecto.

---

### Helper recomendado

Crear función base:

```ts
const excludeTransfers = (query) =>
  query.neq('type', 'transfer')
```

---

### Aplicar en:

- dashboard
- insights
- budget
- gráficos
- KPIs

---

### EXCEPCIÓN

NO excluir en:

- cálculo de balances
- vista de transacciones completa

---

## Creación de transferencia

### Flujo

1. generar transfer_group_id
2. insertar registro OUT
3. insertar registro IN

---

### Ejemplo

Débito → Tarjeta ($1000)

OUT:
- type: transfer
- direction: out
- payment_method: débito

IN:
- type: transfer
- direction: in
- payment_method: tarjeta

---

## Eliminación

Eliminar ambos registros por transfer_group_id

---

## Criterios de aceptación

- no hay duplicación de gasto al pagar tarjeta
- balances correctos entre cuentas
- transferencias no afectan presupuesto
- UI clara y diferenciada
- validaciones funcionan

---

## Definición de terminado

El sistema permite mover dinero entre cuentas de forma consistente, sin romper métricas ni generar ambigüedad conceptual.

---

## Nota técnica

Este enfoque es intencionalmente simple.

Si en el futuro:

- aumenta la complejidad
- se agregan reglas avanzadas

se evaluará migrar a entidad `transfers` separada.

## Correr Lint y Build para asegurar integridad

## Actualizar changelog, baseline y version