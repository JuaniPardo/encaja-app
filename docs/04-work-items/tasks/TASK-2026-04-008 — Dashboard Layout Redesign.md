# TASK-2026-04-008 — Dashboard Layout Redesign

## 🎯 Objetivo

Rediseñar el layout del dashboard para mejorar la claridad visual, jerarquía de información y comprensión inmediata del estado financiero del usuario.

Esta task transforma la lógica implementada en las tasks anteriores en una experiencia visual clara, ordenada y accionable.

---

## 📦 Alcance

Incluye:

- reorganización completa del layout del dashboard
- definición de jerarquía visual de bloques
- priorización de métricas clave (disponible y tarjeta)
- redistribución de componentes en grilla
- mejora de legibilidad y densidad visual
- selección y uso adecuado de gráficos

---

## ❌ Fuera de alcance

- cambios en reglas de negocio
- modificación de cálculos
- lógica de proyecciones
- motor de insights (ya definido en TASK-007)

---

## 🧠 Principios de diseño

El rediseño debe respetar:

- claridad por sobre cantidad de información
- jerarquía visual fuerte
- lectura rápida (escaneo en segundos)
- consistencia con el modelo de negocio

---

## 🧱 Estructura del dashboard

### Bloque superior (prioridad máxima)

Debe mostrar:

- disponible actual (protagonista)
- gasto con tarjeta del mes

### Objetivo

Permitir que el usuario entienda en segundos:

- cuánto dinero tiene
- cuánto ya comprometió con tarjeta

---

### Bloque de estado financiero

Debe incluir:

- estado financiero (label + mensaje)
- explicación breve basada en datos

Debe ser visible sin scroll.

---

### Bloque de insight principal

Debe mostrar:

- un único insight relevante
- mensaje claro
- comportamiento clickeable (CTA hacia página de insights)

---

### Bloque de flujo del mes

Debe incluir:

- evolución de ingresos y gastos en el mes

Recomendación:

- gráfico de líneas o área

---

### Bloque de categorías

Debe incluir:

- top categorías de gasto

Recomendación:

- barras horizontales

No utilizar gráficos tipo donut como principal.

---

### Bloque de presupuesto

Debe incluir:

- comparación presupuesto vs gasto

Debe ser secundario en jerarquía.

---

### Bloque de cuotas / deuda

Debe incluir:

- cuotas del mes
- cuotas comprometidas del mes siguiente

Debe ayudar a entender compromiso futuro.

---

### Bloque de transacciones

Debe incluir:

- últimas transacciones relevantes

Reglas:

- pocas (ej: 5)
- excluir transferencias
- excluir ajustes

---

## 📐 Reglas de layout

- evitar exceso de espacio vacío en el centro
- evitar dispersión horizontal innecesaria
- agrupar información relacionada
- mantener consistencia entre tamaños de cards

---

## 🎨 Jerarquía visual

Orden de prioridad:

1. disponible
2. tarjeta
3. estado financiero
4. insight
5. flujo del mes
6. categorías
7. presupuesto
8. detalle (transacciones)

---

## 🖼️ Referencia visual

Ver:

- docs/05-assets/dashboard.png

La imagen se utiliza como guía de:

- jerarquía
- densidad
- distribución

No representa especificación funcional exacta.

---

## ✅ Criterios de aceptación

- el usuario entiende su situación financiera en menos de 5 segundos
- disponible y tarjeta son visibles sin esfuerzo
- el estado financiero se interpreta rápidamente
- el insight principal es claro y relevante
- no hay sobrecarga visual
- el layout es consistente en desktop

---

## 🔗 Dependencias

Depende de:

- TASK-2026-04-005 — Dashboard Rules Consolidation
- TASK-2026-04-006 — Projection & Behavior Engine
- TASK-2026-04-007 — Financial State & Insight Engine

---

## 🧪 Validación sugerida

- prueba de lectura rápida (menos de 5 segundos)
- comparación con layout anterior
- validación en distintos tamaños de pantalla (desktop foco principal)

---

## 🔗 Referencias

- docs/03-history/mvps/28-mvp-dashboard-redesign.md
- docs/05-assets/dashboard.png
