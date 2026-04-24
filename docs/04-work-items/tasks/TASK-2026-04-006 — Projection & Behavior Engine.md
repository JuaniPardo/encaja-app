# TASK-2026-04-006 — Projection & Behavior Engine

## 🎯 Objetivo

Implementar y normalizar el motor de comportamiento (behavior) y proyecciones del sistema, asegurando que todas las métricas proyectadas se basen exclusivamente en componentes variables y evitando cálculos engañosos.

Esta task define cómo el sistema interpreta el ritmo del usuario durante el mes.

---

## 📦 Alcance

Incluye:

- uso consistente del campo `behavior` (fixed / variable)
- separación de ingresos en fijos y variables
- separación de gastos en fijos y variables
- cálculo de velocidad de gasto variable
- cálculo de proyección de gastos variables
- cálculo de proyección de ingresos variables
- composición correcta de totales proyectados

---

## ❌ Fuera de alcance

- rediseño visual del dashboard
- estado financiero
- insights
- gráficos
- lógica de tarjeta (cubierta en TASK-005)

---

## 🧠 Reglas de negocio relevantes

Referenciar:

- docs/00-product/business-rules.md
- docs/03-history/mvps/28-mvp-dashboard-redesign.md

---

### Behavior

Cada categoría posee un comportamiento:

- fixed
- variable

### Regla clave

El behavior define si una transacción es proyectable.

- fixed → no proyecta
- variable → proyecta

---

### Separación obligatoria

Todas las métricas deben separar:

- componente fijo
- componente variable

No se deben mezclar para cálculos de proyección.

---

### Gastos

Se debe calcular:

- gastos fijos
- gastos variables

---

### Ingresos

Se debe calcular:

- ingresos fijos
- ingresos variables

---

### Velocidad de gasto

Debe calcularse únicamente sobre el componente variable.

No debe utilizarse el total de gastos del mes.

---

### Proyección de gastos

Debe basarse únicamente en el comportamiento variable.

El total proyectado debe componerse como:

- gastos fijos reales
- proyección de gastos variables

---

### Proyección de ingresos

Debe aplicarse la misma lógica:

- ingresos fijos no se proyectan
- ingresos variables sí se proyectan

---

### Regla crítica

No se permite proyectar sobre totales que mezclen componentes fijos y variables.

Esto debe evitar errores típicos como:

- duplicación de gastos únicos (ej: alquiler)
- sobreestimación de ingresos puntuales (ej: sueldo)

---

## ✅ Criterios de aceptación

- Todas las métricas proyectadas usan exclusivamente componentes variables
- No se proyectan gastos o ingresos fijos
- La velocidad de gasto no incluye componentes fijos
- Las proyecciones reflejan correctamente el ritmo real del usuario
- No existen proyecciones infladas por eventos únicos del mes

---

## 🔗 Dependencias

Depende de:

- TASK-2026-04-005 — Dashboard Rules Consolidation

Debe completarse antes de:

- TASK-2026-04-007 — Financial State & Insight Engine
- TASK-2026-04-008 — Dashboard Layout Redesign

---

## 🧪 Validación sugerida

Casos a validar manualmente:

- mes con sueldo único (no debe proyectarse)
- mes con gastos fijos altos al inicio
- gasto variable progresivo (ej: supermercado)
- ingreso variable (ej: freelance)
- combinación de fixed + variable

---

## 🔗 Referencias

- docs/03-history/mvps/28-mvp-dashboard-redesign.md
- docs/00-product/business-rules.md
