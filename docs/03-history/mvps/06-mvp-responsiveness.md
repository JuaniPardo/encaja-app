

# Encaja App — MVP 6

## MVP 6 — Corrección responsive del dashboard

---

## Objetivo

Corregir los problemas de responsividad del dashboard de Encaja para que la experiencia sea consistente y útil en desktop, tablet y mobile.

Este MVP no agrega nueva lógica financiera ni nuevos módulos. Su foco es adaptar correctamente la presentación ya construida para cada breakpoint, evitando que mobile se sienta como una versión apilada de desktop y que tablet muestre cards sobredimensionadas.

---

## Resultado esperado

El usuario debe poder:

- usar el dashboard cómodamente en celular, tablet y desktop
- identificar la información principal sin exceso de scroll innecesario
- leer tablas y métricas sin saturación visual
- ver gráficos integrados y proporcionados al tamaño de pantalla
- percibir una interfaz realmente pensada para cada dispositivo

---

## Alcance

### Incluye

#### 1. Breakpoints claros
- Definir comportamiento específico para desktop
- Definir comportamiento específico para tablet
- Definir comportamiento específico para mobile

#### 2. Header y bloque superior
- Reducir altura y densidad del bloque superior en mobile
- Reordenar KPIs para que no generen scroll excesivo
- Ajustar controles de año y mes para pantallas chicas

#### 3. Tabla principal
- Mantener tabla completa en desktop
- Ajustar tabla para tablet
- Simplificar tabla en mobile
- Dar más aire a la columna `% Compl.` en mobile

#### 4. Gráficos y panel lateral
- Reducir altura de cards de distribución en tablet y mobile
- Compactar donuts, leyendas y padding interno
- Evitar espacios muertos en cards con poco contenido

#### 5. Sidebar y navegación
- Refinar comportamiento de sidebar colapsado en mobile
- Mantener legibilidad y claridad del estado activo
- Evitar que la navegación robe demasiado espacio útil en pantallas chicas

---

### NO incluye

- nuevos cálculos financieros
- nuevas entidades
- nuevos gráficos
- nuevos módulos
- alertas o automatizaciones
- rediseño total del sistema de navegación

---

## Reglas funcionales

### Mobile
La versión mobile debe priorizar lectura rápida y reducción de fricción.

Reglas:
- no debe conservar mecánicamente el layout de desktop
- debe reducir cantidad de columnas visibles en tabla
- debe compactar KPIs
- debe reducir altura de cards secundarias

### Tablet
La versión tablet debe preservar estructura general de desktop, pero corrigiendo exceso de altura y aire innecesario.

Reglas:
- mantener jerarquía general
- compactar cards laterales
- reducir alturas mínimas innecesarias
- mejorar densidad del grid de KPIs

### Desktop
La versión desktop mantiene el layout actual como referencia principal, con ajustes menores si fueran necesarios.

---

## Propuesta por breakpoint

### Desktop
- Mantener tabla completa
- Mantener panel lateral con gráficos
- Mantener grid superior amplio

### Tablet
- Grid de KPIs en 2 columnas
- Cards de gráficos más bajas
- Menor padding vertical
- Mejor compactación del panel de distribución

### Mobile
- Header más compacto
- KPI grid en 2 columnas o 1 columna según ancho real
- Controles de período más chicos
- Tabla simplificada
- Gráficos más compactos
- Módulos ordenados según prioridad de lectura

---

## Tabla mobile

La tabla en mobile no debe intentar mostrar exactamente la misma densidad que desktop.

### Opción recomendada
Mostrar solo:
- Categoría
- Real
- Presup.
- % Compl.
- Desvío

Y ocultar columnas secundarias o combinarlas si hiciera falta.

### Regla
La barra de progreso de `% Compl.` debe seguir visible, pero más compacta.

---

## Jerarquía de lectura por dispositivo

### Desktop
1. KPIs
2. Tabla
3. Gráficos
4. Señales secundarias

### Tablet
1. KPIs
2. Tabla
3. Gráficos compactos
4. Señales secundarias

### Mobile
1. Período
2. Estado general
3. KPIs
4. Tabla principal
5. Gráficos
6. Problemas detectados

---

## Criterios de aceptación

### Mobile
- el usuario no necesita hacer scroll excesivo antes de llegar a la tabla
- las cards superiores no se sienten sobredimensionadas
- la tabla se puede leer sin sensación de saturación
- los gráficos no ocupan más espacio del necesario

### Tablet
- las cards laterales no quedan demasiado altas
- el dashboard mantiene buena proporción visual
- el grid superior se siente equilibrado

### Desktop
- el dashboard mantiene su nivel actual o mejora levemente
- no se rompe la jerarquía lograda en MVP 5

### UX general
- cada breakpoint se siente intencional
- no parece un simple apilado automático
- mejora la comprensión y reduce fricción cognitiva

---

## Orden de implementación

### 1
- Definir breakpoints del dashboard
- Revisar grid general y contenedores

### 2
- Ajustar bloque superior (header, filtros, KPIs)

### 3
- Implementar versión simplificada o adaptada de tabla para mobile

### 4
- Compactar cards de gráficos y panel lateral

### 5
- Ajustar sidebar y navegación en pantallas chicas

### 6
- Pulido final por dispositivo

---

## Definición de terminado

El MVP está completo cuando el dashboard se adapta correctamente a desktop, tablet y mobile, manteniendo la jerarquía visual lograda en MVP 5 pero con una experiencia realmente optimizada por breakpoint.

---

## Próximo paso

**MVP 7 — Pulido visual final y microinteracciones**

- transiciones sutiles
- mejores estados vacíos
- refinamiento de feedback visual
- consistencia final de spacing, borders y ritmo UI