

# MVP 28 — Dashboard Financiero Refinado

## Objetivo

Definir y consolidar las reglas de negocio, métricas y criterios de interpretación necesarios para construir un dashboard financiero claro, consistente y orientado a la toma de decisiones.

Este MVP no define implementación técnica ni UI específica. Su objetivo es establecer una base lógica sólida que guíe el desarrollo y deje explícitas las reglas que deberán respetarse en la ejecución.

## Alcance

Este MVP cubre:

- reglas de negocio del dashboard mensual
- definición de disponible, ingresos, gastos y deuda
- criterios para presupuesto, categorías y behavior
- reglas de proyección
- criterios para insights
- definición funcional del estado financiero

Este MVP no cubre:

- decisiones de implementación técnica
- estructura de componentes React
- endpoints, services o selectors específicos
- detalles de layout visual o diseño UI final

## Contexto General

- El dashboard representa siempre una única caja (workspace).
- Cada caja posee una única moneda activa.
- No existe conversión entre monedas y no se deberá implementar conversión histórica ni actual.
- El período principal de análisis del dashboard es mensual.
- La selección de mes define el período visualizado.
- Puede existir una referencia secundaria a otra caja relacionada, pero dicha referencia solo muestra un saldo resumido y no altera la lógica principal del dashboard.

## Disponible

### Definición

El disponible representa el dinero real utilizable en el momento actual.

### Incluye

- efectivo
- cuentas de tipo débito

### No incluye

- tarjeta de crédito
- deuda
- cuotas futuras
- compromisos de meses siguientes

### Reglas

- Las transferencias entre cuentas propias no alteran el total global del disponible.
- El pago de tarjeta de crédito sí reduce el disponible, ya que representa salida real de dinero desde efectivo o débito.
- El disponible es una de las métricas prioritarias del dashboard y debe tener protagonismo visual.

## Ingresos

### Definición

Se consideran ingresos únicamente los flujos reales de dinero que ingresan a la caja en el período.

### Incluye

- sueldo
- ingresos extra

### No incluye

- transferencias internas
- ajustes

### Regla

Los ingresos deben analizarse respetando la fecha gobernante definida para el dashboard.

## Gastos

### Definición

Se consideran gastos todos los consumos que representan uso real de dinero o compromiso económico generado en el período.

### Incluye

- consumo directo realizado con efectivo o débito
- compras con tarjeta de crédito
- cuotas correspondientes al mes

### No incluye

- pago de tarjeta de crédito
- transferencias
- ajustes

### Regla clave

El gasto se reconoce en el momento del consumo y no en el momento del pago de la tarjeta. Esta regla debe mantenerse en todo el dashboard para evitar duplicaciones.

## Tarjeta de Crédito y Deuda

### Resumen del mes anterior

Representa el resumen que llega para pagar en el mes actual.

Incluye:

- consumos con tarjeta del mes anterior
- cuotas correspondientes al mes anterior
- deuda rolada proveniente de períodos previos, si existiera

### Pagos del mes

Representa los pagos efectivamente realizados en el período para cancelar el resumen vigente.

### Deuda rolada

Se define como la diferencia entre el resumen a pagar y lo efectivamente pagado.

#### Interpretación

- si la diferencia es positiva, existe deuda pendiente
- si la diferencia es cero, la deuda quedó saldada y no debe mostrarse ninguna línea adicional
- si la diferencia es negativa, existe saldo a favor en tarjeta

### Regla de visualización

- La deuda rolada solo debe mostrarse cuando el resultado sea distinto de cero.
- Si el valor es positivo, debe comunicarse como deuda pendiente.
- Si el valor es negativo, debe comunicarse como saldo a favor.
- No debe forzarse la deuda rolada a cero ni perderse el caso de sobrepago.

### Cuotas comprometidas del mes siguiente

Representa el total de cuotas ya comprometidas que impactarán el mes siguiente.

Su objetivo es mostrar cuánto gasto fijo de tarjeta ya está sembrado para el próximo mes antes de registrar nuevos consumos.

Esta métrica puede mostrarse o no en el dashboard final según decisión de producto, pero queda definida como parte válida del modelo de análisis.

## Fechas

### Regla global

La fecha gobernante para toda operación analítica es:

- fecha efectiva, si existe
- en su defecto, fecha de la transacción

### Alcance

Esta regla debe aplicarse de forma consistente a:

- dashboard
- métricas
- insights
- presupuestos
- series temporales
- listados de transacciones mostrados en el tablero

## Presupuesto

### Definición

- el presupuesto es mensual
- el presupuesto se define por categoría

### Reglas

- El presupuesto puede copiarse desde el mes anterior al iniciar un nuevo mes.
- El presupuesto permanece editable.
- No se define en este MVP un presupuesto anual.

### Categoría sin presupuesto

- Debe mostrarse igualmente si presenta gasto.
- Se interpreta como presupuesto cero.
- No requiere una alerta especial por el solo hecho de no tener presupuesto cargado.

### Presupuesto sin gasto

- No implica ahorro automáticamente.
- El ahorro depende del resultado global del período y no de una categoría aislada sin consumo.

## Categorías

### Estructura

Existen dos grupos:

- categorías del sistema
- categorías custom creadas por el usuario

No se contemplan subcategorías.

### Behavior

Cada categoría posee un behavior:

- fijo
- variable

Las categorías del sistema pueden traer un valor por defecto, pero el usuario puede modificarlo.

### Regla clave

El behavior gobierna si los movimientos asociados a esa categoría participan o no en proyecciones.

- fijo: no proyectable
- variable: proyectable

### Regla de consistencia

El behavior no es decorativo. Debe impactar de manera consistente en:

- proyección de ingresos
- proyección de gastos
- métricas de ritmo
- insights relacionados con proyección
- interpretación del estado financiero cuando corresponda

### Regla de UX ya definida

En la edición de categoría debe informarse claramente que cambiar el behavior impacta en cálculos de proyección e interpretación mensual.

## Proyecciones

### Definición

Las proyecciones se realizan únicamente sobre componentes variables.

### Reglas generales

- Los ingresos fijos no se proyectan.
- Los gastos fijos no se proyectan.
- Los ingresos variables sí se proyectan.
- Los gastos variables sí se proyectan.
- La proyección se basa en el ritmo actual del mes.

### Composición

Toda proyección total debe construirse combinando:

- componente fijo real ya registrado
- componente variable proyectado según ritmo del período

### Regla clave

No debe aplicarse una proyección bruta sobre el total acumulado del mes si dicho total mezcla componentes fijos y variables.

## Métricas Inteligentes

### Velocidad de gasto

La velocidad de gasto debe representar el ritmo diario del componente variable de gasto y no del gasto total acumulado.

### Proyección de gasto

La proyección de gasto debe estimar el cierre del mes usando únicamente la parte variable como base proyectable y sumando luego los componentes fijos ya registrados.

### Proyección de ingresos

La misma lógica aplica a ingresos: solo la parte variable es proyectable.

### Regla de precisión

Las métricas inteligentes deben evitar conclusiones engañosas generadas por promediar consumos o ingresos fijos que ocurren una sola vez dentro del mes.

## Insights

### Definición

Los insights son interpretaciones automáticas de la situación financiera del usuario.

### Tipos previstos

- exceso de gasto
- categoría desbalanceada
- uso elevado de tarjeta
- baja actividad
- ahorro bajo

### Reglas del dashboard

- En el dashboard se muestra un único insight.
- Ese insight funciona también como CTA hacia la página dedicada de insights.
- El insight mostrado en el dashboard debe ser el más relevante según impacto y severidad.

### Tono

- informativo
- de acompañamiento
- no punitivo
- no moralista

### Regla funcional

El insight debe ayudar a pensar o detectar una situación relevante, sin caer necesariamente en recomendaciones directas cerradas.

## Transacciones

### Definición

El dashboard debe mostrar un conjunto reducido de transacciones recientes relevantes.

### Reglas

- Deben mostrarse pocas transacciones, priorizando claridad.
- Como referencia funcional, se toman las últimas cinco.
- Deben excluirse transferencias.
- Deben excluirse ajustes.
- Deben respetar la fecha gobernante definida para el dashboard.

## Estado Financiero

### Definición

El estado financiero representa el nivel de control y riesgo del usuario en el mes actual.

No debe interpretarse como juicio moral ni como calificación del usuario, sino como un resumen claro del nivel de presión financiera inmediata y próxima.

### Principio rector

El estado financiero debe estar gobernado principalmente por la presión futura y, en segundo plano, por el ritmo del mes actual.

### Variables prioritarias

Las variables principales del estado financiero son:

- disponible actual
- gasto con tarjeta del mes actual
- cuotas comprometidas del mes siguiente
- proyección de gastos variables

### Criterio general

El estado debe reflejar si el usuario está bajo control o en riesgo considerando:

- cuánto dinero real tiene hoy disponible
- cuánto ya comprometió con tarjeta
- cuánto arrastra hacia el próximo mes
- cómo viene su ritmo proyectable de gasto

### Importancia relativa

- El disponible actual es una métrica central.
- El uso de tarjeta tiene peso crítico en la interpretación.
- La presión futura pesa más que una simple lectura de gasto pasado.
- El comportamiento proyectable debe influir sin distorsionar el análisis mediante proyecciones ingenuas.

### Niveles

El estado financiero debe tener cuatro niveles:

- saludable
- estable
- atento
- crítico

### Intención de los niveles

- Saludable: bajo nivel de compromiso y buen margen de maniobra.
- Estable: situación controlada, aunque requiere seguimiento.
- Atento: compromiso alto o ritmo que empieza a generar riesgo.
- Crítico: compromisos y presión futura capaces de comprometer seriamente el próximo mes.

### Regla de comunicación

El estado financiero debe poder explicarse en una sola frase clara, basada en datos concretos.

### Tono del copy

El copy asociado al estado financiero debe ser:

- cercano
- claro
- sobrio
- tipo companion
- no punitivo
- no moralista

### Regla de equilibrio

El sistema debe ser capaz de señalar problemas cuando existan, pero también de comunicar escenarios positivos o de control cuando la situación sea favorable.

## Prioridades del Dashboard

Las prioridades del dashboard son, en este orden:

1. claridad visual
2. precisión de los datos
3. insights útiles

---

## Transferencias

### Definición

Una transferencia es un movimiento interno entre cuentas dentro del mismo workspace.

Se modela conceptualmente como una transacción doble:

- un egreso en la cuenta origen
- un ingreso en la cuenta destino

Ambos movimientos representan la misma operación.

### Clasificación

Existen dos tipos de transferencias a nivel funcional:

- transferencias internas entre cuentas de efectivo o débito
- pagos de tarjeta de crédito

### Reglas generales

- Las transferencias no representan ingreso ni gasto real.
- No deben impactar en:
  - ingresos
  - gastos
  - ahorro
  - métricas del dashboard
  - insights

### Impacto en balances

- Sí impactan en balances de cuentas individuales.
- Sí impactan en la composición del disponible por cuenta.

### Regla de consistencia

- Las transferencias internas entre cuentas de efectivo o débito no deben alterar el disponible total consolidado.

### Excepción — Pago de tarjeta de crédito

Cuando una transferencia se utiliza para pagar una tarjeta de crédito:

- representa una salida real de dinero desde cuentas de efectivo o débito
- debe disminuir el disponible
- no debe contabilizarse como gasto
- debe interpretarse como cancelación de deuda

### Regla de visualización

- No deben mostrarse como parte del análisis financiero principal.
- Deben excluirse de listados de transacciones del dashboard.

---

## Resultado esperado

Al implementar este MVP, el usuario debería poder:

- entender su situación financiera en pocos segundos
- identificar presión financiera inmediata y futura
- visualizar el peso real de la tarjeta sobre su mes actual y el siguiente
- comprender qué parte de su comportamiento es proyectable y cuál no
- tomar decisiones informadas sin tener que reconstruir manualmente la lógica detrás de los datos