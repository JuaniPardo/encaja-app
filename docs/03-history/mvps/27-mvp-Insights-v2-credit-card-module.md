

# Encaja App — MVP 27

## MVP 27 — Insights v2: módulo Credit Card

---

## Objetivo

Rediseñar el sistema de Insights de Encaja para que deje de ser una pantalla analítica genérica y pase a funcionar como un sistema modular de señales financieras, priorizadas y explicadas, comenzando por el módulo `credit_card`.

Este MVP debe establecer la nueva base conceptual, funcional y técnica de Insights v2, con foco inicial en tarjeta de crédito, contemplando pagos, deuda, cuotas, compromiso futuro y una bajada pedagógica contextual del módulo.

---

## Intención de producto

Encaja no debe limitarse a mostrar números. Debe ayudar al usuario a interpretar su situación financiera actual, identificar riesgos concretos y comprender por qué ciertos patrones importan.

El sistema de Insights debe:

- destacar lo importante sin saturar
- priorizar señales relevantes
- separar correctamente lo urgente de lo explicativo
- mantener un tono claro, útil y respetuoso
- evitar mensajes moralizantes o punitivos
- dejar preparada una arquitectura modular para futuros dominios

Este rediseño comienza por `credit_card`, porque es uno de los dominios con más complejidad real y más valor potencial para el usuario.

---

## Problema a resolver

El modelo anterior de Insights estaba orientado principalmente a lectura analítica de gasto por períodos (`Este mes` / `Mes cerrado`). Ese enfoque sigue siendo válido para futuros módulos, pero resulta insuficiente para modelar correctamente situaciones financieras más complejas, especialmente en tarjeta de crédito.

En particular, la lógica previa no contemplaba de forma explícita:

- deuda pendiente vs gasto del período
- pago completo vs pago parcial
- deuda total vs presión de corto plazo
- compras financiadas en cuotas
- compromiso ya sembrado para meses futuros
- prioridad entre múltiples señales concurrentes
- una explicación pedagógica por módulo

Este MVP resuelve ese faltante sentando una nueva base para Insights v2.

---

## Resultado esperado

Al finalizar este MVP, Encaja debe poder:

- contar con una arquitectura modular de insights
- generar insights homogéneos desde un motor común
- mostrar un insight principal priorizado en el Dashboard
- mostrar una página de Insights organizada por módulo
- implementar de punta a punta el módulo `credit_card`
- detectar señales relevantes relacionadas con tarjeta de crédito
- distinguir entre deuda total, gasto mensual, pago actual y compromiso próximo
- acompañar los insights del módulo con una bajada pedagógica contextual
- dejar preparado el camino para sumar futuros módulos como `behavior`, `spending`, `cashflow` o `activity`

---

## Alcance

### Incluye

#### 1. Rediseño conceptual de Insights
- redefinir Insights como sistema modular
- separar generación de señales, priorización y render
- establecer un contrato común para todos los módulos

#### 2. Nuevo motor de insights
- crear una estructura base para generar insights por módulo
- permitir que múltiples módulos devuelvan insights homogéneos
- ordenar los insights por prioridad

#### Dashboard
- el área destinada originalmente a empty state se reutiliza dinámicamente para mostrar insights cuando el usuario ya tiene datos
- si existe empty state (sin datos suficientes), se mantiene el comportamiento actual de empty state con su guía y CTA
- si no existe empty state, ese espacio debe mostrar un único insight principal
- el insight mostrado debe ser el de mayor prioridad global entre todos los módulos
- no se deben mostrar múltiples insights simultáneamente en el Dashboard
- el objetivo es destacar la señal más relevante sin saturar al usuario
- este espacio no debe utilizarse para listados, comparativas ni rotación automática de insights

#### Selección del insight principal
- el sistema debe evaluar todos los insights generados por los módulos
- debe ordenarlos por prioridad global
- debe seleccionar únicamente el insight de mayor prioridad
- la prioridad debe considerar, como mínimo:
    - severidad (`alert` > `warning` > `info` > `positive`)
    - peso del dominio (por ejemplo, dentro de `credit_card`, señales críticas como no pago o deuda alta deben prevalecer)
- el insight seleccionado es el único que se renderiza en el Dashboard
- la página de Insights conserva el listado completo

#### 4. Página de Insights
- mostrar todos los insights agrupados por módulo
- mostrar título y bajada contextual de cada módulo
- dejar preparado el patrón para crecer con nuevos módulos

#### 5. Módulo `credit_card`
- implementar el primer módulo completo de Insights v2
- soportar reglas relacionadas con pago, deuda, cuotas y compromiso futuro
- usar `payment_method.type === "credit_card"` como criterio de pertenencia al módulo

#### 6. Bajada contextual por módulo
- modelar cada módulo con una bajada pedagógica propia
- dejar el resolver preparado para que esa bajada pueda variar según contexto
- en esta primera versión, permitir que el módulo tenga una sola variante si todavía no hace falta más complejidad

#### 7. Compatibilidad con compras en cuotas
- contemplar correctamente la lógica ya implementada de compras financiadas
- distinguir entre gasto mensual actual, deuda pendiente y compromiso del mes siguiente

---

### NO incluye

Este MVP no debe incluir:

- implementación de módulos futuros (`behavior`, `spending`, etc.)
- motor conversacional o IA generativa
- consejos financieros largos o complejos
- scoring financiero global
- proyecciones avanzadas de múltiples meses
- visualizaciones decorativas innecesarias
- rediseño completo del Dashboard fuera del slot de insight

---

## Cambio de enfoque respecto al MVP original

El MVP 11 definía Insights como una pantalla analítica separada del Dashboard, organizada en dos pestañas: `Este mes` y `Mes cerrado`, con foco en gasto, presupuesto, proyección simple y drill-down.

Ese concepto fue útil como primera aproximación, pero este nuevo MVP redefine la capability de Insights de forma más profunda:

- de una pantalla analítica por período
- a un sistema modular de señales financieras

Por lo tanto:

- el espíritu de ayudar al usuario a entender mejor su dinero se mantiene
- el tono claro, útil y respetuoso se mantiene
- la idea de no ensuciar el Dashboard se mantiene
- pero la estructura funcional cambia

Ahora la prioridad pasa a ser:

- detectar señales relevantes
- priorizarlas correctamente
- explicarlas con contexto
- renderizarlas por módulo

---

## Modelo conceptual

Cada módulo de insights debe tener dos capas complementarias:

### 1. Insights puntuales
Señales concretas derivadas de reglas funcionales.

Ejemplos:
- no pagaste la tarjeta
- hiciste un pago parcial
- estás usando demasiado crédito respecto a tus ingresos
- ya tenés una parte importante del mes siguiente comprometida en cuotas

### 2. Bajada contextual del módulo
Texto breve, pedagógico y constructivo que ayude a interpretar por qué esas señales importan.

La bajada:
- no debe repetir literalmente el insight
- debe subir de nivel conceptual
- debe ser breve
- debe poder resolverse dinámicamente en el futuro

---

## Contrato funcional general

El sistema debe quedar preparado para soportar un contrato homogéneo para cualquier módulo.

Ejemplo conceptual:

```ts
export type InsightSeverity = "info" | "warning" | "alert" | "positive";

export type InsightModule =
  | "credit_card"
  | "behavior"
  | "spending"
  | "cashflow"
  | "activity";

export type Insight = {
  id: string;
  module: InsightModule;
  kind: string;
  severity: InsightSeverity;
  title: string;
  message: string;
  priority: number;
  data?: Record<string, unknown>;
};
```

Esto no obliga a cerrar ahora todos los detalles técnicos, pero sí define la dirección correcta.

---

## Reglas funcionales generales

### 1. Arquitectura modular
Los insights no deben implementarse como una lista de condiciones mezcladas en UI.

Cada módulo debe ser capaz de:
- consumir contexto
- generar sus propios insights
- devolver una colección homogénea
- aportar su metadata contextual

---

### 2. Separación de responsabilidades
Debe existir una separación clara entre:

- generación de insights
- priorización
- selección para Dashboard
- render en página de Insights
- metadata contextual del módulo

---

### 3. Dashboard vs página de Insights

#### Dashboard
- mostrar solo un insight principal
- debe ser el insight de mayor prioridad disponible
- no debe saturar con múltiples mensajes

#### Página de Insights
- mostrar todos los insights disponibles
- agruparlos por módulo
- renderizar debajo de cada módulo su bajada contextual

---

### 4. Prioridad
Cuando existan varios insights al mismo tiempo, Encaja debe mostrar primero los más importantes.

Regla general recomendada:
- `alert` por encima de `warning`
- `warning` por encima de `info`
- `positive` puede mostrarse cuando no haya señales más críticas o como complemento controlado

Además, dentro de `credit_card`, ciertas señales deben tener prioridad extra por su impacto financiero.

---

## Módulo `credit_card`

### Objetivo del módulo
Ayudar al usuario a comprender mejor la situación de su tarjeta de crédito, diferenciando correctamente:

- gasto del mes
- pago actual
- deuda total pendiente
- compromiso del mes siguiente
- peso de la tarjeta sobre sus ingresos

---

## Supuestos funcionales del módulo

### 1. Identificación
Una tarjeta pertenece al módulo si:

```ts
payment_method.type === "credit_card"
```

---

### 2. Dimensiones que el módulo debe distinguir

#### a. Gasto mensual real
Debe reflejar lo que impacta en el mes actual.

Incluye:
- consumos de tarjeta del mes
- cuotas correspondientes al mes actual

No debe confundirse con el total financiado históricamente.

---

#### b. Pago del resumen actual
Debe representar lo exigible ahora.

Sirve para detectar:
- tarjeta no pagada
- pago parcial
- presión actual sobre ingresos

---

#### c. Deuda total pendiente
Debe representar el total vivo asociado a tarjeta.

Incluye:
- saldo no cancelado
- deuda arrastrada
- cuotas futuras pendientes

Sirve para medir endeudamiento estructural.

---

#### d. Compromiso del mes siguiente
Debe representar cuánto ya está comprometido para el próximo mes por cuotas activas.

Sirve para distinguir:
- deuda total de largo plazo
- presión financiera de corto plazo

---

## Reglas funcionales del módulo `credit_card`

### 1. Tarjeta no pagada

#### Regla
Disparar insight cuando el vencimiento ya pasó y no hubo pago del resumen correspondiente.

#### Intención
Detectar una situación crítica y urgente.

#### Ejemplo de copy
- `Todavía no pagaste tu tarjeta este mes`
- `Tené en cuenta este vencimiento para evitar seguir acumulando deuda`

#### Severidad sugerida
`alert`

---

### 2. Pago parcial

#### Regla
Disparar insight cuando hubo pago, pero el monto pagado es menor al exigible del período.

#### Intención
Detectar deuda arrastrada.

#### Ejemplo de copy
- `Hiciste un pago parcial de tu tarjeta`
- `Estás arrastrando saldo pendiente al próximo período`

#### Severidad sugerida
`warning`

---

### 3. Uso alto de tarjeta vs ingreso mensual

#### Regla
Comparar el gasto mensual real de tarjeta contra el ingreso mensual del período.

#### Intención
Detectar cuando la tarjeta está consumiendo una parte excesiva del ingreso.

#### Umbrales sugeridos
- `>= 0.8` del ingreso → `warning`
- `>= 1.0` del ingreso → `alert`

#### Ejemplo de copy
- `Estás usando casi todo tu ingreso en la tarjeta`
- `Si este nivel de gasto se mantiene, el próximo mes vas a tener menos margen en efectivo`

---

### 4. Deuda total alta vs ingresos

#### Regla
Comparar la deuda total pendiente de tarjeta contra el ingreso mensual.

#### Intención
Detectar endeudamiento estructural, aunque el gasto del mes no sea alto.

#### Umbrales sugeridos
- deuda > 0.5 ingreso → `warning`
- deuda >= 1.0 ingreso → `alert`

#### Ejemplo de copy
- `Tu deuda de tarjeta representa una parte importante de tus ingresos`
- `Tu deuda de tarjeta equivale a más de un mes de ingresos`

---

### 5. Resumen actual alto vs ingresos

#### Regla
Comparar el monto exigible actual (`statement balance`) contra el ingreso mensual.

#### Intención
Detectar presión actual de corto plazo.

#### Ejemplo de copy
- `El pago de tu tarjeta representa una parte importante de tu ingreso mensual`

#### Severidad sugerida
`warning` o `alert` según umbral

---

### 6. Compromiso importante del próximo mes en cuotas

#### Regla
Calcular cuánto ya está comprometido para el próximo mes por cuotas activas y compararlo contra el ingreso mensual.

#### Intención
Distinguir deuda general de rigidez financiera inmediata.

#### Umbrales sugeridos
- `>= 0.2` → `info`
- `>= 0.35` → `warning`
- `>= 0.5` → `alert`

#### Ejemplo de copy
- `Tenés cuotas activas para el próximo mes`
- `Una parte importante de tus ingresos del próximo mes ya está comprometida en cuotas`
- `Más de la mitad de tus ingresos del próximo mes ya está comprometida en cuotas`

---

### 7. Pago completo de tarjeta

#### Regla
Disparar insight positivo cuando el resumen fue pagado completamente.

#### Intención
Reforzar comportamiento financiero saludable sin volver el módulo exclusivamente negativo.

#### Ejemplo de copy
- `Pagaste tu tarjeta completa este mes`
- `Mantener la deuda controlada te da más margen para arrancar el próximo período`

#### Severidad sugerida
`positive`

---

### 8. Aceleración de gasto con tarjeta

#### Regla
Comparar gasto mensual real de tarjeta contra el del período anterior.

#### Intención
Detectar aumentos relevantes en ritmo de consumo.

#### Nota
Es un insight secundario. No debe desplazar señales críticas como deuda, no pago o compromiso próximo.

---

## Priorización sugerida dentro del módulo `credit_card`

Orden recomendado de importancia:

1. tarjeta no pagada
2. deuda total alta vs ingresos
3. uso alto de tarjeta vs ingresos
4. pago parcial
5. resumen actual alto vs ingresos
6. compromiso importante del próximo mes en cuotas
7. pago completo
8. aceleración de gasto

Esta lista sirve como guía funcional. La implementación puede transformarla en `priority` numérico.

---

## Bajada contextual del módulo `credit_card`

El módulo debe exponer una bajada pedagógica breve.

### Requisitos
- no moralizante
- no agresiva
- útil y clara
- preparada para poder variar por contexto en el futuro

### Primera variante sugerida

> La tarjeta sirve, pero no es plata extra. Es un consumo de hoy que vas a tener que pagar con los ingresos de mañana. Mantener esa deuda en cero, o lo más controlada posible, te ayuda a conservar margen y estabilidad mes a mes.

Esta primera versión puede ser única, siempre que el sistema quede modelado para permitir variantes futuras.

---

## Estructura funcional sugerida

### Motor de insights
- recibe contexto global
- ejecuta generadores por módulo
- consolida resultados
- ordena por prioridad

### Selector para Dashboard
- recibe todos los insights
- devuelve solo el de mayor prioridad

### Página de Insights
- agrupa insights por módulo
- renderiza título del módulo
- renderiza lista de insights
- renderiza bajada contextual del módulo

---

## Dataset demo

El workspace demo debe quedar alineado con el nuevo sistema para que la experiencia inicial tenga valor real.

Idealmente debe sembrar condiciones que permitan ver señales creíbles, por ejemplo:

- consumo en tarjeta relevante
- compra en cuotas activa
- compromiso próximo visible
- eventualmente un caso de pago parcial o saldo pendiente

No se busca exagerar artificialmente el problema, sino mostrar un escenario realista que haga brillar el módulo.

---

## Criterios de aceptación

### Producto
- Insights v2 aporta una lógica distinta y más potente que el MVP anterior
- el Dashboard no se ensucia
- la página de Insights agrega valor real

### Arquitectura
- existe una base modular reutilizable
- el módulo `credit_card` puede convivir luego con nuevos módulos sin reescritura global
- la metadata contextual del módulo está separada de la lógica puntual de los insights

### Dashboard
- si existe empty state, se respeta el empty state
- si no existe empty state, se muestra un único insight principal
- el insight visible es el de mayor prioridad

### Página de Insights
- muestra insights agrupados por módulo
- muestra la bajada contextual del módulo
- soporta múltiples insights del mismo módulo

### Credit Card
- detecta no pago
- detecta pago parcial
- detecta uso alto vs ingresos
- detecta deuda total alta
- detecta presión del resumen actual
- detecta compromiso del próximo mes en cuotas
- puede mostrar al menos una señal positiva (`pago completo`)

### Cuotas
- las compras en cuotas ya implementadas se reflejan correctamente en la lógica del módulo
- el compromiso del próximo mes se calcula en base a cuotas activas
- no se confunde deuda total con gasto mensual actual

### Tono
- el copy es claro, útil y respetuoso
- no hay mensajes moralizantes o punitivos
- la bajada del módulo tiene tono pedagógico y constructivo

---

## Orden sugerido de implementación

### 1
- definir contrato base de insight
- definir tipos y severidades

### 2
- crear motor común de insights
- crear selector de insight principal para Dashboard

### 3
- crear estructura de módulos y metadata contextual

### 4
- implementar módulo `credit_card`
- cerrar métricas base del módulo

### 5
- implementar reglas del módulo
- asignar prioridades

### 6
- renderizar Dashboard con insight principal
- renderizar página de Insights por módulo

### 7
- ajustar dataset demo para disparar señales relevantes

### 8
- validar tono, copy y consistencia general

---

## Definición de terminado

El MVP está completo cuando Encaja cuenta con un sistema de Insights v2 modular, capaz de mostrar un insight principal priorizado en el Dashboard y una página de Insights organizada por módulo, con el módulo `credit_card` funcionando de punta a punta, contemplando deuda, pago, cuotas y compromiso próximo, acompañado por una bajada pedagógica contextual y dejando preparada la base para futuros módulos.

---

## Próximos pasos sugeridos

Después de este MVP, los siguientes incrementos posibles podrían ser:

- módulo `behavior`
- módulo `spending`
- módulo `activity`
- contextualización real de la bajada por módulo
- agrupación visual por severidad
- drill-down desde insight hacia movimientos o tarjetas específicas
- comparación histórica más profunda