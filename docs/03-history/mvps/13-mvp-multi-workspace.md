

# Encaja App — MVP 13

## MVP 13 — Multi-workspace + estructura de suscripciones (sin pagos)

---

## Objetivo

Preparar a Encaja para evolucionar de una app de uso individual con un solo workspace a un producto multi-workspace y listo para monetización futura, sin implementar todavía cobros reales.

Este MVP introduce dos capacidades estratégicas:

1. permitir que un usuario pueda tener más de un workspace
2. dejar instalada la estructura base de suscripciones y planes, aunque por ahora todo quede desbloqueado y funcionando como si cada workspace estuviera en un plan premium

---

## Problema a resolver

Hasta ahora, Encaja asume implícitamente una experiencia de:

- un usuario
- un workspace activo
- sin distinción real de plan

Eso funcionó bien para construir el producto, pero limita tres objetivos importantes:

- usar Encaja para distintos ámbitos independientes (hogar, consultorio, negocio, etc.)
- preparar el terreno para compartir workspaces más adelante
- dejar la monetización estructuralmente lista sin tener que refactorizar todo cuando llegue el momento de cobrar

La meta de este MVP es dar el primer paso serio hacia Encaja como producto escalable.

---

## Resultado esperado

Al finalizar este MVP, un usuario debe poder:

- tener más de un workspace
- cambiar de un workspace a otro desde la interfaz
- trabajar siempre sobre un workspace activo claramente definido
- contar con una estructura interna de planes/suscripciones ya modelada
- mantener todas las funcionalidades desbloqueadas por ahora
- dejar el sistema listo para introducir restricciones o pagos más adelante sin reescribir la lógica central

---

## Alcance

### Incluye

#### 1. Multi-workspace real
- dejar de asumir que el usuario tiene un único workspace
- permitir múltiples workspaces por usuario
- introducir selector de workspace en la interfaz
- definir claramente el concepto de workspace activo

#### 2. Contexto de workspace activo
- toda pantalla y consulta debe operar sobre un workspace activo
- el cambio de workspace debe reflejarse en toda la experiencia
- la navegación entre workspaces debe ser clara y predecible

#### 3. Estructura de suscripciones
- incorporar una nueva entidad o capa de `subscriptions`
- asociar el plan al `workspace`, no al usuario
- preparar al sistema para distinguir planes en el futuro

#### 4. Feature flags por plan
- introducir una forma centralizada de preguntar si un workspace puede usar una feature
- evitar hardcodear condiciones futuras de monetización en la UI o en la lógica dispersa

#### 5. Default temporal
- por ahora, todos los workspaces deben comportarse como si estuvieran en plan premium
- no se implementa todavía cobro real ni bloqueo efectivo de funcionalidades

---

### NO incluye

Este MVP no debe incluir:

- integración con Stripe
- precios reales
- checkout
- billing portal
- webhooks de pago
- trials
- bloqueo efectivo de funcionalidades por plan
- compartir workspaces con otros usuarios
- linking entre workspaces

Todo eso queda para MVPs posteriores.

---

## Decisiones de producto

### 1. La suscripción es por workspace
La unidad de monetización futura será el `workspace`, no el usuario.

Esto permite:

- que un usuario tenga más de un workspace con distinto plan en el futuro
- compartir workspaces sin duplicar cobro por usuario
- escalar a escenarios de pareja, familia, consultorio o negocio

### 2. Todo premium por ahora
Aunque se modele la estructura de suscripciones, en esta etapa todas las funcionalidades deben seguir disponibles.

El objetivo no es monetizar ya, sino dejar lista la arquitectura correcta.

### 3. Sin hacks
No se deben introducir soluciones temporales difíciles de mantener. La capa de planes debe existir como concepto real desde ahora, aunque todavía no cobre.

### 4. Workspace nombrable
Cada workspace debe tener una identidad clara para el usuario.

Para eso:

- `name` = visible, humano, editable
- `slug` = técnico, estable, usable en URL

El usuario debe ver y reconocer el `name`.
La aplicación debe navegar y resolver contexto usando el `slug`.

---

## Propuesta de modelo

### 1. Suscripciones
Crear una entidad `subscriptions` con campos mínimos como:

- `id`
- `workspace_id`
- `plan`
- `status`
- `created_at`
- `updated_at`

Valores iniciales sugeridos:

- `plan`: `free`, `pro`, `premium`
- `status`: `active`

### 2. Estado inicial
Cuando se cree un workspace nuevo:

- se crea también una suscripción asociada
- por ahora se asigna:
  - `plan = premium`
  - `status = active`

### 3. Feature flags
Definir una capa centralizada del tipo:

- `canUseFeature(workspace, feature)`

Ejemplos de features futuras:

- `multi_workspace`
- `workspace_sharing`
- `workspace_linking`
- `advanced_insights`

### 4. Activación futura de billing
Definir una bandera global o equivalente para permitir que la capa exista sin bloquear nada todavía.

Ejemplo conceptual:

- `BILLING_ENABLED = false`

Mientras esa bandera esté desactivada:

- todas las features deben comportarse como habilitadas
- el sistema sigue usando la estructura real de planes sin cobrar todavía

---

## Reglas funcionales

### 1. Usuario y workspaces
Un usuario puede pertenecer a múltiples workspaces.

Esto ya está parcialmente soportado por `workspace_members`, pero ahora debe reflejarse también en la lógica y en la interfaz.

### 2. Workspace activo
Debe existir un único workspace activo por sesión o contexto de uso.

Toda la app debe leer y escribir siempre contra ese workspace activo.

### 3. Persistencia del workspace activo
La fuente principal del workspace activo debe ser la URL.

La aplicación debe usar rutas con contexto de workspace, por ejemplo mediante `slug`.

Además, debe recordarse la última selección del usuario en almacenamiento local para mejorar la UX.

Regla recomendada:

- fuente visible del contexto = URL
- preferencia recordada = localStorage

### 4. Cambio de workspace
El cambio de workspace debe:

- ser explícito
- reflejarse en navegación y datos visibles
- actualizar el contexto activo
- evitar estados ambiguos

### 5. Suscripción
Cada workspace debe tener una suscripción asociada.

### 6. Plan activo
Aunq ue exista el concepto de plan, en esta etapa no debe bloquear todavía funcionalidades.

### 7. Futuro de monetización
La lógica nueva debe dejar preparado el sistema para que, más adelante, ciertas features dependan del plan sin necesidad de reescribir toda la arquitectura.

---

## Propuesta de experiencia de usuario

### 1. Selector de workspace
Agregar un selector visible y claro desde la UI.

Opciones posibles:

- dropdown en header
- selector al lado del nombre del workspace
- menú contextual de cambio rápido

El selector debe mostrar siempre el `name` del workspace.

### 2. Rutas con contexto
La app debe usar rutas con contexto de workspace, por ejemplo:

- `/app/[workspaceSlug]/dashboard`
- `/app/[workspaceSlug]/presupuesto`
- `/app/[workspaceSlug]/transacciones`

Esto permite:

- deep linking
- claridad de contexto
- navegación robusta

### 3. Memoria de último workspace
Si el usuario entra a una ruta genérica sin contexto, la app puede resolver el último workspace activo recordado.

### 4. Creación de nuevo workspace
Permitir crear un nuevo workspace desde la interfaz.

Ejemplos de uso:

- Hogar
- Consultorio
- Personal
- Negocio

### 5. Comportamiento inicial
Si el usuario solo tiene un workspace:

- la UX no debe volverse compleja innecesariamente
- el selector puede ser simple o discreto

### 6. Preparación para upgrade futuro
Más adelante, si el plan no habilita cierta funcionalidad, el sistema ya debe saber cómo evaluarlo.

No hace falta todavía mostrar paywalls reales, pero sí conviene dejar la lógica bien separada.

---

## Criterios de aceptación

### Multi-workspace
- un usuario puede tener más de un workspace
- puede cambiar entre ellos sin fricción
- la app siempre sabe cuál es el workspace activo

### Suscripciones
- cada workspace tiene una suscripción asociada
- existe una estructura clara de plan y estado
- la lógica de planes no está hardcodeada de forma dispersa

### Técnica
- la lógica para saber si una feature está disponible queda centralizada
- el sistema queda preparado para cobrar más adelante sin grandes refactors
- el contexto del workspace activo vive principalmente en la URL
- la preferencia del último workspace puede recordarse sin ser la fuente única de verdad

### UX
- el cambio de workspace es claro
- la experiencia no se vuelve más compleja de lo necesario
- si el usuario tiene un solo workspace, la UI sigue siendo simple
- los workspaces son reconocibles por nombre

### Producto
- Encaja queda preparado para futuros MVPs de:
  - compartir workspaces
  - linking entre workspaces
  - monetización por plan

---

## Orden de implementación

### 1
- revisar y ajustar el soporte real de múltiples workspaces
- eliminar supuestos de un solo workspace por usuario

### 2
- implementar selector y contexto de workspace activo
- mover el contexto principal a la URL usando `slug`
- agregar persistencia auxiliar del último workspace en localStorage

### 3
- crear entidad `subscriptions`

### 4
- asociar suscripción al crear workspace

### 5
- introducir capa centralizada de feature flags

### 6
- dejar todo funcionando con acceso completo temporal (`premium` por defecto y billing desactivado)

### 7
- pulir UX y consistencia visual

---

## Definición de terminado

El MVP está completo cuando Encaja permite múltiples workspaces por usuario, opera siempre sobre un workspace activo bien definido, usa el `slug` como contexto de navegación, recuerda el último workspace para mejorar la UX y tiene una estructura de suscripciones y planes ya modelada por workspace, aunque por ahora todas las funcionalidades sigan desbloqueadas y no exista cobro real.

---

## Próximos pasos sugeridos

Después de este MVP, los siguientes incrementos naturales podrían ser:

- MVP 14 — compartir workspace con otros usuarios
- MVP 15 — linking entre workspaces con visibilidad resumida
- integración futura con pasarela de pagos
- activación real de límites por plan