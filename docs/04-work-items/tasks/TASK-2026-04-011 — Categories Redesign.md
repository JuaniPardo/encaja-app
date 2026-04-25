# TASK-2026-04-011 — Categories Redesign

## 🧠 Problema

La pantalla de categorías presenta:
- Exceso de estructura tipo “card” o bloques pesados
- Información repetida (Sistema, Activa, etc.)
- Falta de jerarquía visual clara
- Sensación de panel técnico (backoffice) en lugar de producto

Esto dificulta la gestión rápida y reduce la eficiencia del usuario.

---

## 🎯 Objetivo

Rediseñar la pantalla de categorías para:
- Mejorar densidad de información
- Reducir ruido visual
- Facilitar gestión rápida (editar, activar, eliminar)
- Dar visibilidad al uso real de cada categoría

---

## 📦 Alcance

Incluye:
- Reemplazo de cards por lista compacta
- Reorganización en columnas
- Agrupación por tipo (Ingresos, Gastos, Ahorro)
- Mejora de acciones (editar/eliminar)
- Ajustes mobile

No incluye:
- Cambios en lógica de categorías
- Cambios en modelo de datos

---

## 🧩 Lineamientos de implementación

### 1. Lista compacta
- Reemplazar cards por filas densas
- Altura reducida
- Evitar bloques visuales pesados

### 2. Columnas claras
Cada fila debe contener:
- Nombre
- Cantidad de movimientos
- Tipo (fijo/variable/sistema)
- Estado (activa/inactiva)
- Acciones

### 3. Badges y estado
- Usar badges pequeños (no texto repetido)
- Estado como:
  - Icono ✔ / ✖ o switch
- “Sistema” debe ser discreto

### 4. Agrupación por tipo
Secciones:
- Ingresos
- Gastos
- Ahorro

Con separación visual clara pero compacta

### 5. Acciones
- Desktop: visibles en hover
- Mobile: acceso mediante tap

### 6. Insight superior
- Línea simple
- Ejemplo:
  “Tenés 4 categorías sin uso este mes”

### 7. Mobile behavior
- Lista compacta
- Información en 2 líneas:
  - Nombre + estado
  - Cantidad de movimientos

---

## 🔁 PRs sugeridos

### PR-1: Refactor layout base
- Eliminar cards
- Crear componente CategoryRow
- Definir estructura de columnas

### PR-2: Agrupación y densidad
- Implementar secciones (Ingresos, Gastos, Ahorro)
- Reducir spacing
- Ajustar tipografía

### PR-3: Badges y estado
- Implementar badges compactos
- Ajustar visual de estado

### PR-4: Acciones y UX
- Hover actions desktop
- Tap actions mobile

### PR-5: Insight y filtros
- Agregar insight superior
- Ajustar barra de filtros

---

## ✅ Criterios de aceptación

- [ ] No se utilizan cards para mostrar categorías
- [ ] La lista permite escaneo rápido
- [ ] Existe agrupación clara por tipo
- [ ] Las acciones son accesibles (hover/tap)
- [ ] El estado de cada categoría es claro
- [ ] Se reduce el ruido visual general
- [ ] Mobile mantiene usabilidad y densidad
- [ ] No se rompe lógica existente

---

## 📅 Estado

- Disciplina actual: Diseño definido
- Próximo paso: PR-1 (refactor layout base)
- Forecast: 1–2 PRs para versión usable

🖥️ DESKTOP

```plaintext
┌──────────────────────────────────────────────────────────────┐
│ Categorías                                                   │
│ [Tipo ▼][Estado ▼][Origen ▼][Buscar 🔍]   [+ Nueva]          │
├──────────────────────────────────────────────────────────────┤
│ 💡 Tenés 4 categorías sin uso este mes                       │
├──────────────────────────────────────────────────────────────┤
│ INGRESOS                                                     │
│ ──────────────────────────────────────────────────────────   │
│ Sueldo         1 mov     Sistema   ✔ Activa        ✏ 🗑      │
│ Extra          5 mov     Sistema   ✔ Activa        ✏ 🗑      │
│                                                              │
│ GASTOS                                                       │
│ ──────────────────────────────────────────────────────────   │
│ Alimentos      6 mov     Variable  ✔ Activa        ✏ 🗑      │
│ Servicios      4 mov     Fijo      ✔ Activa        ✏ 🗑      │
│ Alquiler       0 mov     Fijo      ✖ Inactiva      ✏ 🗑      │
│                                                              │
│ AHORRO                                                       │
│ ──────────────────────────────────────────────────────────   │
│ Ahorro mensual 0 mov     Sistema   ✖ Inactiva     ✏ 🗑       │
└──────────────────────────────────────────────────────────────┘
```

🎯 CLAVES

✔️ Lista densa (no cards)

* Esto es gestión → no marketing

⸻

✔️ Columnas claras

* Nombre
* Uso
* Tipo
* Estado
* Acciones

⸻

✔️ Badges compactos

* No repetir texto gigante

⸻

📱 MOBILE
```plaintext
┌────────────────────────────┐
│ Categorías                 │
│ [+ Nueva]                  │
├────────────────────────────┤
│ [Filtros ▼]                │
├────────────────────────────┤
│ INGRESOS                   │
│ Sueldo        ✔            │
│ 1 movimiento               │
│                            │
│ Extra         ✔            │
│ 5 movimientos              │
│                            │
│ GASTOS                     │
│ Alimentos     ✔            │
│ 6 movimientos              │
│                            │
│ Servicios     ✔            │
│ 4 movimientos              │
└────────────────────────────┘
```

👉 Tap → edición

---

## 🧠 Notas de implementación

- Mantener consistencia con Transactions y Budget
- Evitar repetir labels innecesarios (Sistema, Activa)
- Priorizar densidad sobre estética
- Evaluar accesibilidad en estados (color + icono)