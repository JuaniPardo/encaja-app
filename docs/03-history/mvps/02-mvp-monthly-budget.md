

# Encaja App — MVP 2 Definition

## Fecha
2026-04-10

## Estado
Draft

## Autor
Juan Pardo

---

## 1. Nombre del MVP

**MVP 2 — Presupuesto mensual**

---

## 2. Objetivo

Construir el primer módulo de planificación financiera de Encaja, permitiendo definir y editar el presupuesto mensual por categoría para un workspace.

Este MVP debe transformar la configuración base del sistema en una herramienta útil de planificación, preparada para que más adelante pueda compararse contra la ejecución real.

---

## 3. Resultado esperado

Al finalizar este MVP, un usuario debe poder:

- seleccionar un año y un mes
- crear el presupuesto de ese período si no existe
- editar montos presupuestados por categoría
- ver subtotales por tipo
- ver total general del presupuesto del período
- copiar el presupuesto del mes anterior

---

## 4. Alcance

### 4.1 Incluye

#### Período presupuestario
- selección de año
- selección de mes
- carga del presupuesto para el período seleccionado
- creación automática del período si no existe

#### Presupuesto por categoría
- listado de categorías activas del workspace
- edición del monto presupuestado por categoría
- agrupación por tipo (`income`, `expense`, `saving`)
- subtotales por grupo
- total general

#### Persistencia
- guardar presupuesto en `budget_periods`
- guardar montos en `budget_items`
- actualizar montos existentes

#### Utilidad operativa
- acción para copiar el presupuesto del mes anterior al período actual

---

### 4.2 No incluye

Este MVP no debe incluir:

- transacciones
- comparación real vs presupuesto
- dashboard con lógica real
- proyecciones
- plantillas anuales complejas
- importación/exportación
- cálculo automático de ahorro
- generación automática de categorías

---

## 5. Pantallas incluidas

### 5.1 Presupuesto mensual
La pantalla debe permitir:

- elegir año
- elegir mes
- visualizar categorías agrupadas por tipo
- ingresar o modificar el monto presupuestado por categoría
- ver subtotales por grupo
- ver el total general
- guardar cambios
- copiar presupuesto del mes anterior

### 5.2 Estados de la pantalla
Debe contemplar:

- estado vacío cuando no hay categorías
- estado inicial cuando el período aún no tiene presupuesto
- estado de carga
- feedback de guardado exitoso o fallido

---

## 6. Entidades involucradas

Este MVP usa las siguientes entidades:

- categories
- budget_periods
- budget_items
- workspaces
- workspace_members

Depende indirectamente de lo ya resuelto en MVP 1:

- auth
- profile
- workspace
- settings

Todavía no utiliza:

- transactions

---

## 7. Reglas funcionales del MVP

### 7.1 Período presupuestario
- un workspace puede tener un solo `budget_period` por combinación año/mes
- si el período no existe, el sistema puede crearlo al guardar por primera vez

### 7.2 Categorías incluidas
- solo se presupuestan categorías activas
- una categoría puede no tener presupuesto aún
- si una categoría no tiene presupuesto, su valor inicial debe verse como vacío o cero según la decisión de UI, pero sin ambigüedad

### 7.3 Montos
- los montos deben ser numéricos
- no deben ser negativos en esta versión
- el cero es válido

### 7.4 Agrupación
Las categorías deben mostrarse agrupadas por:
- income
- expense
- saving

### 7.5 Subtotales
El sistema debe calcular:
- subtotal de ingresos presupuestados
- subtotal de gastos presupuestados
- subtotal de ahorro presupuestado
- total general del período

### 7.6 Copia del mes anterior
Si existe presupuesto para el mes anterior:
- copiar sus `budget_items` al período actual
- si el período actual no existe, crearlo
- si ya existen datos en el período actual, definir un comportamiento explícito

#### Regla recomendada para v1 de esta acción
- permitir copiar solo si el período actual todavía no tiene ítems
- si ya tiene ítems, mostrar error o pedir limpieza explícita más adelante

---

## 8. Criterios de aceptación

### Período
- el usuario puede seleccionar año y mes
- el presupuesto mostrado corresponde al período seleccionado

### Edición
- el usuario puede ingresar montos por categoría
- los totales se recalculan correctamente en pantalla
- al guardar, la información persiste correctamente

### Persistencia
- si el período no existe, se crea
- si ya existe, se actualiza
- no se duplican ítems para la misma categoría y período

### Copia del mes anterior
- si existe presupuesto anterior, puede copiarse
- los valores copiados quedan visibles y guardables
- si no existe presupuesto anterior, el sistema informa claramente que no hay datos disponibles

### UX
- el usuario entiende qué período está editando
- los estados vacíos son claros
- el guardado muestra feedback visible
- los errores de validación son entendibles

---

## 9. Orden técnico recomendado

### Etapa 1
- crear tablas y constraints necesarias para `budget_periods` y `budget_items`
- definir acceso por workspace

### Etapa 2
- implementar queries del período seleccionado
- resolver carga de categorías activas

### Etapa 3
- construir UI de edición de presupuesto
- cálculo local de subtotales y total

### Etapa 4
- implementar guardado
- creación del período si no existe
- upsert de ítems

### Etapa 5
- implementar acción de copiar mes anterior
- validar estados límite

---

## 10. Riesgos a evitar

- mezclar presupuesto con transacciones reales
- incluir categorías inactivas sin criterio explícito
- permitir duplicados de `budget_items`
- esconder qué mes/año se está editando
- complicar demasiado la pantalla con lógica futura que todavía no corresponde

---

## 11. Definición de terminado

Este MVP se considera terminado cuando un usuario autenticado puede seleccionar un período, cargar o editar montos presupuestados por categoría, ver subtotales y total general, guardar correctamente el presupuesto del período y copiar el presupuesto del mes anterior cuando corresponda.

---

## 12. Próximo paso después del MVP 2

Una vez completado este MVP, el siguiente incremento recomendado es:

**MVP 3 — Registro de transacciones**

- alta de ingresos, gastos y ahorro
- uso de categorías
- fecha y fecha efectiva
- medio de pago
- descripción
- listado y edición básica