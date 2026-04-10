

# Encaja App — MVP 3 Definition

## Fecha
2026-04-10

## Estado
Draft

## Autor
Juan Pardo

---

## 1. Nombre del MVP

**MVP 3 — Registro de transacciones**

---

## 2. Objetivo

Construir el primer módulo de ejecución financiera de Encaja, permitiendo registrar ingresos, gastos y ahorro reales dentro de un workspace.

Este MVP debe convertir a Encaja en una herramienta operativa, no solo de configuración o planificación, habilitando la carga de movimientos que luego podrán compararse contra el presupuesto y alimentar el dashboard.

---

## 3. Resultado esperado

Al finalizar este MVP, un usuario debe poder:

- registrar transacciones reales
- clasificar cada transacción por tipo y categoría
- asociar un medio de pago cuando corresponda
- usar fecha de transacción y fecha efectiva
- ver un listado de transacciones del período
- editar transacciones existentes
- eliminar transacciones si fueron cargadas por error

---

## 4. Alcance

### 4.1 Incluye

#### Registro de transacciones
- alta de transacciones
- edición de transacciones
- eliminación de transacciones
- soporte para tipos `income`, `expense` y `saving`

#### Datos de cada transacción
- tipo
- categoría
- monto
- transaction_date
- effective_date
- payment_method opcional
- description opcional
- notes opcional

#### Listado operativo
- listado de transacciones del workspace
- filtro por período
- visualización ordenada por fecha
- lectura clara de tipo, categoría, monto y medio de pago

#### Persistencia
- guardar datos en `transactions`
- actualizar transacciones existentes
- eliminar transacciones del período

---

### 4.2 No incluye

Este MVP no debe incluir:

- dashboard con cálculos finales
- comparación visual real vs presupuesto
- gráficos
- conciliación bancaria
- importación masiva
- automatizaciones complejas
- lógica completa de tarjeta por cierre y vencimiento
- reglas avanzadas de recurrencia

---

## 5. Pantallas incluidas

### 5.1 Transacciones
La pantalla debe permitir:

- seleccionar un período de trabajo o visualizar un rango razonable por defecto
- ver el listado de transacciones existentes
- abrir formulario para nueva transacción
- editar una transacción existente
- eliminar una transacción

### 5.2 Formulario de transacción
Debe incluir:

- tipo
- categoría
- monto
- fecha de transacción
- fecha efectiva opcional
- medio de pago opcional
- descripción opcional
- notas opcionales

### 5.3 Estados de la pantalla
Debe contemplar:

- estado vacío cuando no hay transacciones
- estado de carga
- feedback de guardado exitoso o fallido
- feedback de eliminación

---

## 6. Entidades involucradas

Este MVP usa las siguientes entidades:

- transactions
- categories
- payment_methods
- workspaces
- workspace_members

Depende indirectamente de lo ya resuelto en MVP 1 y MVP 2:

- auth
- profile
- workspace
- settings
- categorías
- medios de pago

No depende todavía de una vista consolidada de dashboard.

---

## 7. Reglas funcionales del MVP

### 7.1 Tipos permitidos
Los tipos de transacción válidos son:
- income
- expense
- saving

### 7.2 Consistencia con categoría
- la categoría seleccionada debe pertenecer al mismo workspace
- el tipo de la categoría debe coincidir con el tipo de la transacción

### 7.3 Monto
- el monto es obligatorio
- debe ser numérico
- debe ser mayor a cero

### 7.4 Fecha de transacción
- `transaction_date` es obligatoria
- representa cuándo ocurrió el movimiento

### 7.5 Fecha efectiva
- `effective_date` es opcional
- si existe, representa cuándo impacta financieramente
- si no existe, se usará `transaction_date` como fecha de imputación

### 7.6 Medio de pago
- es opcional
- si se informa, debe pertenecer al mismo workspace

### 7.7 Descripción y notas
- son opcionales
- sirven para aportar contexto operativo

### 7.8 Orden de listado
Regla recomendada para v1:
- ordenar por `transaction_date` descendente
- como criterio secundario, `created_at` descendente

---

## 8. Criterios de aceptación

### Alta
- el usuario puede crear una transacción válida
- la transacción queda persistida correctamente en el workspace actual

### Edición
- el usuario puede modificar una transacción existente
- los cambios se reflejan correctamente en el listado

### Eliminación
- el usuario puede eliminar una transacción
- la eliminación requiere confirmación
- la fila desaparece del listado al completarse la operación

### Validaciones
- no se puede guardar sin monto
- no se puede guardar sin fecha
- no se puede guardar con categoría de otro tipo
- no se puede guardar con entidades de otro workspace

### UX
- el formulario es claro
- el listado es legible
- la pantalla comunica estados vacíos y errores
- el usuario entiende qué está cargando y en qué período está trabajando

---

## 9. Orden técnico recomendado

### Etapa 1
- crear tabla y constraints necesarias para `transactions`
- definir acceso por workspace

### Etapa 2
- implementar carga de categorías activas por tipo
- implementar carga de medios de pago activos

### Etapa 3
- construir UI de listado
- construir formulario de alta/edición

### Etapa 4
- implementar create / update / delete
- refresco de listado

### Etapa 5
- agregar filtros simples por período y tipo si hace falta para la primera operación real

---

## 10. Riesgos a evitar

- mezclar lógica de presupuesto dentro del módulo de transacciones
- permitir categorías incompatibles con el tipo de movimiento
- no validar workspace ownership
- esconder demasiado la fecha efectiva
- sobrecargar la pantalla con filtros avanzados demasiado pronto

---

## 11. Definición de terminado

Este MVP se considera terminado cuando un usuario autenticado puede registrar, editar y eliminar transacciones reales de su workspace, usando categorías y medios de pago válidos, con soporte para fecha y fecha efectiva, y puede visualizarlas en un listado operativo claro.

---

## 12. Próximo paso después del MVP 3

Una vez completado este MVP, el siguiente incremento recomendado es:

**MVP 4 — Resumen mensual real vs presupuesto**

- consolidación por período
- totales por tipo
- comparación contra presupuesto
- desvíos por categoría
- porcentaje de ejecución