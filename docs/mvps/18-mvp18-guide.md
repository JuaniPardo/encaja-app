

# Encaja App — MVP 18

## MVP 18 — Guía de inicio ("Empezar")

---

## Objetivo

Incorporar una guía simple, contextual y accionable dentro de Encaja para ayudar a nuevos usuarios a comenzar a usar la app y formar el hábito de registrar sus finanzas.

La meta de este MVP es reducir fricción inicial, aumentar claridad de uso y mejorar adopción sin convertir la app en un tutorial pesado ni en un módulo educativo largo.

---

## Problema a resolver

Hoy un usuario nuevo puede entrar a Encaja y encontrarse con:

- pantallas vacías
- datos parciales
- dudas sobre por dónde empezar
- poco contexto sobre qué acción conviene hacer primero

Eso genera riesgos claros:

- abandono temprano
- uso superficial
- baja retención
- percepción de complejidad innecesaria

La meta de este MVP es que Encaja no solo muestre información, sino que también acompañe al usuario en sus primeros pasos.

---

## Resultado esperado

Al finalizar este MVP, un usuario debe poder:

- entender rápidamente qué hacer primero
- ver una única acción clara recomendada
- sentir que la app lo guía sin invadirlo
- visualizar progreso básico de adopción
- usar Encaja con menos fricción desde el inicio

---

## Alcance

### Incluye

#### 1. Nueva sección o página `Empezar`
- crear una pantalla dedicada llamada `Empezar`
- integrarla dentro de la navegación principal
- usarla como punto de acompañamiento inicial

#### 2. Estado actual del usuario
- mostrar un mensaje breve según el estado de uso del usuario
- evitar mensajes genéricos o demasiado largos

#### 3. Acción principal
- mostrar una única acción prioritaria por vez
- dirigir al usuario hacia el siguiente paso más útil

#### 4. Insight breve
- mostrar una frase corta, humana y práctica
- usarla como acompañamiento, no como contenido educativo largo

#### 5. Checklist de progreso
- incluir una lista simple de pasos iniciales
- mostrar progreso visible del onboarding funcional

#### 6. Lógica mínima contextual
- usar reglas simples para determinar qué mostrar
- basarse inicialmente en presencia o ausencia de transacciones

---

### NO incluye

Este MVP no debe incluir:

- IA o recomendaciones complejas
- análisis financiero avanzado
- motor sofisticado de coaching
- contenido educativo largo
- múltiples CTAs compitiendo
- gamificación excesiva

---

## Decisiones de producto

### 1. “Empezar” no es un tutorial
No debe sentirse como una guía paso a paso pesada ni como una documentación embebida.

Debe sentirse como:

- orientación práctica
- acompañamiento simple
- siguiente paso claro

### 2. Una sola acción principal
Cada estado debe proponer una sola acción fuerte.

Evitar múltiples decisiones simultáneas.

### 3. Tono cercano
El copy debe ser:

- simple
- humano
- directo
- no técnico
- no agresivo

### 4. Evolución futura
Este módulo debe poder crecer en el futuro hacia:

- sugerencias más inteligentes
- hábitos financieros
- insights de onboarding

Pero en esta etapa debe mantenerse pequeño y claro.

---

## Propuesta de estructura

### 1. Estado actual
Texto dinámico según el momento del usuario.

Ejemplos posibles:

- `Todavía no registraste movimientos`
- `Ya empezaste a registrar tus finanzas`
- `Ya tenés información suficiente para revisar tu balance`

### 2. Acción principal
Una sola acción fuerte.

Ejemplos:

- `Registrá tu primer gasto`
- `Agregá un ingreso`
- `Revisá tu balance`

CTA asociado:

- `Nueva transacción`
- `Ir al tablero`
- `Ver presupuesto`

### 3. Insight breve
Texto corto de acompañamiento.

Ejemplos:

- `Registrar incluso los gastos chicos hace una gran diferencia.`
- `Si sabés en qué gastás, ya estás un paso adelante.`
- `Tu balance muestra lo que queda después de tus decisiones.`

### 4. Checklist de progreso
Lista simple y visible.

Ejemplo inicial:

- [ ] Registrar primer ingreso
- [ ] Registrar 3 gastos
- [ ] Revisar balance del mes

---

## Reglas funcionales

### 1. Usuario sin movimientos
Condición:
- no tiene transacciones registradas

Mostrar:
- estado: `Todavía no registraste movimientos`
- acción principal: `Registrá tu primer gasto`
- CTA: `Nueva transacción`

### 2. Usuario con pocos movimientos
Condición:
- tiene algunas transacciones, pero todavía no un uso mínimo sólido

Mostrar:
- estado: `Ya empezaste`
- acción principal: `Registrá más movimientos`
- CTA: `Nueva transacción`

### 3. Usuario con datos suficientes
Condición:
- ya tiene ingresos y gastos cargados

Mostrar:
- estado: `Ya tenés información útil para empezar a analizar tu mes`
- acción principal: `Revisá tu balance`
- CTA: `Ir al tablero`

### 4. Checklist
El checklist debe reflejar progreso simple y visible.

### 5. Navegación
La acción principal debe llevar directamente al lugar correcto sin pasos intermedios innecesarios.

---

## Propuesta de UX

### 1. Layout
La página debe sentirse liviana.

Debe priorizar:
- mensaje actual
- acción principal
- progreso

No debe parecer un dashboard ni una pantalla de analytics.

### 2. Jerarquía
Orden recomendado:

1. Estado actual
2. Acción principal
3. Insight breve
4. Checklist

### 3. Mobile
En mobile debe ser especialmente clara y rápida de entender.

### 4. Visibilidad
Esta página puede estar siempre disponible, pero debe tener especial valor al inicio del uso.

---

## Criterios de aceptación

### Producto
- el usuario entiende qué hacer en pocos segundos
- la app deja de sentirse pasiva al inicio
- mejora el onboarding sin necesidad de tutorial explícito

### UX
- hay una sola acción principal clara
- el contenido se siente humano y útil
- no hay sobrecarga visual ni textual

### Técnica
- existe lógica mínima para mostrar estados distintos según el uso
- la pantalla puede crecer después sin rehacerse completa

### Adopción
- mejora la claridad de uso en usuarios nuevos
- aumenta la probabilidad de que registren sus primeros movimientos

---

## Orden de implementación

### 1
- crear nueva página `Empezar`

### 2
- integrarla en navegación principal

### 3
- construir estructura visual base

### 4
- implementar lógica simple por estados

### 5
- conectar CTAs a rutas reales

### 6
- pulir copy y consistencia visual

---

## Definición de terminado

El MVP está completo cuando Encaja incorpora una página `Empezar` clara, simple y accionable, capaz de orientar a usuarios nuevos según su estado actual, mostrar una única acción relevante y acompañar el arranque de uso sin convertir la experiencia en un tutorial pesado.

---

## Próximos pasos sugeridos

Después de este MVP, los siguientes incrementos posibles podrían ser:

- sugerencias más inteligentes basadas en comportamiento real
- checklist dinámico más completo
- recomendaciones suaves estilo coach financiero
- onboarding más personalizado según tipo de usuario