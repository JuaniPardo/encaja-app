

# Encaja App — MVP 15

## MVP 15 — Linking entre workspaces con visibilidad resumida

---

## Objetivo

Permitir que un workspace pueda vincularse con otro workspace para ver un resumen financiero agregado, sin exponer el detalle interno de transacciones, categorías ni configuración.

Este MVP busca habilitar escenarios como:

- un usuario que quiere ver el resumen de varios workspaces propios
- una pareja con workspaces separados que quieren compartir solo una vista resumida
- un usuario que quiere incorporar el resultado de otro workspace como referencia financiera de alto nivel

---

## Problema a resolver

Encaja ya permite:

- múltiples workspaces por usuario
- workspaces compartidos entre miembros
- dashboard, insights, presupuesto y transacciones por workspace

Pero todavía falta resolver un caso valioso:

**ver otro workspace como una fuente resumida de información, sin mezclar ni compartir todo su detalle operativo.**

Hoy el sistema trata a cada workspace como una unidad aislada. Eso es correcto para operación, pero limita análisis agregados entre espacios independientes.

La meta de este MVP es introducir una relación explícita entre workspaces que permita ver un resumen financiero externo sin recurrir a hacks, transacciones ficticias ni mezclas incorrectas de conceptos.

---

## Resultado esperado

Al finalizar este MVP, un usuario debe poder:

- vincular un workspace con otro workspace compatible
- ver el resumen financiero del workspace vinculado desde el workspace origen
- distinguir claramente que se trata de un resumen externo y no de una transacción ni de un medio de pago interno
- mantener separados los datos operativos y detallados de cada workspace
- respetar restricciones de moneda y permisos

---

## Alcance

### Incluye

#### 1. Relación explícita entre workspaces
- introducir una entidad específica para modelar el vínculo entre workspaces
- evitar reutilizar `payment_methods` o `transactions` para representar este caso

#### 2. Visibilidad resumida
- mostrar, como mínimo, información agregada del workspace vinculado
- mantener el detalle fuera de alcance en esta etapa

#### 3. Reglas de compatibilidad
- permitir linking solo entre workspaces con la misma moneda
- validar permisos antes de crear el vínculo

#### 4. UI básica de gestión
- crear, listar y desactivar vínculos entre workspaces
- mostrar el vínculo de forma clara en la interfaz

#### 5. Integración visual
- definir dónde vive el resumen vinculado dentro del producto
- dejar clara la diferencia entre:
  - datos propios del workspace actual
  - resumen externo de otro workspace

---

### NO incluye

Este MVP no debe incluir:

- acceso al detalle de transacciones del workspace vinculado
- mezcla de categorías o presupuestos entre workspaces
- consolidación contable completa
- multi-moneda
- conversión de moneda
- reglas complejas de ownership financiero
- linking automático basado en membresías implícitas

---

## Decisiones de producto

### 1. No usar hacks
El resumen de otro workspace **no** debe modelarse como:

- una transacción ficticia
- un `payment_method`
- una cuenta artificial

Debe existir una relación propia entre workspaces.

### 2. El detalle sigue aislado
El vínculo solo expone un nivel de lectura resumido.

No habilita ver:
- transacciones
- categorías
- medios de pago
- configuraciones

### 3. Misma moneda obligatoria
Los vínculos solo pueden existir entre workspaces con la misma `currency_code`.

Esto evita introducir conversión monetaria, ambigüedad y deuda técnica prematura.

### 4. Resumen como entidad externa
El workspace vinculado debe percibirse en UX como una **fuente externa resumida**, no como parte nativa del mismo ledger del workspace actual.

---

## Propuesta de modelo

### 1. Nueva entidad
Crear una entidad específica, por ejemplo:

- `workspace_links`

Campos sugeridos:

- `id`
- `source_workspace_id`
- `target_workspace_id`
- `visibility_mode`
- `is_active`
- `created_by`
- `created_at`
- `updated_at`

### 2. Visibility mode inicial
En esta etapa, el valor principal será:

- `summary_only`

Esto deja el modelo preparado para crecer, aunque hoy solo exista una modalidad.

### 3. Restricciones sugeridas
- no permitir self-link (`source_workspace_id != target_workspace_id`)
- no permitir duplicados activos para la misma pareja de workspaces
- no permitir linking entre monedas distintas

---

## Reglas funcionales

### 1. Acceso y creación
El vínculo entre workspaces debe crearse solo si el usuario tiene permisos válidos sobre el workspace origen y sobre el workspace destino, según la regla que elijas para esta etapa.

### 2. Regla mínima recomendada
Para mantenerlo simple y seguro al inicio:

- solo un `owner` puede crear vínculos desde su workspace
- el usuario debe tener acceso válido al workspace destino

### 3. Qué muestra el resumen
En esta etapa, el resumen de un workspace vinculado debería incluir algo como:

- ingresos del período
- gastos del período
- ahorro del período
- balance del período

Opcionalmente:
- nombre del workspace vinculado
- período mostrado

### 4. Qué no muestra
No debe mostrar:
- detalle por categoría
- detalle por transacción
- configuración interna
- miembros del workspace destino

### 5. Integridad conceptual
El resumen vinculado no debe contaminar:
- tablas de transacciones
- cálculos base del presupuesto local
- saldos de `payment_methods`

Debe verse como una capa separada de lectura agregada.

---

## Propuesta de experiencia de usuario

### 1. Pantalla o sección de linking
Agregar una sección de gestión, probablemente dentro de configuración avanzada del workspace o un lugar equivalente, para:

- listar vínculos existentes
- crear nuevo vínculo
- desactivar vínculo

### 2. Flujo de creación
Propuesta simple:

- seleccionar workspace destino
- validar misma moneda
- crear vínculo

### 3. Visualización en el producto
Opciones válidas para esta etapa:

- bloque específico en Dashboard
- bloque específico en Insights
- sección dedicada de resumen externo

La decisión debe respetar esta regla:

- el resumen externo debe verse claro y separado
- no debe ensuciar el dashboard principal ni confundirse con datos propios

### 4. Copy sugerido
La UI debe dejar claro que se trata de un resumen externo.

Ejemplos:

- `Workspace vinculado`
- `Resumen externo`
- `Vista resumida de otro workspace`

---

## Criterios de aceptación

### Producto
- un workspace puede vincularse con otro de forma explícita
- el usuario entiende que el vínculo muestra solo resumen
- no hay mezcla confusa entre datos propios y datos externos

### Reglas
- no se puede vincular workspaces de distinta moneda
- no se puede vincular un workspace consigo mismo
- no se generan duplicados activos innecesarios

### Seguridad
- solo usuarios con permisos válidos pueden crear o gestionar vínculos
- el detalle del workspace destino no queda expuesto por error

### UX
- el flujo de creación es claro
- el resumen vinculado se ve diferenciado del resto
- el usuario entiende qué está viendo y de dónde viene

### Técnica
- el modelo introduce una entidad propia (`workspace_links` o equivalente)
- no reutiliza entidades existentes de forma incorrecta
- la base queda lista para crecer a relaciones más ricas más adelante

---

## Orden de implementación

### 1
- definir entidad `workspace_links`
- crear tabla y restricciones mínimas

### 2
- definir reglas de permisos para creación y lectura

### 3
- implementar CRUD básico de vínculos

### 4
- construir resumen agregado del workspace destino

### 5
- integrar visualización en la UI de forma separada y clara

### 6
- pulir copy, UX y consistencia visual

---

## Definición de terminado

El MVP está completo cuando Encaja permite vincular workspaces compatibles entre sí, mostrar un resumen financiero agregado del workspace vinculado y mantener una separación clara entre ese resumen externo y los datos operativos propios del workspace actual, sin hacks ni mezcla de conceptos.

---

## Próximos pasos sugeridos

Después de este MVP, los siguientes incrementos posibles podrían ser:

- mayor profundidad de visibilidad resumida
- vínculos con reglas más finas de permisos
- consolidación de varios workspaces en una vista superior
- monetización real de multi-workspace, sharing y linking