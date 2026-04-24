

# Encaja App — MVP 19.A

## MVP 19.A — Feedback del usuario en base de datos (sin webhook)

---

## Objetivo

Permitir que los usuarios envíen feedback directamente desde la app para reportar errores, sugerir mejoras o comunicar dudas, dejando ese feedback persistido en base de datos con contexto suficiente para que el developer pueda revisarlo manualmente durante la etapa beta.

Este MVP se enfoca únicamente en la captura y persistencia del feedback. No incluye todavía notificaciones automáticas, webhooks ni panel interno de administración.

---

## Problema a resolver

Hoy Encaja no tiene un canal directo y estructurado para recibir feedback desde el uso real.

Eso genera varios problemas:

- los errores pueden quedar silenciosos
- las sugerencias dependen de conversaciones informales
- no hay contexto suficiente para reproducir un problema
- el desarrollo se apoya demasiado en suposiciones y no en uso real

La meta de este MVP es abrir un canal simple, rápido y de baja fricción para capturar feedback de beta testers y usuarios reales.

---

## Resultado esperado

Al finalizar este MVP, un usuario debe poder:

- enviar feedback desde la app en pocos segundos
- elegir el tipo de feedback
- escribir un mensaje breve
- enviar ese feedback sin salir del flujo principal

Y el developer debe poder:

- encontrar ese feedback en Supabase
- revisar quién lo envió
- saber desde qué workspace y qué pantalla se originó
- usar esa información para corregir bugs o priorizar mejoras

---

## Alcance

### Incluye

#### 1. Tabla `feedback` en base de datos
Crear una tabla específica para persistir feedback enviado desde la app.

Campos mínimos sugeridos:

- `id`
- `user_id`
- `workspace_id`
- `type`
- `message`
- `route`
- `created_at`

Campo opcional recomendado desde esta etapa:

- `status` (`new`, `reviewed`, `closed`)

#### 2. Captura de feedback desde la app
Agregar una forma visible y razonable de enviar feedback.

Ubicaciones válidas para esta etapa:

- desde Settings
- desde una sección dedicada dentro de Settings
- desde una opción discreta del layout si encaja bien con la UX actual

#### 3. Modal o pantalla de feedback
Permitir al usuario completar un formulario simple con:

- tipo de feedback
- mensaje

#### 4. Contexto automático
La app debe adjuntar automáticamente al feedback:

- usuario actual
- workspace actual
- ruta actual
- timestamp

#### 5. Confirmación al usuario
Después de enviar, mostrar confirmación clara y breve.

Ejemplo:

- `Gracias por tu feedback 🙌`

---

### NO incluye

Este MVP no debe incluir:

- webhooks
- Slack / Discord / email automático
- panel interno de administración
- respuestas al usuario dentro de la app
- automatización de clasificación o priorización
- captura automática de screenshots
- logging automático de errores técnicos

Eso puede resolverse en una etapa posterior.

---

## Decisiones de producto

### 1. Feedback manual del usuario
Este MVP cubre solo feedback intencional enviado por el usuario.

Ejemplos:

- `encontré un error`
- `esto podría mejorar`
- `me confundí acá`

### 2. No mezclar feedback con error logging
En esta etapa no se deben mezclar:

- feedback manual del usuario
- errores técnicos automáticos del sistema

Eso requiere una capa distinta (`app_errors`, `error_events` o equivalente) y queda fuera de alcance por ahora.

### 3. Sin roles globales de plataforma
No hace falta introducir todavía roles tipo `platform_admin` dentro de la app para leer el feedback.

En esta etapa, el feedback se revisa manualmente directamente desde Supabase Table Editor.

### 4. Contexto automático siempre
El usuario no debería tener que explicar en qué pantalla estaba.

La app ya debe guardar ese contexto automáticamente.

### 5. Baja fricción
Es preferible recibir feedback breve e imperfecto a no recibir nada.

---

## Propuesta de modelo de datos

### Tabla `feedback`

Campos sugeridos:

- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null`
- `workspace_id uuid null`
- `type text not null`
- `message text not null`
- `route text null`
- `status text not null default 'new'`
- `created_at timestamptz not null default now()`

### Valores sugeridos para `type`

- `bug`
- `suggestion`
- `question`
- `other`

### Valores sugeridos para `status`

- `new`
- `reviewed`
- `closed`

### Relaciones

- `user_id` → `profiles.id`
- `workspace_id` → `workspaces.id` (nullable si hiciera falta soporte futuro fuera de contexto)

---

## Reglas funcionales

### 1. Envío
El usuario debe poder enviar feedback en menos de 10 segundos.

### 2. Tipo
El usuario puede elegir el tipo de feedback desde opciones predefinidas.

### 3. Mensaje
El mensaje debe ser obligatorio.

### 4. Contexto
La ruta actual, el usuario y el workspace deben guardarse automáticamente.

### 5. Persistencia
Cada envío exitoso debe quedar almacenado en la tabla `feedback`.

### 6. Confirmación
Después de enviar, el usuario debe ver una confirmación simple.

---

## Propuesta de UX

### 1. Punto de entrada
Lugar recomendado inicial:

- Settings → sección `Feedback`

Esto mantiene la funcionalidad accesible sin recargar otras pantallas.

### 2. UI mínima
Formulario simple con:

- `Tipo` (select)
- `Mensaje` (textarea)
- botón `Enviar feedback`

### 3. Copy sugerido

Título:
- `¿Encontraste algo que no funciona bien?`

Subtítulo breve:
- `Tu feedback me ayuda a mejorar Encaja.`

Placeholder:
- `Contame qué pasó o qué te gustaría mejorar...`

### 4. Confirmación
Mostrar toast o mensaje breve:

- `Gracias por tu feedback 🙌`

---

## Criterios de aceptación

### Producto
- existe un canal claro para enviar feedback desde la app
- el flujo no genera fricción innecesaria

### UX
- el envío toma pocos segundos
- el formulario es claro y breve
- el usuario recibe confirmación visible

### Técnica
- la tabla `feedback` existe en Supabase
- el feedback se guarda con contexto útil
- el developer puede revisar el feedback manualmente desde Supabase

### Beta
- queda habilitado un loop real de mejora con usuarios de prueba
- los bugs y sugerencias dejan de depender de mensajes informales fuera de la app

---

## Orden de implementación

### 1
- crear migración SQL para la tabla `feedback`

### 2
- definir tipos y constraints

### 3
- construir servicio de creación de feedback

### 4
- construir modal o pantalla de feedback

### 5
- integrar captura de contexto automático

### 6
- agregar confirmación visual al enviar

---

## Definición de terminado

El MVP está completo cuando Encaja permite a cualquier usuario enviar feedback manual desde la app, el feedback queda almacenado en Supabase con contexto suficiente para revisión manual y el sistema habilita un ciclo real de mejora basado en uso beta, sin incorporar todavía webhooks ni herramientas de administración internas.

---

## Próximos pasos sugeridos

Después de este MVP, los siguientes incrementos posibles podrían ser:

- MVP 19.B — logging automático de errores técnicos
- webhook a email / Slack / Discord
- panel interno para revisar feedback dentro de la app
- clasificación y priorización básica