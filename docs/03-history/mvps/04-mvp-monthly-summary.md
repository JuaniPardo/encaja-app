

# Encaja App — MVP 4 Definition

## Fecha
2026-04-10

## Estado
Draft

## Autor
Juan Pardo

---

## 1. Nombre del MVP

**MVP 4 — Resumen mensual (Real vs Presupuesto)**

---

## 2. Objetivo

Construir el primer módulo de análisis financiero de Encaja, integrando los datos de presupuesto (MVP 2) y transacciones reales (MVP 3), permitiendo visualizar el desempeño financiero por período.

Este MVP debe transformar la app en una herramienta de control y toma de decisiones.

---

## 3. Resultado esperado

Al finalizar este MVP, un usuario debe poder:

- seleccionar un período (año/mes)
- ver ingresos reales vs presupuestados
- ver gastos reales vs presupuestados
- ver ahorro real vs presupuestado
- visualizar desvíos por categoría
- ver porcentaje de ejecución por categoría
- entender rápidamente si está dentro o fuera de presupuesto

---

## 4. Alcance

### 4.1 Incluye

#### Consolidación por período
- cálculo de totales reales por tipo (`income`, `expense`, `saving`)
- lectura de totales presupuestados
- cálculo de balance real
- cálculo de balance presupuestado

#### Comparación
- real vs presupuesto por categoría
- cálculo de desvío
- cálculo de porcentaje de ejecución

#### Visualización
- tabla resumen por categoría
- agrupación por tipo
- indicadores claros de desvío (positivo/negativo)

---

### 4.2 No incluye

Este MVP no debe incluir:

- gráficos avanzados
- dashboards complejos multi-período
- predicciones
- alertas automáticas
- exportación de datos
- drill-down profundo por día

---

## 5. Pantallas incluidas

### 5.1 Resumen mensual

Debe permitir:

- seleccionar año
- seleccionar mes
- ver bloques por tipo:
  - ingresos
  - gastos
  - ahorro

Para cada bloque:
- total presupuestado
- total real
- desvío

### 5.2 Tabla por categoría

Columnas mínimas:

- categoría
- presupuesto
- real
- desvío
- % ejecución

Agrupada por tipo.

### 5.3 Indicadores clave

- balance real
- balance presupuestado
- diferencia entre ambos

---

## 6. Entidades involucradas

Este MVP utiliza:

- budget_periods
- budget_items
- transactions
- categories

Y depende de:

- reglas de imputación (effective_date vs transaction_date)

---

## 7. Reglas funcionales del MVP

### 7.1 Fecha de imputación

Para cada transacción:

- si existe `effective_date`, usar esa
- si no, usar `transaction_date`

---

### 7.2 Agrupación

Los cálculos deben agruparse por:

- período (año/mes)
- categoría
- tipo

---

### 7.3 Totales reales

Para cada categoría:

- sumar transacciones del período

---

### 7.4 Totales presupuestados

- tomar desde `budget_items`

---

### 7.5 Desvío

```text
desvío = real - presupuesto
```

---

### 7.6 % ejecución

```text
% = real / presupuesto
```

Regla:

- si presupuesto = 0 → no calcular porcentaje

---

### 7.7 Balance

```text
balance = ingresos - gastos - ahorro
```

Debe calcularse para:

- presupuesto
- real

---

## 8. Criterios de aceptación

### Cálculo

- los totales coinciden con las transacciones cargadas
- los valores coinciden con el presupuesto definido
- los desvíos son correctos

### UX

- el usuario entiende rápidamente su situación financiera
- los valores negativos/positivos son claros
- no hay ambigüedad en qué período se está viendo

### Integración

- el módulo funciona con datos reales de MVP 2 y MVP 3
- no rompe la performance

---

## 9. Orden técnico recomendado

### Etapa 1
- query de transacciones por período (con effective_date)

### Etapa 2
- agregación por categoría

### Etapa 3
- unión con presupuesto

### Etapa 4
- cálculo de métricas (desvío, %)

### Etapa 5
- UI de tabla + resumen

---

## 10. Riesgos a evitar

- calcular mal la fecha de imputación
- mezclar datos de distintos workspaces
- duplicar lógica en frontend y backend
- hacer queries ineficientes

---

## 11. Definición de terminado

Este MVP se considera terminado cuando un usuario puede seleccionar un período y ver claramente su desempeño financiero real vs presupuestado, con totales, desvíos y porcentajes correctos.

---

## 12. Próximo paso después del MVP 4

**MVP 5 — Dashboard y visualización avanzada**

- gráficos
- tendencias
- insights