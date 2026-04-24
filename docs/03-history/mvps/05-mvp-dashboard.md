

# Encaja App — MVP 5

## MVP 5 — Refinamiento visual y claridad operativa del dashboard

---

## Objetivo

Mejorar la calidad visual y la capacidad de lectura rápida del dashboard de Encaja, transformando la información ya construida en los MVP 1 a 4 en una experiencia más clara, jerárquica y accionable.

Este MVP NO agrega nueva lógica financiera. Su foco es la presentación y la comprensión inmediata.

---

## Resultado esperado

El usuario debe poder en segundos:

- Entender el período actual
- Ver su estado general (balance / ahorro)
- Detectar desvíos rápidamente
- Leer la tabla sin esfuerzo
- Percibir una UI más limpia y profesional

---

## Alcance

### Incluye

#### 1. Jerarquía visual superior
- Reducir peso del header verde “TABLERO”
- Mejor jerarquía entre cards KPI
- Compactar selector Año / Mes
- Separar visualmente “controles” vs “métricas”

#### 2. Mejora de tabla principal
- Reemplazar `% Compl.` textual por barra de progreso
- Mostrar porcentaje encima o dentro de la barra
- Colores semánticos
- Mejor destaque de fila TOTAL
- Ajuste de densidad de filas

#### 3. Layout
- Balancear tabla vs panel derecho
- Reducir espacios muertos
- Compactar cards con poco contenido

#### 4. Gráficos
- Mejor integración donut + leyenda
- Reducir altura innecesaria
- Evitar competir con la tabla

#### 5. Sidebar
- Mejor estado activo
- Mejor versión colapsada
- Ajuste de spacing y consistencia

---

### NO incluye

- Nuevos cálculos financieros
- Nuevas entidades
- Automatizaciones
- Alertas
- Nuevos módulos

---

## Reglas funcionales

### Columna `% Compl.`

Debe incluir:

- Barra de progreso
- Valor porcentual visible
- Color semántico

### Escala visual

- 0–79% → neutro / suave
- 80–100% → positivo
- >100% → alerta

### Valores >100%

- Barra se limita a 100%
- El valor real se muestra (ej: 138%)

---

## Jerarquía de lectura

1. Período
2. Estado general
3. Problemas
4. Distribución

---

## Criterios de aceptación

### Visual
- Header menos dominante
- KPIs más claros
- Filtros más compactos

### Tabla
- Mejor lectura que versión anterior
- Desvíos detectables sin pensar
- Total claramente diferenciado

### Layout
- Menos espacios muertos
- Mejor balance general

### Gráficos
- Más integrados
- Menos ruido visual

### Sidebar
- Más claro y consistente

### UX
- Se entiende en 3–5 segundos
- Se siente más profesional

---

## Orden de implementación

### 1
- Ajustar header + KPIs
- Compactar filtros

### 2
- Implementar ProgressCell
- Colores semánticos
- Ajustar tabla

### 3
- Rebalancear layout
- Compactar gráficos

### 4
- Refinar sidebar

### 5
- Pulido general (spacing, tipografía, bordes)

---

## Definición de terminado

El MVP está completo cuando:

- Mantiene toda la funcionalidad actual
- Mejora la lectura visual significativamente
- Reduce fricción cognitiva
- Se percibe como un producto más maduro

---

## Próximo paso

**MVP 6 — Alertas e insights**

- Alertas de sobre-ejecución
- Señales de categorías críticas
- Insights básicos del período