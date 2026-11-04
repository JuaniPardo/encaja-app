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

---

## 8. Modo oscuro

La app tiene modo claro y oscuro con el color scheme de Mantine. El claro es el valor por defecto; la elección del usuario se guarda en `localStorage` (`encaja.color-scheme`) y se aplica antes del primer pintado con `ColorSchemeScript` en el layout raíz. El botón para alternar vive en el header del shell protegido.

Tokens de color:
- los colores neutros, superficies, bordes y pasteles de estado salen de variables `--encaja-*` definidas en `src/app/globals.css`
- cada variable se define en `:root` (claro) y en `[data-mantine-color-scheme="dark"]` (oscuro)
- los fondos pastel de un color de Mantine (tono `0`) se usan con `--encaja-tint-*` o con `transactionTypeTintCssVar` / `mantineColorTintCssVar` de `type-colors.ts`, que en oscuro pasan a la variante `-light`
- en atributos de SVG, los tokens van dentro de `style` (`style={{ fill: "var(--encaja-…)" }}`), no como atributo directo

Reglas:
- no usar hex fijos en componentes; solo se permiten `#ffffff` como texto sobre relleno saturado y, para trazos y rellenos de gráfico, `#f06595`, `#4c6bd7`, `#3f8f7f` y `#b0b4bb`
- los textos con color semántico (montos, saldos, desvíos, enlaces) usan tokens con variante oscura que da al menos 4,5:1 sobre `dark-7` y `dark-6`; en claro conservan el tono de siempre:
  - `--encaja-positive-text`: `#087f5b` / `teal-4`
  - `--encaja-negative-text`: `#c92a2a` / `red-4`
  - `--encaja-critical-text`: `#b42318` / `red-5`
  - `--encaja-warning-text`: `#b54708` / `orange-4`
  - `--encaja-expense-text`: `#c2255c` / `pink-4`
  - `--encaja-link-text`: `#3b5bdb` / `indigo-3`
- no usar fondos blancos fijos (`#ffffff`, `white`) ni tonos `0..3` de Mantine como fondo o texto fijo: usar el token equivalente
- `src/app/theme-tokens.test.ts` hace cumplir ambas reglas

Presupuesto contra real:
- en ingresos, superar lo previsto es positivo: se muestra con el color del tipo (`teal`, tono 7), con "Recibido", "Por recibir" y "Superado", y no suma al contador de críticas
- en gastos y ahorro, superar lo previsto sigue en rojo con "Excedido"
- es el mismo criterio que `getDeviationColor` en `src/features/dashboard/lib/dashboard-math.ts`
