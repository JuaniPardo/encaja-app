

# Encaja App — MVP 10

## MVP 10 — Revisión y mejora de la página de Categorías

---

## Objetivo

Refinar la página de Categorías de Encaja para alinearla con el nivel visual, funcional y operativo ya alcanzado en Dashboard, Presupuesto y Transacciones.

Este MVP se enfoca exclusivamente en la pantalla de Categorías. No incluye cambios del dashboard, de Presupuesto, de Transacciones ni refactors generales de otras pantallas.

---

## Problema a resolver

Actualmente la página de Categorías se siente más cercana a una tabla administrativa clásica que a una pantalla moderna y coherente con el resto del producto.

Los principales problemas observados son:

- exceso de estructura tabular rígida
- columnas que aportan poco valor real en esta etapa
- acciones poco claras o visualmente pobres
- demasiada distancia entre esta pantalla y el lenguaje visual ya logrado en Transacciones
- poca jerarquía entre nombre, tipo, estado y uso real de la categoría

La meta de este MVP es transformar esta pantalla en una vista más operativa, más clara y más consistente con el resto de Encaja.

---

## Resultado esperado

Al finalizar este MVP, un usuario debe poder:

- leer rápidamente sus categorías
- distinguir con facilidad categorías de gasto, ingreso y ahorro
- identificar si una categoría está activa o inactiva
- entender mejor qué acciones puede realizar sobre cada categoría
- percibir una pantalla moderna, compacta y alineada con el resto del sistema

---

## Alcance

### Incluye

#### 1. Rediseño del listado
- reemplazar la sensación de tabla administrativa por una lista más operativa
- reducir rigidez visual
- mejorar jerarquía entre nombre, tipo, estado y acciones

#### 2. Agrupación por tipo
- agrupar categorías por:
  - gastos
  - ingresos
  - ahorro
- mejorar lectura general del catálogo

#### 3. Acciones por categoría
- revisar cómo se presentan las acciones disponibles
- evitar botones repetitivos o truncados
- priorizar una interacción más limpia y clara

#### 4. Limpieza de columnas innecesarias
- eliminar o relegar elementos que no aportan valor real en esta etapa
- especialmente revisar la permanencia de `Orden` si no tiene uso operativo real hoy

#### 5. Consistencia visual
- alinear esta pantalla con el lenguaje visual de Transacciones y Presupuesto
- reutilizar criterios de spacing, badges, densidad y jerarquía ya consolidados

#### 6. Responsive
- revisar desktop, tablet y mobile
- evitar que la pantalla se vea como una tabla comprimida
- mantener legibilidad sin perder densidad útil

---

### NO incluye

Este MVP no debe incluir:

- cambios del dashboard
- cambios de presupuesto
- cambios de transacciones
- nuevas reglas de negocio sobre categorías
- nuevas entidades o cambios de base de datos
- drag & drop de ordenamiento avanzado
- automatizaciones nuevas

---

## Reglas funcionales

### 1. Nombre de categoría
- debe seguir siendo el dato principal de cada fila o card
- debe tener mayor jerarquía visual que el resto de la información

### 2. Tipo
- debe seguir mostrándose con un badge o tratamiento visual claro
- debe distinguir inmediatamente entre gasto, ingreso y ahorro

### 3. Estado
- debe ser visible, pero no competir con el nombre de la categoría
- puede resolverse con un chip pequeño o texto visualmente secundario

### 4. Acciones
- deben existir sin generar ruido visual innecesario
- deben ser más limpias que la combinación actual de botones repetitivos
- si conviene, usar menú contextual o patrón equivalente

### 5. Orden
- si no tiene impacto funcional real inmediato, no debe ocupar espacio protagonista
- puede eliminarse de la vista principal en esta etapa

### 6. Agrupación
- la agrupación por tipo debe mejorar escaneo, no complicarlo
- debe quedar clara visualmente la separación entre grupos

### 7. Mobile
- no intentar conservar una tabla rígida si eso degrada la experiencia
- priorizar claridad, densidad razonable y acciones entendibles

---

## Propuesta de revisión por bloques

### 1. Encabezado y filtros
Debe responder rápidamente:
- qué pantalla es
- qué filtros están activos
- cómo crear una nueva categoría

### 2. Listado principal
Debe sentirse como una lista operativa, no como una grilla administrativa clásica.

Cada ítem debería priorizar:
- nombre
- tipo
- estado
- acción disponible

### 3. Agrupación
Propuesta:
- bloque de Gastos
- bloque de Ingresos
- bloque de Ahorro

### 4. Acciones
Mejoras sugeridas:
- reemplazar combinaciones largas de acciones por menú contextual o acciones más limpias
- evitar texto truncado como `Desa...`

---

## Criterios de aceptación

### Listado
- las categorías se entienden más rápido que antes
- la pantalla se siente menos administrativa y más integrada al producto
- el nombre de la categoría gana protagonismo

### Agrupación
- la separación entre gasto, ingreso y ahorro mejora la lectura
- no hay ambigüedad entre grupos

### Acciones
- editar / activar / desactivar se entienden claramente
- las acciones no ensucian la interfaz

### Visual
- la pantalla queda alineada con Transacciones y Presupuesto
- desaparece la sensación de tabla vieja o rígida

### Responsive
- mobile sigue siendo claro
- tablet y desktop aprovechan mejor el espacio
- la pantalla no depende de una tabla clásica comprimida

---

## Orden de implementación

### 1
- revisar encabezado, CTA y filtros

### 2
- redefinir estructura del listado

### 3
- eliminar o relegar columnas que no aportan valor

### 4
- incorporar agrupación por tipo

### 5
- mejorar presentación de acciones

### 6
- pulir responsive en mobile, tablet y desktop

---

## Definición de terminado

El MVP está completo cuando la página de Categorías deja de sentirse como una tabla administrativa rígida y pasa a comportarse como una lista moderna, clara y consistente con el resto de Encaja, manteniendo una buena experiencia en desktop, tablet y mobile.

---

## Próximos pasos sugeridos

Después de este MVP, los siguientes incrementos posibles podrían ser:

- drill-down desde categorías a transacciones relacionadas
- revisión visual de Medios de pago
- mayor consistencia transversal entre todas las pantallas
- refinamientos del design system general