

# TASK-2026-04-007 — Financial State & Insight Engine

## 🎯 Objetivo

Implementar el motor de estado financiero e insights del sistema, transformando los datos y métricas en interpretación clara para el usuario.

Esta task representa la capa de inteligencia del producto.

---

## 📦 Alcance

Incluye:

- cálculo del estado financiero
- definición de niveles (saludable, estable, atento, crítico)
- lógica de presión futura
- integración de disponible, tarjeta y proyección
- generación de insights
- selección del insight principal para el dashboard
- definición de copy para estado e insights

---

## ❌ Fuera de alcance

- layout visual del dashboard
- componentes UI
- gráficos
- implementación de navegación

---

## 🧠 Reglas de negocio relevantes

Referenciar:

- docs/00-product/business-rules.md
- docs/03-history/mvps/28-mvp-dashboard-redesign.md

---

## Estado financiero

### Definición

El estado financiero representa el nivel de control y riesgo del usuario en el mes actual.

Debe reflejar:

- cuánto dinero tiene disponible
- cuánto ya comprometió con tarjeta
- cuánto arrastra al mes siguiente
- cómo viene su ritmo proyectado de gasto

---

### Variables principales

- disponible actual
- gasto con tarjeta del mes actual
- cuotas comprometidas del mes siguiente
- proyección de gastos variables

---

### Principio clave

El estado financiero debe estar gobernado principalmente por la presión futura.

---

### Presión futura

Representa el nivel de compromiso del próximo mes.

Incluye:

- gasto con tarjeta del mes actual
- cuotas comprometidas del mes siguiente

---

### Interpretación

El estado financiero evalúa:

- capacidad actual (disponible)
- compromisos futuros (tarjeta y cuotas)
- comportamiento proyectado

---

### Niveles

Se deben implementar cuatro niveles:

- saludable
- estable
- atento
- crítico

---

### Intención de niveles

- Saludable → bajo compromiso, buen margen
- Estable → controlado, requiere seguimiento
- Atento → compromiso relevante, riesgo creciente
- Crítico → compromisos superan capacidad

---

### Regla de comunicación

El estado debe poder explicarse en una sola frase basada en datos.

---

### Tono

- companion
- no punitivo
- no moralista
- claro y directo

---

## Insights

### Definición

Los insights son interpretaciones automáticas de la situación del usuario.

---

### Tipos

- exceso de gasto
- desbalance por categoría
- uso elevado de tarjeta
- baja actividad
- ahorro bajo

---

### Reglas

- el dashboard muestra un único insight
- debe seleccionarse el más relevante
- debe ser clickeable
- debe derivar a la página de insights

---

### Criterio de selección

El insight principal debe seleccionarse en base a:

- severidad
- impacto
- urgencia

---

### Regla clave

El insight no debe ser prescriptivo.

Debe:

- informar
- generar conciencia
- permitir al usuario interpretar su situación

---

## ✅ Criterios de aceptación

- el estado financiero refleja correctamente la presión futura
- los niveles cambian de forma coherente según los datos
- el sistema no genera estados contradictorios
- el insight principal es relevante y consistente
- el tono del mensaje es claro y no punitivo

---

## 🔗 Dependencias

Depende de:

- TASK-2026-04-005 — Dashboard Rules Consolidation
- TASK-2026-04-006 — Projection & Behavior Engine

Debe completarse antes de:

- TASK-2026-04-008 — Dashboard Layout Redesign

---

## 🧪 Validación sugerida

Casos a validar manualmente:

- usuario con alto uso de tarjeta
- usuario con bajo disponible
- usuario con proyección de gasto alta
- usuario con situación estable
- usuario sin actividad reciente

---

## 🔗 Referencias

- docs/03-history/mvps/28-mvp-dashboard-redesign.md
- docs/00-product/business-rules.md
