

# MVP: Workspace Demo (Caja Demo)

## 🎯 Objetivo

Crear un **workspace demo (Caja Demo)** que permita al usuario:

- Entender rápidamente el valor de Encaja
- Ver datos realistas sin tener que cargar información manual
- Aprender features clave (transferencias, categorías, ajustes)
- Reducir fricción de onboarding

---

## 🧠 Principios del Demo

- No hardcodear insights
- No depender del companion
- Dataset realista, no perfecto
- Usar solo categorías del sistema
- Mostrar uso de múltiples medios de pago
- Permitir “inicio sin historia” mediante ajuste manual

---

## 🧱 Restricción: Workspace Demo

- Un usuario puede tener **solo 1 workspace demo activo**
- Si ya existe → no se puede crear otro
- Si se elimina → se puede crear uno nuevo

### Implementación

Campo en `workspaces`:

```sql
is_demo boolean NOT NULL DEFAULT false
```

Validación:
- `created_by + is_demo = true` debe ser único

---

## 💳 Medios de Pago (Payment Methods)

Se crean automáticamente:

- Tarjeta de Débito → `debit_card`
- Efectivo → `cash`
- Tarjeta de Crédito → `credit_card`

Todos con:
```text
current_balance = 0
```

- current_balance es el campo que indica el saldo inicial del medio de pago

---

## ⚖️ Ajustes Iniciales (Balance Adjustment)

Se insertan el **día 1 del mes anterior**

### Regla

- Solo tipo `expense`
- Categoría: `balance_adjustment`
- Representa dinero ya gastado o deuda existente

### Ejemplo

| Medio        | Monto  |
|--------------|--------|
| Débito       | 180k   |
| Efectivo     | 60k    |
| Crédito      | 420k   |

---

## 📅 Período del Demo

- Mes anterior → completo
- Mes actual → desde día 1 hasta hoy

---

## 🧮 Manejo de Fechas

### Regla clave

```
resolvedDay = min(baseDay, lastDayOfMonth)
```

### Filtro mes actual

```
insertar solo si resolvedDay <= today
```

---

## 🔁 Transferencia (Pago de Tarjeta)

Se crea al inicio del mes actual.

### Regla

- Día: `min(3, today)`
- Tipo: `transfer`
- Genera 2 transacciones:
  - OUT → débito
  - IN → crédito

Monto sugerido:
```
900000
```

---

## 📦 Plantilla de Eventos

### Estructura

```ts
{
  key: string
  period: 'previous_month' | 'current_month'
  baseDay: number
  type: 'income' | 'expense' | 'transfer'
  categoryKey?: string
  paymentMethodKey?: 'debit' | 'cash' | 'credit'
  amount: number
  description?: string
  notes?: string
}
```

---

## 🧾 Eventos Incluidos

### Mes anterior

- Sueldo
- Alquiler / expensas / servicios
- Supermercado (débito + crédito)
- Compras en efectivo
- Transporte
- Salidas / delivery
- Colegio / actividades
- Farmacia
- Suscripciones
- Shopping

---

### Mes actual

- Sueldo (día 1)
- Pago de tarjeta (día 1–3)
- Ingreso extra (día 12)
- Mismos patrones de gasto que mes anterior
- Solo hasta día actual

---

## 🚫 Exclusiones

- No usar categorías custom
- No usar ajustes en ingresos
- No usar datos futuros
- No hardcodear insights

---

## 🧠 Historia que cuenta el demo

1. El usuario ya tenía actividad previa
2. Tiene:
   - efectivo
   - saldo en cuenta
   - deuda en tarjeta
3. Usa múltiples medios de pago
4. Paga tarjeta al inicio del mes
5. Recibe ingresos
6. Sigue gastando
7. Termina en leve déficit controlado

---

## 📊 Resultado esperado

- Balance por cuenta distinto
- Tarjeta negativa
- Caja total levemente negativa (-150k a -200k)
- Distribución de gastos variada
- Dataset “vivo”

---

## 🏗️ Flujo de creación

1. Validar que no exista demo
2. Crear workspace (`is_demo = true`)
3. Crear payment methods
4. Obtener categorías sistema
5. Insertar ajustes iniciales
6. Insertar mes anterior
7. Insertar mes actual (hasta hoy)
8. Insertar transferencia
9. (Opcional) insertar presupuestos

---

## ⚠️ Riesgos y mitigación

| Riesgo | Mitigación |
|------|--------|
| Uso excesivo de ajuste | warning en categoría |
| Dataset artificial | mezcla de medios y fechas |
| Confusión de saldo | naming claro de cuentas |

---

## 🧭 Estado

- Modelo: sólido
- Categorías: resueltas
- Transferencias: correctas
- Dataset: definido

---

## 🚀 Próximo paso


Implementar:

```
buildDemoSeed(referenceDate)
```

Que:

- resuelva fechas
- filtre por hoy
- genere transferencias dobles
- devuelva inserts listos

---

## 🛠️ Plan de implementación del MVP

Conviene dividir este MVP en PRs chicas y secuenciales para reducir riesgo, facilitar testing y evitar mezclar schema, lógica de seed y UI en un mismo cambio.

### Orden recomendado

1. PR-1: Restricción de workspace demo
2. PR-2: Medios de pago demo + categoría de ajuste
3. PR-3: Motor de generación del dataset demo
4. PR-4: Creación end-to-end del workspace demo
5. PR-5: QA, hardening y pulido UX

---

## PR-1 — Restricción de Workspace Demo

### Objetivo

Permitir la existencia de un solo workspace demo por usuario.

### Alcance

- Agregar `is_demo` en `workspaces`
- Validar que un usuario no pueda crear más de un demo activo
- Permitir crear uno nuevo si el demo anterior fue eliminado
- Ajustar queries/helpers que necesiten distinguir workspaces demo de workspaces normales

### Entregables

- Migración de base de datos
- Validación en servicio o action de creación
- Tests de unicidad / bloqueo

### Criterios de aceptación

- Si el usuario no tiene demo, puede crearlo
- Si el usuario ya tiene demo, la creación falla con mensaje claro
- Si el demo fue eliminado, puede crearse uno nuevo

---

## PR-2 — Medios de Pago Demo + Categoría de Ajuste

### Objetivo

Dejar lista la base mínima para sembrar un demo realista.

### Alcance

- Crear automáticamente los 3 payment methods demo:
  - Tarjeta de Débito
  - Efectivo
  - Tarjeta de Crédito
- Confirmar uso de `current_balance` como saldo inicial/base
- Incorporar o validar la categoría sistema `balance_adjustment`
- Asegurar warning y flags necesarios para esa categoría

### Entregables

- Lógica de creación de medios de pago demo
- Seed o validación de categoría sistema `balance_adjustment`
- Tests básicos de creación

### Criterios de aceptación

- El demo crea exactamente 3 medios de pago
- Todos quedan con `current_balance = 0`
- La categoría `balance_adjustment` existe y puede usarse en gastos
- No se usa ajuste en ingresos

---

## PR-3 — Motor de generación del Dataset Demo

### Objetivo

Construir el generador de transacciones demo con fechas relativas al día actual.

### Alcance

- Implementar `buildDemoSeed(referenceDate)`
- Resolver mes anterior completo + mes actual hasta hoy
- Aplicar regla:
  - `resolvedDay = min(baseDay, lastDayOfMonth)`
- Filtrar eventos del mes actual con `resolvedDay <= today`
- Generar transferencias dobles con `transfer_group_id`
- Materializar ajustes iniciales, eventos del mes anterior y eventos del mes actual

### Entregables

- Helper(s) de fechas
- Plantilla de eventos
- Materializador de eventos a inserts reales
- Tests unitarios del generador

### Criterios de aceptación

- El dataset nunca genera fechas futuras en el mes actual
- El dataset funciona en meses de 28, 30 y 31 días
- Las transferencias generan exactamente 2 transacciones vinculadas
- Los ajustes iniciales se insertan el día 1 del mes anterior

---

## PR-4 — Creación End-to-End del Workspace Demo

### Objetivo

Conectar la creación del workspace demo completo en una sola acción de producto.

### Alcance

- Crear workspace demo
- Crear membresía/relaciones necesarias
- Crear payment methods demo
- Obtener categorías sistema requeridas
- Ejecutar `buildDemoSeed(referenceDate)`
- Insertar transacciones demo
- Insertar transferencia de pago de tarjeta al inicio del mes actual
- Opcional: insertar budget periods y budget items demo

### Entregables

- Action/service de creación completa del demo
- Manejo transaccional o rollback razonable si algo falla
- Tests de integración

### Criterios de aceptación

- La creación del demo deja el workspace listo para usar
- El usuario ve movimientos del mes anterior y del mes actual
- El demo incluye pago de tarjeta al inicio del mes actual
- El demo usa los 3 medios de pago

---

## PR-5 — QA, Hardening y Pulido UX

### Objetivo

Asegurar que la experiencia del demo sea estable, comprensible y fácil de mantener.

### Alcance

- Revisar naming visible de medios de pago
- Verificar warnings de `balance_adjustment`
- Ajustar copy de errores o bloqueo de segundo demo
- Validar balances visibles y consistencia del historial
- Testear creación y borrado de demo varias veces
- Revisar performance y duplicaciones accidentales

### Entregables

- Fixes finales
- Ajustes de copy/UX
- Checklist manual de QA

### Criterios de aceptación

- El flujo se entiende sin explicación externa
- No hay duplicación de transacciones
- No hay inconsistencias de fechas o balances
- La recreación del demo funciona correctamente después del borrado

---

## ✅ Recomendación de alcance

Para mantener foco y velocidad:

- PR-1 y PR-2 deben ser chicas
- PR-3 es la pieza central de lógica
- PR-4 conecta todo
- PR-5 solo corrige y pule, no redefine nada

No conviene mezclar PR-3 y PR-4 si querés revisar bien el generador antes de enchufarlo al flujo real.

---

## 📌 Notas de ejecución

- El dataset demo debe ser determinístico o pseudo-determinístico controlado
- El demo no debe depender de companion, insights ni reglas especiales de UI
- El objetivo del demo es enseñar el producto con datos creíbles, no simular una contabilidad perfecta
- Una vez cerrada la plantilla de eventos, no reabrir debate de modelo dentro de los PRs de implementación
