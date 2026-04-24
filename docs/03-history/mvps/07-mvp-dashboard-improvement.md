

# Encaja App — MVP 7

## MVP 7 — Mejora semántica y operativa del dashboard

---

## Objetivo

Refinar exclusivamente el dashboard de Encaja para que no solo muestre datos, sino que interprete correctamente el sentido de cada desvío y priorice mejor la atención del usuario.

Este MVP se concentra solo en mejoras semánticas, visuales y operativas del dashboard. No incluye ajustes de otras pantallas. Cualquier mejora pendiente en Presupuesto, Transacciones, Categorías, Medios de pago o Settings debe quedar segregada en MVPs posteriores.

---

## Problema a corregir

Actualmente el dashboard trata de forma demasiado uniforme los desvíos de presupuesto. Eso genera un problema conceptual importante:

- un ingreso mayor al presupuestado no debe tratarse como alerta
- un gasto mayor al presupuestado sí debe tratarse como alerta
- un ahorro por debajo del objetivo puede ser señal de atención
- un ahorro por encima del objetivo es una señal positiva

Dicho de otro modo: el dashboard necesita distinguir entre **problemas**, **estados neutros** y **buen desempeño**.

---

## Resultado esperado

Al finalizar este MVP, un usuario debe poder:

- distinguir claramente qué situaciones requieren atención
- ver separadas las señales negativas de las positivas
- entender que un ingreso superior al esperado es algo favorable, no un problema
- identificar rápidamente dónde está el verdadero desvío operativo del período
- confiar más en la lectura semántica del dashboard

---

## Alcance

### Incluye

#### 1. Corrección semántica de señales
- redefinir la lógica de alertas del dashboard
- separar visualmente problemas de resultados positivos
- evitar clasificar ingresos por encima de presupuesto como alertas

#### 2. Estado operativo superior
- mejorar el bloque de estado operativo del dashboard
- permitir mostrar problemas detectados y destacados positivos como conceptos distintos
- mejorar el texto y la jerarquía de esa zona

#### 3. Bloque de problemas detectados
- mostrar solo verdaderos problemas operativos
- priorizar gastos excedidos y otros desvíos realmente críticos
- eliminar falsos positivos semánticos

#### 4. Bloque de buen desempeño o destacados positivos
- incorporar un bloque o sub-bloque de señales positivas
- destacar ingresos por encima del presupuesto
- destacar ahorro superior al objetivo cuando aplique

#### 5. Consistencia visual del dashboard
- alinear colores, textos y badges con la semántica corregida
- mantener coherencia entre tablas, KPIs y bloques de resumen

---

### NO incluye

Este MVP no debe incluir:

- rediseño responsive general de otras pantallas
- mejoras de mobile para Presupuesto
- mejoras de mobile para Transacciones
- refactors de Categorías
- refactors de Medios de pago
- cambios estructurales en Settings
- nuevas entidades de base de datos
- automatizaciones o alertas inteligentes avanzadas

Todo cambio fuera del dashboard debe quedar reservado para otros MVPs.

---

## Reglas funcionales

### 1. Ingresos
- `real > presupuesto` → señal positiva
- `real = presupuesto` → estado correcto / neutro
- `real < presupuesto` → señal de atención

### 2. Gastos
- `real > presupuesto` → alerta
- `real = presupuesto` → estado límite / controlado
- `real < presupuesto` → estado favorable

### 3. Ahorro
- `real > presupuesto` → señal positiva
- `real = presupuesto` → estado correcto
- `real < presupuesto` → señal de atención

### 4. Balance
El balance puede mostrarse como métrica general, pero no debe mezclarse automáticamente con la lógica de alertas por categoría sin una regla explícita.

### 5. Estado operativo
El dashboard no debe mostrar un único contador ambiguo del tipo:

- “2 categorías en alerta”

si dentro de ese conteo hay una mezcla de problemas y resultados positivos.

Debe separar al menos:

- problemas detectados
- destacados positivos

---

## Propuesta de bloques del dashboard

### 1. Estado operativo superior
Debe evolucionar desde un mensaje ambiguo a una lectura más útil, por ejemplo:

- `1 categoría en alerta`
- `1 categoría destacada`

O una formulación equivalente que distinga claramente ambos grupos.

### 2. Problemas detectados
Debe listar exclusivamente elementos como:

- gastos por encima de presupuesto
- ahorro por debajo del objetivo (si se decide mostrarlo ya)
- ingresos por debajo de lo esperado (si se decide elevarlos como atención)

### 3. Buen desempeño
Debe listar exclusivamente elementos como:

- ingresos por encima del presupuesto
- ahorro por encima del objetivo
- gastos significativamente por debajo del presupuesto si se considera útil destacarlo

---

## Criterios de aceptación

### Semántica
- un ingreso superior al esperado no aparece como alerta
- un gasto superior al presupuesto sí aparece como alerta
- el dashboard distingue correctamente entre negativo, neutro y positivo

### UX
- el usuario entiende mejor qué está mal y qué está bien
- disminuye la ambigüedad del estado operativo
- el dashboard transmite mayor confianza conceptual

### Visual
- colores y etiquetas reflejan correctamente la semántica definida
- los bloques de “problemas” y “buen desempeño” se diferencian con claridad

### Alcance
- los cambios quedan limitados al dashboard
- no se mezclan refactors de otras pantallas dentro de este MVP

---

## Orden de implementación

### 1
- redefinir reglas semánticas por tipo (`income`, `expense`, `saving`)

### 2
- ajustar la lógica que construye el bloque de estado operativo

### 3
- separar “problemas detectados” de “destacados positivos” en el dashboard

### 4
- revisar colores, textos y badges asociados

### 5
- pulir microcopy y jerarquía visual del dashboard

---

## Definición de terminado

El MVP está completo cuando el dashboard deja de tratar todos los desvíos como si fueran equivalentes, separa correctamente señales negativas de positivas y comunica mejor qué situaciones requieren acción y cuáles representan buen desempeño, sin tocar otras pantallas del sistema.

---

## Próximos pasos sugeridos

Los ajustes pendientes en otras pantallas deben vivir en MVPs separados, por ejemplo:

- mejoras responsive de Presupuesto
- mejoras responsive de Transacciones
- refinamiento mobile de Categorías
- mejoras visuales generales de tablas fuera del dashboard