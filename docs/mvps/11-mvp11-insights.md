

# Encaja App — MVP 11

## MVP 11 — Pantalla de Insights financieros

---

## Objetivo

Crear una nueva pantalla de Insights que complemente al Dashboard sin ensuciarlo, ayudando al usuario a entender mejor a dónde está yendo su dinero y a detectar oportunidades de mejora en sus hábitos financieros.

Este MVP no reemplaza al Dashboard. El Dashboard sigue siendo una vista rápida del estado general del período. La pantalla de Insights debe funcionar como una vista analítica y explicativa.

---

## Intención de producto

Encaja no debe limitarse a registrar movimientos y mostrar números. Debe ayudar al usuario a comprender mejor sus gastos y a tomar mejores decisiones.

El tono de la app en esta pantalla debe ser:

- claro
- útil
- respetuoso
- no agresivo
- no moralizante

Ejemplos de tono deseado:

- `Te excediste en tu presupuesto de Servicios`
- `Hasta ahora, Transporte viene por encima de tu ritmo habitual`
- `Podrías excederte en Mercado si mantenés este ritmo`

Ejemplos a evitar:

- `Estás gastando mal`
- `Tu presupuesto es un desastre`
- `Vas muy mal`

---

## Estructura general

La pantalla de Insights tendrá **2 pestañas** claramente diferenciadas:

### 1. Este mes
Pantalla orientada a control del período actual.

Debe responder:
- qué está pasando hasta ahora
- qué categorías vienen pesadas
- en cuáles el usuario podría excederse si sigue igual
- cómo se está distribuyendo el gasto actual

### 2. Mes cerrado
Pantalla orientada a análisis del último mes completo.

Debe responder:
- cómo cerró el mes
- en qué categorías se gastó más
- qué cambió respecto al mes anterior
- qué aumentó y qué bajó

---

## Problema a resolver

Si solo se muestran datos crudos o tablas, el usuario necesita demasiado esfuerzo para entender dónde está yendo su dinero.

Además, hay una diferencia fundamental entre:

- un período en curso (incompleto)
- un período cerrado (definitivo)

No se deben mezclar ambos contextos.

La meta de este MVP es separar correctamente estos modos mentales:

- **controlar el mes actual**
- **aprender del mes ya cerrado**

---

## Resultado esperado

Al finalizar este MVP, un usuario debe poder:

- entrar a una pantalla dedicada a insights
- cambiar entre `Este mes` y `Mes cerrado`
- entender a dónde está yendo su dinero sin tener que leer tablas complejas
- ver señales útiles sobre su presupuesto y sus gastos
- identificar categorías que merecen revisión
- profundizar en una categoría mediante drill-down

---

## Alcance

### Incluye

#### 1. Nueva pantalla de Insights
- crear una pantalla nueva separada del Dashboard
- agregar navegación a esa pantalla
- definir dos pestañas internas

#### 2. Pestaña `Este mes`
- mostrar foto actual del período en curso
- mostrar top categorías por gasto
- mostrar presupuesto vs gasto actual
- mostrar proyección simple del mes en curso
- mostrar señales o advertencias suaves cuando corresponda

#### 3. Pestaña `Mes cerrado`
- mostrar resultados del último mes completo
- comparar contra el mes anterior
- destacar aumentos y reducciones relevantes
- mostrar categorías principales del mes cerrado

#### 4. Drill-down
- permitir navegar desde una categoría destacada hacia una vista más detallada
- o al menos dejar claramente preparado ese patrón dentro del flujo

#### 5. Copy y tono
- mantener un lenguaje útil, claro y no agresivo
- evitar mensajes moralizantes
- usar redacciones como `Te excediste`, `Podrías excederte`, `Aumentó respecto al mes pasado`

---

### NO incluye

Este MVP no debe incluir:

- cambios grandes al Dashboard
- nuevos gráficos innecesarios por decoración
- automatizaciones avanzadas
- IA generativa o consejos complejos
- scoring financiero
- cambios de base de datos que no sean estrictamente necesarios

---

## Reglas funcionales

## 1. Separación entre período en curso y período cerrado

Los insights deben diferenciar claramente entre:

- datos parciales del mes actual
- datos cerrados del último mes completo

Nunca mezclar ambos sin aclararlo visualmente.

---

## 2. Pestaña `Este mes`

### Lógica general
Debe trabajar con el mes actual y con datos parciales.

### Tipo de mensajes permitidos
Mensajes como:

- `Hasta ahora, Servicios representa el 28% de tus gastos`
- `Podrías excederte en Transporte si mantenés este ritmo`
- `Ya superaste tu presupuesto en Mercado`

### Mensajes que NO deberían aparecer
No presentar conclusiones finales sobre el mes si todavía no terminó.

Ejemplo a evitar:
- `Servicios fue tu mayor gasto del mes` (si el mes sigue en curso)

### Proyección
Se permite una proyección simple con lógica transparente, por ejemplo:

```text
monto_actual / días_transcurridos * días_del_mes
```

La proyección debe expresarse con lenguaje prudente:

- `Podrías excederte...`
- `Viene en línea con tu presupuesto...`

No debe presentarse como certeza.

---

## 3. Pestaña `Mes cerrado`

### Lógica general
Debe trabajar con el último mes completo cerrado.

### Tipo de mensajes permitidos
Mensajes más firmes, porque los datos ya están cerrados:

- `Gastaste un 18% más en Transporte que el mes anterior`
- `Servicios fue tu mayor categoría de gasto`
- `Reduciste tus gastos en Comida respecto al mes anterior`

### Comparación
Comparar principalmente contra el mes inmediatamente anterior.

---

## 4. Drill-down

Desde insights relevantes o categorías destacadas, el usuario debe poder:

- navegar a la lista de transacciones filtrada por esa categoría
- o, como mínimo, dejar la interfaz preparada para ese patrón

El drill-down es una parte indispensable de este MVP, porque convierte el insight en una puerta de entrada a la explicación real del dato.

---

## 5. Prioridad de insights

No sobrecargar la pantalla con demasiados mensajes.

Regla recomendada:

- máximo 2 o 3 insights principales por pestaña
- máximo 3 categorías destacadas por bloque

Encaja debe mostrar menos, pero mejor.

---

## Propuesta de estructura

### Pestaña: `Este mes`

#### Bloque 1 — Estado del período actual
- mes en curso
- día actual del mes / progreso del período
- gasto total hasta hoy

#### Bloque 2 — Top categorías actuales
- top 3 categorías por gasto hasta hoy
- porcentaje o monto según convenga

#### Bloque 3 — Presupuesto vs ritmo
- categorías que vienen en línea
- categorías que podrían excederse
- categorías ya excedidas

#### Bloque 4 — Drill-down
- acceso a detalle por categoría

---

### Pestaña: `Mes cerrado`

#### Bloque 1 — Resumen del mes cerrado
- gasto total del mes
- ingreso total del mes
- ahorro del mes

#### Bloque 2 — Top categorías del mes
- top 3 categorías por gasto del período cerrado

#### Bloque 3 — Comparación vs mes anterior
- mayores aumentos
- mayores reducciones
- variación porcentual o monetaria según convenga

#### Bloque 4 — Drill-down
- acceso a detalle filtrado por categoría

---

## Criterios de aceptación

### Producto
- la pantalla de Insights aporta valor distinto al Dashboard
- no duplica información sin propósito
- ayuda al usuario a entender mejor sus gastos

### UX
- la diferencia entre `Este mes` y `Mes cerrado` es clara
- los mensajes son útiles y comprensibles
- el tono no es agresivo ni moralizante

### Insights
- los insights son pocos pero relevantes
- la proyección se presenta como posibilidad, no como certeza
- la comparación contra el mes anterior es clara

### Drill-down
- existe una forma razonable de pasar de insight a detalle
- el usuario puede profundizar en una categoría concreta

### Consistencia
- la pantalla se integra con el sistema visual actual de Encaja
- mantiene consistencia con Dashboard, Presupuesto, Transacciones y Categorías

---

## Orden de implementación

### 1
- crear nueva ruta/pantalla de Insights
- agregar navegación

### 2
- implementar tabs: `Este mes` / `Mes cerrado`

### 3
- construir bloques principales de cada pestaña

### 4
- implementar lógica básica de comparación y proyección

### 5
- conectar drill-down hacia transacciones filtradas

### 6
- pulir copy, tono y consistencia visual

---

## Definición de terminado

El MVP está completo cuando Encaja incorpora una pantalla de Insights separada del Dashboard, con dos pestañas bien diferenciadas (`Este mes` y `Mes cerrado`), capaz de ayudar al usuario a entender mejor sus gastos actuales, compararlos con períodos anteriores y profundizar en una categoría relevante mediante drill-down, usando un tono claro, útil y respetuoso.

---

## Próximos pasos sugeridos

Después de este MVP, los siguientes incrementos posibles podrían ser:

- mayor profundidad de drill-down
- comparación contra promedios históricos
- insights por categorías recurrentes
- recomendaciones operativas más personalizadas