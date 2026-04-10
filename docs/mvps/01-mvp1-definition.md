

# Encaja App — MVP 1 Definition

## Fecha
2026-04-10

## Estado
Draft

## Autor
Juan Pardo

---

## 1. Nombre del MVP

**MVP 1 — Base operativa inicial**

---

## 2. Objetivo

Construir la primera versión funcional de Encaja con autenticación, bootstrap automático del workspace y administración de catálogos base del sistema.

Este MVP debe validar la arquitectura elegida y dejar lista una base sólida para los siguientes módulos del producto.

---

## 3. Resultado esperado

Al finalizar este MVP, un usuario debe poder:

- registrarse e iniciar sesión
- entrar a la aplicación con una sesión persistida
- contar automáticamente con un workspace inicial
- administrar categorías
- administrar medios de pago
- editar la configuración general del workspace

---

## 4. Alcance

### 4.1 Incluye

#### Autenticación
- registro con email y password
- login con email y password
- logout
- protección de rutas autenticadas
- sesión persistida

#### Bootstrap inicial
Al registrarse por primera vez, el sistema debe crear automáticamente:
- profile
- workspace inicial
- workspace_members con rol `owner`
- workspace_settings inicial

#### Layout base
- app shell
- navegación principal
- página Dashboard como placeholder útil
- páginas para Categorías, Medios de pago y Settings

#### Categorías
- listado
- alta
- edición
- activación / desactivación

#### Medios de pago
- listado
- alta
- edición
- activación / desactivación

#### Settings del workspace
- edición de parámetros base

---

### 4.2 No incluye

Este MVP no debe incluir:

- presupuestos mensuales
- transacciones
- dashboard con lógica real
- gráficos
- invitación de miembros
- selector de múltiples workspaces
- lógica compleja de tarjetas
- reglas avanzadas de imputación temporal

---

## 5. Pantallas incluidas

### 5.1 Login
Campos:
- email
- password

Acciones:
- iniciar sesión
- navegar a registro

### 5.2 Registro
Campos:
- nombre opcional
- email
- password

Acciones:
- crear usuario
- bootstrap inicial
- redirigir al área autenticada

### 5.3 Dashboard
- placeholder inicial
- mensaje de bienvenida
- accesos rápidos a módulos base
- estado vacío útil

### 5.4 Categorías
- listado de categorías del workspace
- filtro simple por tipo o estado
- formulario de alta/edición

### 5.5 Medios de pago
- listado de medios de pago del workspace
- formulario de alta/edición

### 5.6 Settings
- formulario para editar configuración general del workspace

---

## 6. Entidades involucradas

Este MVP usa las siguientes entidades del modelo de datos:

- profiles
- workspaces
- workspace_members
- workspace_settings
- categories
- payment_methods

Todavía no utiliza:

- budget_periods
- budget_items
- transactions

---

## 7. Reglas funcionales del MVP

### 7.1 Usuario nuevo
Cuando un usuario se registra por primera vez:
- se crea su profile
- se crea un workspace inicial
- se lo vincula como `owner`
- se crean settings por defecto

### 7.2 Categorías
- el nombre es obligatorio
- el tipo es obligatorio
- no puede repetirse dentro del mismo workspace
- `is_active` debe iniciar en `true`

### 7.3 Medios de pago
- el nombre es obligatorio
- el tipo es obligatorio
- `is_active` debe iniciar en `true`

### 7.4 Settings
Campos mínimos:
- `start_year`
- `savings_rate_mode`
- `deferred_income_enabled`
- `deferred_income_day`
- `currency_code`

Regla:
- `deferred_income_day` solo es obligatorio si `deferred_income_enabled = true`

---

## 8. Criterios de aceptación

### Auth
- el usuario puede registrarse
- el usuario puede iniciar sesión
- las rutas privadas quedan protegidas
- la sesión persiste correctamente

### Bootstrap
- al registrarse se crean profile, workspace, membership y settings
- el usuario queda asociado como `owner`

### Categorías
- se pueden listar, crear, editar y desactivar
- se impide duplicar nombres dentro del mismo workspace

### Medios de pago
- se pueden listar, crear, editar y desactivar
- se guardan correctamente asociados al workspace

### Settings
- se pueden consultar y actualizar
- se persisten correctamente

### UX
- existe navegación base clara
- los formularios validan errores
- hay feedback de éxito y error
- los estados vacíos son entendibles

---

## 9. Orden técnico recomendado

### Etapa 1
- setup de cliente Supabase
- auth
- rutas protegidas
- layout base

### Etapa 2
- bootstrap inicial del usuario y workspace

### Etapa 3
- módulo Categorías

### Etapa 4
- módulo Medios de pago

### Etapa 5
- módulo Settings

---

## 10. Riesgos a evitar

- meter dashboard real demasiado pronto
- crear tablas no usadas aún
- duplicar lógica de bootstrap entre cliente y servidor
- mezclar datos globales con datos del workspace
- sobrecargar el MVP con features futuras

---

## 11. Definición de terminado

Este MVP se considera terminado cuando un usuario nuevo puede crear su cuenta, entrar a la app, disponer automáticamente de su workspace inicial y operar correctamente sobre categorías, medios de pago y settings desde una interfaz protegida y persistida.

---

## 12. Próximo paso después del MVP 1

Una vez completado este MVP, el siguiente incremento recomendado es:

**MVP 2 — Presupuesto mensual**

- creación y edición de presupuesto por período
- carga por categoría
- subtotales y total general