

# Encaja App — MVP 14

## MVP 14 — Compartir workspace con otros usuarios

---

## Objetivo

Permitir que un workspace de Encaja pueda compartirse con otros usuarios, de forma controlada y escalable, para habilitar casos de uso colaborativos como pareja, familia, consultorio o negocio.

Este MVP se enfoca en introducir colaboración real sobre un mismo workspace, aprovechando la base multi-workspace ya preparada en MVP 13 y el hardening realizado en MVP 13.1.

---

## Problema a resolver

Hasta ahora, cada workspace funciona en la práctica como una unidad individual. Aunque el modelo ya contempla membresías, la experiencia de compartir todavía no está resuelta como producto.

Eso limita escenarios muy valiosos, por ejemplo:

- una pareja que administra juntos los gastos del hogar
- un consultorio donde más de una persona necesita ver o registrar movimientos
- un negocio pequeño con más de un operador

La meta de este MVP es que un workspace pueda tener múltiples personas trabajando sobre la misma información, con permisos claros y sin ambigüedad.

---

## Resultado esperado

Al finalizar este MVP, un usuario debe poder:

- invitar a otra persona a un workspace
- ver qué miembros tiene ese workspace
- distinguir claramente quién es owner y quién es member
- remover miembros o revocar acceso si corresponde
- trabajar en un workspace compartido sin romper la experiencia actual

---

## Alcance

### Incluye

#### 1. Gestión de miembros del workspace
- listado de miembros del workspace
- visualización de rol por miembro
- acciones de gestión según permisos

#### 2. Invitación a workspace
- permitir invitar a otro usuario por email o flujo equivalente
- resolver incorporación de usuarios existentes y no existentes según el camino técnico elegido

#### 3. Roles básicos
- soportar al menos:
  - `owner`
  - `member`

#### 4. Permisos
- definir claramente qué puede hacer un `owner`
- definir claramente qué puede hacer un `member`
- asegurar que el sistema no dependa de supuestos ambiguos

#### 5. UX de colaboración
- incorporar una forma clara de entrar y trabajar en workspaces compartidos
- mostrar membresía de manera entendible en la UI

---

### NO incluye

Este MVP no debe incluir:

- linking entre workspaces
- monetización activa
- roles avanzados complejos
- comentarios internos
- auditoría avanzada
- permisos granulares por módulo
- notificaciones sofisticadas

Eso queda para etapas posteriores.

---

## Decisiones de producto

### 1. El workspace sigue siendo la unidad principal
Todo se comparte a nivel de workspace completo.

No introducir todavía visibilidad parcial por módulo o por categoría.

### 2. Roles mínimos y claros
En esta etapa, mantener el modelo simple:

- `owner`
- `member`

Evitar complejidad innecesaria con roles intermedios si todavía no aportan suficiente valor.

### 3. Owner como responsable principal
El `owner` conserva control estructural sobre el workspace.

### 4. Member como colaborador operativo
El `member` puede usar el workspace compartido dentro de límites claros, pero no debe poder realizar operaciones de administración estructural reservadas al owner.

---

## Reglas funcionales

### 1. Owner
El owner debe poder:

- ver miembros
- invitar miembros
- remover miembros
- gestionar configuración estructural del workspace

### 2. Member
El member debe poder:

- acceder al workspace compartido
- ver datos del workspace según el alcance colaborativo definido
- operar sobre los módulos habilitados para uso normal

El member no debe poder:

- cambiar ownership
- ejecutar bootstrap estructural
- modificar configuraciones críticas si eso es exclusivo del owner
- gestionar suscripciones o billing futuro

### 3. Membresías
La relación entre usuario y workspace sigue viviendo en `workspace_members`.

### 4. Invitación
Definir un flujo claro para resolver invitaciones.

Opciones válidas para esta etapa:

- invitación por email con aceptación posterior
- alta simple de miembro existente por email si ya tiene cuenta

La implementación puede elegir el camino más directo y robusto, siempre que quede escalable.

### 5. Acceso
Un usuario solo puede acceder a un workspace si existe una membresía válida para ese usuario.

### 6. Workspace activo
Si un usuario pertenece a varios workspaces propios o compartidos, todos deben integrarse naturalmente con el selector de workspace ya definido en MVP 13.

---

## Propuesta de experiencia de usuario

### 1. Pantalla o sección de miembros
Agregar una sección dentro de configuración del workspace o lugar equivalente para:

- listar miembros
- mostrar rol
- invitar nuevo miembro
- remover acceso

### 2. Invitación
Propuesta simple:

- campo email
- acción `Invitar`

### 3. Selector de workspace
Los workspaces compartidos deben aparecer en el selector igual que los propios, con nombre claro.

Opcionalmente se puede indicar si el usuario es:
- owner
- member

### 4. Feedback claro
La UI debe dejar claro:

- en qué workspace está el usuario
- si es owner o member
- qué acciones administrativas puede o no puede hacer

---

## Criterios de aceptación

### Colaboración
- un workspace puede tener más de un usuario
- los miembros se ven correctamente en la UI
- la invitación o incorporación de miembros funciona de forma consistente

### Roles
- owner y member se distinguen claramente
- las acciones críticas están protegidas
- member no puede ejecutar operaciones reservadas al owner

### UX
- workspaces compartidos aparecen correctamente en el selector
- la experiencia sigue siendo simple aunque haya colaboración
- el usuario entiende el contexto del workspace compartido

### Técnica
- el sistema usa `workspace_members` como fuente de verdad
- los permisos no dependen de hacks de frontend
- la base queda lista para crecer a roles más finos más adelante si fuera necesario

---

## Orden de implementación

### 1
- revisar y cerrar reglas de permisos owner/member

### 2
- implementar gestión de miembros en backend

### 3
- implementar flujo de invitación o alta de miembros

### 4
- integrar workspaces compartidos al selector

### 5
- reforzar protección de acciones críticas

### 6
- pulir UX y copy para colaboración

---

## Definición de terminado

El MVP está completo cuando Encaja permite compartir un workspace con otros usuarios de forma clara y segura, distinguiendo al menos entre owner y member, integrando esa colaboración con el selector de workspaces y protegiendo correctamente las acciones estructurales.

---

## Próximos pasos sugeridos

Después de este MVP, los siguientes incrementos naturales podrían ser:

- MVP 15 — linking entre workspaces con visibilidad resumida
- roles más granulares si hicieran falta
- invitaciones más sofisticadas
- límites por plan cuando se active monetización