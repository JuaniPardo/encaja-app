

# TASK-2026-04-005 — Dashboard Rules Consolidation

## 🎯 Objetivo

Consolidar y normalizar todas las reglas base del dashboard financiero para asegurar una única interpretación consistente de los datos en toda la aplicación.

Esta task se enfoca exclusivamente en la capa lógica y de dominio, sin modificar aún la UI.

---

## 📦 Alcance

Incluye:

- definición y cálculo de disponible
- definición de ingresos del mes
- definición de gastos del mes
- exclusión de transferencias y ajustes del análisis principal
- implementación de la regla de fecha gobernante
- normalización del modelo de tarjeta de crédito
- cálculo de deuda rolada
- cálculo de cuotas comprometidas del mes siguiente

---

## ❌ Fuera de alcance

- rediseño visual del dashboard
- implementación de gráficos
- layout o componentes UI
- motor de insights
- estado financiero
- proyecciones avanzadas (se cubren en otra task)

---

## 🧠 Reglas de negocio relevantes

Referenciar:

- docs/00-product/business-rules.md
- docs/03-history/mvps/28-mvp-dashboard-redesign.md


### Disponible

- Incluye solo efectivo y cuentas débito
- No incluye tarjeta, deuda ni cuotas futuras
- Transferencias internas no alteran el total
- Pago de tarjeta reduce el disponible


### Ingresos

- Incluye sueldo e ingresos extra
- Excluye transferencias y ajustes


### Gastos

- Incluye consumo directo, compras con tarjeta y cuotas del mes
- Excluye pago de tarjeta
- Excluye transferencias y ajustes
- El gasto se reconoce en el momento del consumo


### Tarjeta de crédito

Debe consolidarse la lógica actual:

- Resumen del mes = consumos mes anterior + cuotas + deuda rolada
- Pagos del mes = cancelación del resumen


### Deuda rolada

- Puede ser positiva, cero o negativa
- Positiva → deuda pendiente
- Negativa → saldo a favor
- Cero → no se muestra


### Cuotas comprometidas

- Representan deuda futura del mes siguiente
- No impactan gasto actual


### Transferencias

- No deben impactar ingresos ni gastos
- No deben impactar métricas del dashboard
- Sí impactan balances de cuentas

Excepción:

- Pago de tarjeta → reduce disponible
- No se considera gasto


### Fecha gobernante

- Usar `effective_date` si existe
- Fallback a `transaction_date`
- Aplicar en todo el dominio

---

## ✅ Criterios de aceptación

- Todas las métricas del dashboard usan una única lógica consistente
- No existen duplicaciones de gasto por pagos de tarjeta
- Transferencias no afectan ingresos/gastos
- El disponible refleja correctamente pagos de tarjeta
- La deuda rolada soporta valores positivos y negativos
- La fecha gobernante se aplica en todas las consultas

---

## 🔗 Dependencias

Debe completarse antes de:

- TASK-2026-04-006 — Projection & Behavior Engine
- TASK-2026-04-007 — Financial State & Insight Engine
- TASK-2026-04-008 — Dashboard Layout Redesign

---

## 🧪 Validación sugerida

Casos a validar manualmente:

- pago de tarjeta completo
- pago parcial (deuda rolada positiva)
- sobrepago (saldo a favor)
- transferencia entre cuentas débito
- compra con tarjeta vs pago de tarjeta

---

## 🔗 Referencias

- docs/03-history/mvps/28-mvp-dashboard-redesign.md
- docs/00-product/business-rules.md
