# Encaja — Lineamientos UI v1

## Objetivo

Definir reglas transversales de interfaz para mantener consistencia de navegación y reducir fricción de uso en toda la app.

---

## 1. Navegación por vistas

Cuando el usuario cambia entre vistas o contextos (ej: secciones de una pantalla), usar `Tabs`.

Ejemplos:
- `Este mes` / `Mes cerrado`
- `Workspace` / `Colaboración` / `Links`

---

## 2. Pills y segmented controls

No usar pills o `SegmentedControl` para navegación entre vistas de pantalla.

`SegmentedControl` solo se permite para selección rápida dentro de un formulario o control operativo puntual, donde no se está navegando entre paneles.

---

## 3. Regla de decisión rápida

Si la interacción cambia el contenido principal de la pantalla: `Tabs`.

Si la interacción ajusta un valor puntual dentro de la misma vista: `SegmentedControl`.

---

## 4. Consistencia visual

Para tabs:
- mantener estados claros: activo, hover, inactivo
- no crear variantes nuevas sin necesidad funcional real
- priorizar reutilización del componente existente de Mantine (`Tabs`)

---

## 5. Criterio de aceptación para nuevas features

Antes de cerrar una pantalla nueva o refactor:
- validar que la navegación de vistas usa `Tabs`
- validar que no se introdujeron patrones alternativos para el mismo comportamiento
- validar consistencia con pantallas existentes

---

## 6. Semántica de color financiero (regla fija)

En toda la app, los tipos financieros deben mantener esta asociación visual:
- `income` (Ingresos) → `teal`
- `expense` (Gastos) → `pink`
- `saving` (Ahorro) → `indigo`

Reglas:
- usar únicamente tonos (`0..9`) de ese color base para variaciones de estado
- no intercambiar colores entre tipos aunque cambie el contexto de la pantalla
- evitar colores alternativos para representar tipo financiero

Fuente canónica en código:
- `src/features/transactions/type-colors.ts`

---

## 7. Acento de UI (no financiero)

Para componentes de interfaz generales (botones primarios, estado activo de navegación, éxito de operaciones de UI):
- usar `cyan` como color de acento principal
- evitar `teal` como acento general para no superponerlo con la semántica de `income`

Regla:
- `teal/pink/indigo` quedan reservados a semántica financiera
- `cyan` se usa para acento visual de producto y navegación
