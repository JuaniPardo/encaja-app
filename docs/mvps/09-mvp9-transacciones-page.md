

# Encaja App — MVP 9

## MVP 9 — Revisión y mejora de la página de Transacciones

---

## Objetivo

Refinar la página de Transacciones de Encaja para que la carga, lectura y gestión de movimientos reales sea más rápida, más clara y más útil en el uso diario.

Este MVP se enfoca exclusivamente en la pantalla de Transacciones. No incluye cambios del dashboard, de la página de Presupuesto ni refactors generales de otras pantallas.

---

## Problema a resolver

Actualmente la página de Transacciones cumple una función básica, pero todavía tiene limitaciones importantes:

- el listado muestra poca información útil por fila
- falta jerarquía visual entre fecha, categoría, monto y tipo
- el listado consume mucho espacio vertical sin aprovechar bien la pantalla
- los filtros son todavía limitados
- la creación de transacciones puede volverse más rápida y más natural
- la experiencia general todavía se siente más cercana a una tabla básica que a una herramienta operativa diaria

La meta de este MVP es convertir la pantalla en una verdadera vista operativa de movimientos.

---

## Resultado esperado

Al finalizar este MVP, un usuario debe poder:

- leer rápidamente sus movimientos del período
- identificar monto, categoría y tipo sin esfuerzo
- filtrar mejor la información
- crear una transacción nueva de forma más ágil
- editar o eliminar movimientos existentes con facilidad
- sentir que la pantalla de Transacciones es una herramienta de trabajo diaria y no solo un listado básico

---

## Alcance

### Incluye

#### 1. Listado de transacciones
- rediseñar la jerarquía visual del listado
- mostrar más contexto útil por fila
- dar protagonismo al monto
- mostrar categoría y descripción si existen
- mantener el tipo como badge o chip claro

#### 2. Densidad visual
- reducir altura innecesaria de filas
- aumentar cantidad de movimientos visibles por pantalla
- mejorar la relación entre legibilidad y compacidad

#### 3. Filtros
- mantener filtros de año, mes y tipo
- agregar filtro por categoría
- agregar búsqueda simple por texto cuando sea razonable

#### 4. Modal de nueva transacción
- revisar jerarquía y velocidad de uso del formulario
- mejorar el selector de tipo
- mejorar el input de monto
- mantener clara la relación entre tipo y categoría

#### 5. Acciones por fila
- permitir editar una transacción existente
- permitir eliminar una transacción
- dejar claras las acciones disponibles sin sobrecargar visualmente

#### 6. Responsive
- revisar la experiencia en mobile
- revisar comportamiento en tablet
- evitar que el listado se sienta como una tabla vacía o demasiado aireada
- evitar que el modal se sienta lento o torpe en pantalla chica

---

### NO incluye

Este MVP no debe incluir:

- cambios del dashboard
- cambios de presupuesto
- nuevas reglas financieras
- nuevas entidades de base de datos
- automatizaciones complejas
- conciliación bancaria
- importación masiva de movimientos
- métricas avanzadas dentro de la pantalla de transacciones

---

## Reglas funcionales

### 1. Jerarquía de fila
Cada transacción debe mostrar al menos:
- fecha
- categoría
- monto
- tipo

Y, cuando exista:
- descripción

La jerarquía debe priorizar el monto y la categoría por encima de la fecha.

### 2. Monto
- debe verse claramente
- debe usar separador de miles
- debe ser consistente con el formato ya definido en Presupuesto
- debe tener más peso visual que el resto de los campos de la fila

### 3. Tipo
- debe seguir siendo fácilmente distinguible mediante color o badge
- no debe competir con el monto como dato principal

### 4. Filtros
- deben ayudar a encontrar rápido movimientos relevantes
- no deben convertirse en una barra compleja o sobrecargada

### 5. Modal de creación
La creación debe ser rápida. El formulario debe priorizar:
- tipo
- categoría
- monto
- fecha

Los campos opcionales deben seguir presentes, pero con menor peso visual.

### 6. Categoría dependiente del tipo
La categoría mostrada en el formulario debe respetar el tipo de movimiento elegido.

### 7. Mobile
En mobile no debe intentarse conservar mecánicamente una tabla tradicional si eso empeora la lectura.

---

## Propuesta de revisión por bloques

### 1. Encabezado y filtros
Debe responder rápidamente:
- qué pantalla es
- qué período se está viendo
- qué filtros están activos
- cómo crear un movimiento nuevo

### 2. Listado principal
Debe sentirse como una lista operativa, no como una tabla fría.

Propuesta de estructura por fila:
- categoría
- descripción secundaria (si existe)
- fecha
- monto destacado
- badge de tipo

### 3. Modal de nueva transacción
Debe sentirse rápido de usar.

Mejoras sugeridas:
- tipo como toggle o segmented control, en lugar de select tradicional, si mejora velocidad
- foco inicial en el monto o en el primer campo realmente crítico
- formato monetario consistente
- mejor jerarquía entre obligatorios y opcionales

### 4. Acciones por fila
Deben existir sin agregar ruido visual innecesario.

---

## Criterios de aceptación

### Listado
- cada movimiento se entiende más rápido que antes
- monto, categoría y tipo se identifican con facilidad
- hay más densidad útil por pantalla

### Filtros
- el usuario puede refinar mejor lo que ve
- la UI de filtros no se siente pesada

### Modal
- crear una transacción es más rápido
- el formulario es más claro
- el monto se ingresa con mejor experiencia

### Responsive
- mobile se siente más usable
- tablet mantiene buen equilibrio
- desktop conserva claridad y orden

### Acciones
- editar y eliminar son claros y accesibles
- no se sobrecarga visualmente la fila

---

## Orden de implementación

### 1
- revisar jerarquía del encabezado y filtros

### 2
- rediseñar el layout de cada fila del listado

### 3
- mejorar la densidad del listado

### 4
- mejorar el modal de nueva transacción

### 5
- agregar acciones por fila

### 6
- pulir responsive en mobile y tablet

---

## Definición de terminado

El MVP está completo cuando la página de Transacciones permite leer, crear, editar y gestionar movimientos con una experiencia más rápida, más clara y más operativa, manteniendo una buena usabilidad en mobile, tablet y desktop, sin tocar otras pantallas del sistema.

---

## Próximos pasos sugeridos

Después de este MVP, los siguientes incrementos posibles podrían ser:

- drill-down desde dashboard a transacciones filtradas
- mejoras de interacción entre presupuesto y ejecución
- refinamiento mobile de Categorías
- revisión visual de Medios de pago