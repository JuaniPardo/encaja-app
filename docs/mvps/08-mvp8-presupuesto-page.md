# Encaja App — MVP 8

## MVP 8 — Revisión y mejora de la página de Presupuesto

---

## Objetivo

Refinar la página de Presupuesto de Encaja para que la experiencia de edición mensual sea más clara, más jerárquica y más usable en desktop, tablet y mobile.

Este MVP se enfoca exclusivamente en la pantalla de Presupuesto. No incluye cambios del dashboard ni refactors generales de otras pantallas.

---

## Problema a resolver

Actualmente la página de Presupuesto cumple su función, pero todavía tiene margen importante de mejora en estos puntos:

- la jerarquía visual no siempre deja claro qué es contexto, qué es edición y qué es resultado
- los controles de período pueden ocupar más espacio del necesario
- los inputs monetarios pueden resultar pesados o poco escaneables
- el bloque de resumen final todavía no domina la lectura como debería
- en mobile la experiencia puede volverse demasiado larga y densa

La meta de este MVP es transformar la pantalla en una herramienta de edición presupuestaria más clara y más cómoda de usar.

---

## Resultado esperado

Al finalizar este MVP, un usuario debe poder:

- entender rápidamente qué período está editando
- editar montos por categoría con menos fricción visual
- diferenciar claramente la zona editable de la zona de resultados
- leer mejor subtotales, total asignado y balance
- usar la pantalla de manera más cómoda en mobile
- identificar fácilmente la acción principal de guardado

---

## Alcance

### Incluye

#### 1. Encabezado y período
- revisar jerarquía del encabezado de la pantalla
- compactar la selección de año y mes
- hacer más claro el contexto del período en edición
- mejorar la acción de “Copiar mes anterior” si sigue estando dentro del alcance visual principal

#### 2. Secciones de categorías
- revisar presentación de bloques de Ingresos, Gastos y Ahorro
- mejorar legibilidad de categorías e inputs
- ajustar anchos, alineaciones y densidad visual
- mejorar el escaneo de montos cargados

#### 3. Inputs monetarios
- revisar tamaño visual de inputs
- mejorar consistencia de alineación numérica
- reducir sensación de “formulario pesado”
- priorizar una edición clara y rápida

#### 4. Resumen y balance
- dar mayor jerarquía al bloque de resumen final
- destacar subtotales por tipo
- destacar total asignado
- destacar balance final
- mejorar el tratamiento visual de advertencias de sobreasignación

#### 5. Acciones
- reforzar visualmente la acción principal (`Guardar presupuesto`)
- bajar el protagonismo de acciones secundarias como `Revertir`
- mejorar ubicación y claridad de CTAs

#### 6. Responsive
- revisar la experiencia completa en mobile
- revisar comportamiento en tablet
- evitar scroll excesivo innecesario
- evitar tablas o inputs que se sientan “desktop comprimido”

---

### NO incluye

Este MVP no debe incluir:

- cambios de lógica financiera
- nuevos cálculos de presupuesto
- cambios del dashboard
- cambios de transacciones
- cambios de categorías fuera del contexto de edición presupuestaria
- nuevas entidades o cambios de base de datos
- automatizaciones nuevas

---

## Reglas funcionales

### 1. Período
- la pantalla debe dejar siempre claro qué año y mes se están editando
- cambiar el período no debe resultar ambiguo

### 2. Edición de montos
- la edición debe seguir siendo directa por categoría
- los montos deben mantenerse fáciles de leer y de modificar
- la interfaz no debe sacrificar claridad por densidad extrema

### 3. Separación conceptual
La pantalla debe diferenciar claramente:
- contexto del período
- edición del presupuesto
- resultado consolidado

### 4. Resumen final
El bloque de resumen no debe sentirse como un bloque más. Debe percibirse como el resultado principal de la edición actual.

### 5. Mobile
En mobile no debe intentarse conservar mecánicamente el layout de desktop si eso empeora la lectura.

---

## Propuesta de revisión por bloques

### 1. Encabezado
Debe responder rápidamente:
- qué pantalla es
- qué período se está editando
- qué acción contextual importante existe

### 2. Bloques de Ingresos / Gastos / Ahorro
Deben sentirse como zonas de trabajo claras, con:
- buena separación
- títulos visibles
- inputs fáciles de escanear

### 3. Resumen inferior
Debe ganar protagonismo y responder rápidamente:
- cuánto ingreso hay
- cuánto gasto hay
- cuánto ahorro hay
- cuánto se asignó
- cuál es el balance final

### 4. CTA principal
`Guardar presupuesto` debe verse inequívocamente como la acción principal de la pantalla.

---

## Criterios de aceptación

### Jerarquía
- el usuario entiende más rápido la pantalla
- queda más clara la diferencia entre edición y resultado

### Inputs
- los campos monetarios se sienten más prolijos y usables
- los números se leen mejor

### Resumen
- el bloque final tiene mayor protagonismo
- el balance se identifica con facilidad
- la advertencia de sobreasignación se entiende rápidamente

### Responsive
- mobile se siente más usable y menos pesado
- tablet mantiene buena proporción
- desktop conserva claridad y orden

### Acciones
- guardar es claramente la acción principal
- las acciones secundarias no compiten visualmente

---

## Orden de implementación

### 1
- revisar encabezado y selector de período

### 2
- revisar layout de bloques de categorías

### 3
- refinar inputs monetarios y alineaciones

### 4
- rediseñar jerarquía del resumen final

### 5
- ajustar CTAs

### 6
- pulir responsive en mobile y tablet

---

## Definición de terminado

El MVP está completo cuando la página de Presupuesto permite editar montos mensuales de forma más clara, más cómoda y más jerárquica, con un resumen final mejor resuelto y una experiencia sólida en mobile, tablet y desktop, sin tocar la lógica del sistema.

---

## Próximos pasos sugeridos

Después de este MVP, los siguientes incrementos posibles podrían ser:

- refinamiento responsive de Transacciones
- refinamiento mobile de Categorías
- revisión visual de Medios de pago
- mejoras de interacción y drill-down entre pantallas
