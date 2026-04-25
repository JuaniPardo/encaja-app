# TASK-2026-04-004 — Dashboard UI Improvement

## Tipo
UX/UI Improvement

---

## Objetivo
Mejorar la claridad del dashboard eliminando ruido en el bloque de medios de pago y optimizando el orden de las tablas de categorías para facilitar lectura y análisis.

---

## Problema

### 1. Medios de pago (Efectivo / Débito)
Actualmente cada cuenta muestra:
- Balance total (correcto)
- Indicador de movimientos del mes (ruido)

Esto genera:
- Distracción visual
- Redundancia (la info mensual ya está en tablas inferiores)
- Pérdida de foco en lo importante: cuánto dinero hay disponible ahora

### 2. Tablas de categorías (Gastos / Ingresos / Ahorro)
- Filas con `N/A` mezcladas con datos reales
- Orden sin criterio claro
- Difícil escaneo visual

---

## Alcance

### 1. Limpieza en card de Medios de pago

**ANTES**
- Balance total (principal)
- “Este mes: +X / -X” (secundario)

**DESPUÉS**
- Mostrar únicamente:
  - Nombre del medio de pago
  - Balance actual (destacado)

❌ Eliminar completamente:
- Indicador de movimientos del mes en este bloque

💡 Nota:
La información mensual ya está correctamente representada en:
- Tablas de categorías
- Balance del período

---

### 2. Ordenamiento de tablas de categorías

Aplicar a:
- Ingresos
- Gastos
- Ahorro

#### Reglas de orden

1. Filas con datos válidos primero
   - `% compl.` numérico
   - valores reales distintos de 0

2. Filas con `N/A` al final

3. Dentro de datos válidos
   - Ordenar por `Real` de mayor a menor

---

### 3. Reubicación y escalado de gráficos (Distribución real por tipo)

#### Problema
- En desktop y tablet los gráficos aparecen demasiado abajo (pierden relevancia)
- Tamaño del gráfico pequeño respecto de su leyenda
- No cumplen su función principal: lectura rápida del estado del mes

#### Objetivo
- Darle a los gráficos jerarquía de “resumen visual inmediato”
- Mejorar proporción visual entre gráfico y leyenda
- Unificar comportamiento entre mobile, tablet y desktop

#### Cambios requeridos

**Posición**
- Mover el bloque de gráficos por encima de "Medios financieros"
- Debe ubicarse inmediatamente después de:
  - KPIs (Ingresos / Gastos / Ahorro)

**Estructura del bloque**
- Agrupar los 3 gráficos dentro de un mismo card
- Agregar título del bloque:
  - `Movimientos del mes`

**Layout (desktop / tablet)**
- Mantener disposición horizontal de los 3 gráficos
- Aumentar tamaño del gráfico (donut)
- Reducir gap innecesario entre gráfico y leyenda
- Priorizar proporción visual:
  - Gráfico debe pesar visualmente igual o más que la leyenda

**Layout (mobile)**
- Mantener comportamiento actual (ya es correcto)
- Solo heredar título del bloque

#### Criterios de aceptación

- [ ] El bloque de gráficos aparece por encima de "Medios financieros"
- [ ] El card tiene el título "Movimientos del mes"
- [ ] En desktop/tablet el gráfico tiene mayor presencia visual
- [ ] La leyenda no domina el layout
- [ ] No se rompe el layout en mobile

#### Notas técnicas

- Ajuste puramente visual (sin cambios en datos)
- Revisar props de tamaño en componentes de chart
- Evaluar uso de `flex` o `grid` para mejor distribución
- Evitar hardcode de tamaños fijos (usar responsive scaling)

---

## Ejemplo esperado (Gastos)

ANTES:
Alimentos      432k
Regalos        N/A
Servicios      182k
Viajes         N/A
Suscripciones  449k

DESPUÉS:
Suscripciones  449k
Alimentos      432k
Servicios      182k
...
---
Regalos        N/A
Viajes         N/A

---

## Criterios de aceptación

### Medios de pago
- No se muestra más el indicador “este mes” en cuentas de efectivo/débito
- Solo se visualiza el balance actual
- No se rompe consistencia visual con tarjetas de crédito

### Tablas
- Filas con valores reales aparecen primero
- Filas con `N/A` aparecen al final
- Dentro de valores reales, orden descendente por monto
- La fila TOTAL permanece al final

---

## Notas técnicas

- Sorting a nivel de presentación (no persistencia)
- Detectar `N/A` como:
  - null
  - undefined
  - o flag del dominio
- Excluir la fila TOTAL del ordenamiento

---

## Impacto esperado

- Mejora en legibilidad
- Menor carga cognitiva
- Mejor foco en decisiones financieras
- Dashboard más limpio y profesional