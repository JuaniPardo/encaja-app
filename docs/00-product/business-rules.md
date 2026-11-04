# Encaja App — Reglas de Negocio v2

## Fecha
2026-04-23

## Estado
Draft

## Autor
Juan Pardo

---

## 1. Propósito del documento

Este documento define cómo “piensa” la aplicación.

Mientras que el modelo de datos define qué se guarda, este documento define:

- cómo se interpreta la información
- cómo se calculan los resultados
- qué reglas se deben cumplir

Estas reglas son el corazón del sistema y deben aplicarse de forma consistente en toda la aplicación.

---

## 2. Contexto general

- El análisis se realiza siempre dentro de una única caja (workspace).
- Cada workspace tiene una única moneda activa.
- No existe conversión entre monedas.
- El período principal de análisis es mensual.

---

## 3. Tipos de movimientos

Existen tres tipos de transacciones:

- income (ingreso)
- expense (gasto)
- saving (ahorro)
- transfer (transferencia)

### Regla

El tipo de la transacción debe coincidir con el tipo de la categoría.

---

## 4. Fechas y criterio temporal

### 4.1 Fecha de transacción

`transaction_date` representa cuándo ocurrió el movimiento en la realidad.

### 4.2 Fecha efectiva

`effective_date` representa cuándo impacta en el análisis financiero.

### Regla global

- Si `effective_date` es NULL → se usa `transaction_date`
- Si existe → tiene prioridad

### Imputación

El sistema asigna cada transacción a un período según:

fecha_imputación = effective_date ?? transaction_date

Esta regla aplica a todo el sistema:

- dashboard
- métricas
- insights
- presupuestos

---

## 5. Disponible

### Definición

El disponible representa el dinero real utilizable en el momento actual.

### Incluye

- efectivo
- cuentas de tipo débito

### No incluye

- tarjetas de crédito
- deuda
- cuotas futuras

### Reglas

- Las transferencias entre cuentas propias no alteran el total global
- El pago de tarjeta de crédito reduce el disponible

---

## 6. Ingresos

### Definición

Se consideran ingresos únicamente los flujos reales de dinero.

### Incluye

- sueldo
- ingresos extra

### No incluye

- transferencias
- ajustes

---

## 7. Gastos

### Definición

Se consideran gastos todos los consumos que representan uso o compromiso económico.

### Incluye

- consumo directo
- compras con tarjeta
- cuotas del mes

### No incluye

- pago de tarjeta
- transferencias
- ajustes

### Regla clave

El gasto se registra en el momento del consumo, no del pago.

---

## 7.1 Transferencias

### Definición

Una transferencia es un movimiento interno entre cuentas del mismo workspace.

Se modela como una transacción doble:

- un egreso en la cuenta origen
- un ingreso en la cuenta destino

Ambos movimientos representan la misma operación.

### Reglas

- Las transferencias no representan ingreso ni gasto real.
- No deben impactar en:
  - ingresos
  - gastos
  - ahorro
  - métricas del dashboard
  - insights

Sin embargo, existe una excepción:

- Cuando la transferencia se utiliza para pagar una tarjeta de crédito, sí representa una salida real de dinero desde cuentas de efectivo o débito.
- En ese caso, debe impactar en el disponible (disminuyéndolo), ya que se está utilizando dinero real para cancelar deuda.
- Este impacto no debe reinterpretarse como gasto, sino como movimiento de cancelación de deuda.

- Sí impactan en:
  - balances de cuentas individuales
  - composición del disponible por cuenta

### Regla de consistencia

El total del disponible consolidado no debe alterarse por transferencias internas entre cuentas de efectivo o débito.

Sin embargo, cuando la transferencia corresponde a un pago de tarjeta de crédito, sí debe disminuir el disponible, ya que representa uso real de dinero para cancelar deuda.

### Regla de visualización

- No deben mostrarse como parte del análisis financiero principal.
- Deben excluirse de listados de transacciones del dashboard.

---

## 8. Tarjeta de crédito

### 8.1 Resumen del mes

Representa lo que debe pagarse en el mes actual.

Incluye:

- consumos del mes anterior
- cuotas del mes anterior
- deuda rolada

### 8.2 Pagos del mes

Representa los pagos realizados en el período.

### 8.3 Deuda rolada

Se define como:

resumen_mes_anterior - pagos_realizados

### Interpretación

- positivo → deuda pendiente
- cero → saldado (no se muestra)
- negativo → saldo a favor

### Regla

La deuda rolada puede ser positiva o negativa y no debe forzarse a cero.

### 8.4 Cuotas comprometidas

Representa las cuotas que impactarán el mes siguiente.

Indica compromiso futuro.

---

## 9. Presupuesto

### Definición

- mensual
- por categoría

### Reglas

- puede copiarse desde el mes anterior
- es editable
- no es obligatorio

### Casos

Categoría sin presupuesto:
- se muestra
- se interpreta como cero

Presupuesto sin gasto:
- no implica ahorro

### Categoría en riesgo

En la pantalla de presupuesto, el contador de la sección Gastos cuenta como "en riesgo" a una categoría de gasto variable con presupuesto mayor que cero cuando:

- lo real supera lo presupuestado (por más de 0,005), o
- lo real dividido lo presupuestado supera la fracción del mes transcurrida más 10 puntos porcentuales

La fracción del mes es 1 en un mes pasado, días transcurridos / días del mes en el mes actual y 0 en un mes futuro.

Nunca cuentan:

- los gastos fijos, aunque estén exactos o superados
- los ingresos y el ahorro
- una categoría sin presupuesto (se interpreta como cero)

Las secciones Ingresos y Ahorro muestran solo la cantidad de categorías.

---

## 10. Categorías y comportamiento

### Tipos

- categorías sistema
- categorías custom

### Behavior

Cada categoría tiene:

- fixed
- variable

### Regla

El behavior define si es proyectable:

- fixed → no proyecta
- variable → proyecta

### Alcance

Impacta en:

- proyecciones
- métricas
- insights

---

## 11. Proyecciones

### Definición

Solo se proyectan componentes variables.

### Reglas

- ingresos fijos no se proyectan
- gastos fijos no se proyectan
- variables sí se proyectan

### Composición

Total proyectado =

- componente fijo real
- componente variable proyectado

### Regla clave

No proyectar sobre totales mixtos.

### Ingreso esperado (insights y estado financiero)

Los insights y el estado financiero usan el ingreso esperado, no el total proyectado:

- con el mes abierto, el ingreso fijo de cada categoría es el máximo entre lo cobrado y lo presupuestado para esa categoría; el presupuesto es un piso, no una proyección
- con el mes cerrado, el ingreso fijo es lo cobrado
- el ingreso variable se proyecta como siempre; su presupuesto no se usa como piso
- ingreso esperado = ingreso fijo esperado + ingreso variable proyectado
- balance esperado = ingreso esperado − gasto total proyectado

La composición "fijo real + variable proyectado" sigue siendo el total proyectado.

---

## 12. Métricas inteligentes

### Velocidad de gasto

Se calcula solo sobre gasto variable.

### Proyección de gasto

Se basa en comportamiento variable.

### Proyección de ingresos

Misma lógica.

---

## 13. Insights

### Definición

Interpretaciones automáticas.

### Tipos

- exceso de gasto
- desbalance
- uso de tarjeta
- baja actividad
- bajo ahorro

### Reglas

- se muestra uno en dashboard
- es clickeable
- tono informativo
- la tarjeta sin pagos del resumen anterior es informativa hasta el día 15 del mes y advertencia desde el 16; nunca es alerta

---

## 14. Estado financiero

### Definición

Representa el nivel de control y riesgo del usuario.

### Variables principales

- disponible
- gasto con tarjeta
- cuotas futuras
- proyección de gastos

### Principio

Se prioriza la presión futura.

### Interpretación

Evalúa:

- capacidad actual
- compromisos futuros
- ritmo de gasto

### Niveles

- saludable
- estable
- atento
- crítico

### Regla

Debe poder explicarse en una sola frase: el dashboard muestra, junto al nivel, una frase que explica el motivo.

Sin ingreso fijo esperado (ni cobrado ni presupuestado) y con el mes abierto, un balance proyectado negativo da como máximo "atento". Las demás causas de "crítico" no cambian.

El dashboard muestra el estado y el consejo principal de hoy con el rótulo "Hoy", y los oculta al mirar un mes pasado.

---

## 15. Transacciones

### Reglas

- mostrar últimas relevantes
- excluir transferencias
- excluir ajustes

---

## 16. Consistencia de workspace

Todas las entidades deben pertenecer al mismo workspace.

---

## 17. Validaciones

- no duplicar presupuesto por categoría y período
- no duplicar períodos
- monto > 0

---

## 18. Casos no cubiertos

- cierres de tarjeta
- ingresos diferidos
- ahorro automático
- múltiples monedas

---

## 19. Principios

- claridad sobre complejidad
- consistencia
- evitar duplicación de lógica
- evitar proyecciones engañosas

---

## 20. Resumen

El sistema prioriza una interpretación clara, consistente y orientada a decisiones, evitando ambigüedades y duplicaciones en el análisis financiero.
