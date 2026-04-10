

# Encaja App — Reglas de Negocio v1

## Fecha
2026-04-10

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

Estas reglas son el corazón del sistema.

---

## 2. Tipos de movimientos

Existen tres tipos de transacciones:

- income (ingreso)
- expense (gasto)
- saving (ahorro)

### Regla
El tipo de la transacción debe coincidir con el tipo de la categoría.

---

## 3. Presupuesto

### 3.1 Definición

El presupuesto representa la planificación esperada para un período (mes/año) por categoría.

### 3.2 Reglas

- Cada período tiene un único presupuesto por categoría
- No es obligatorio que todas las categorías tengan presupuesto
- El presupuesto puede ser cero

---

## 4. Transacciones

### 4.1 Fecha de transacción

`transaction_date` representa cuándo ocurrió el movimiento en la realidad.

### 4.2 Fecha efectiva

`effective_date` representa cuándo impacta en el análisis financiero.

### Regla

- Si `effective_date` es NULL → se usa `transaction_date`
- Si existe → tiene prioridad sobre `transaction_date`

---

## 5. Imputación temporal

El sistema asigna cada transacción a un período (mes/año) según:

```text
fecha_imputación = effective_date ?? transaction_date
```

El período se determina a partir de esa fecha.

---

## 6. Cálculo de totales

Para un período dado:

### 6.1 Ingresos
Suma de todas las transacciones tipo income

### 6.2 Gastos
Suma de todas las transacciones tipo expense

### 6.3 Ahorro
Suma de todas las transacciones tipo saving

---

## 7. Balance del período

```text
balance = ingresos - gastos - ahorro
```

### Interpretación

- balance = 0 → equilibrio
- balance > 0 → dinero no asignado
- balance < 0 → gasto mayor al ingreso

---

## 8. Comparación presupuesto vs real

Para cada categoría:

```text
desvío = real - presupuesto
```

### Interpretación

- positivo → se gastó o ingresó más de lo previsto
- negativo → se gastó o ingresó menos de lo previsto

---

## 9. Porcentaje de ejecución

```text
% ejecución = real / presupuesto
```

### Reglas

- Si presupuesto = 0 → el porcentaje no aplica
- Puede superar el 100%

---

## 10. Ahorro

### Definición

El ahorro es explícito: solo existe si hay transacciones tipo `saving`.

### Regla

El sistema NO calcula ahorro automáticamente en v1.

---

## 11. Medios de pago

### Regla

- Son opcionales en la transacción
- Deben pertenecer al mismo workspace

---

## 12. Consistencia de workspace

Todas las entidades relacionadas deben pertenecer al mismo workspace:

- categoría
- medio de pago
- presupuesto
- transacción

---

## 13. Validaciones

- No puede haber dos presupuestos para la misma categoría y período
- No puede haber dos períodos iguales en un mismo workspace
- El monto debe ser mayor a cero

---

## 14. Casos no cubiertos en v1

- lógica de tarjetas de crédito (cierres y vencimientos)
- ingresos diferidos automáticos
- ahorro automático basado en excedente
- múltiples monedas

---

## 15. Principios

- claridad por sobre complejidad
- comportamiento predecible
- evitar magia oculta

---

## 16. Resumen

Las reglas de negocio definen cómo se interpretan los datos y cómo se calculan los resultados financieros. En esta versión se prioriza un modelo simple, explícito y controlado por el usuario.