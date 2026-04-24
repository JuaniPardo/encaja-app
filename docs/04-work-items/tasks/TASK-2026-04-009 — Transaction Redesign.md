
# TASK-2026-04-009 — Transaction Redesign

## 🧠 Problema

La pantalla de transacciones presenta:
- Exceso de ruido visual (uso intensivo de cards)
- Baja densidad de información
- Falta de jerarquía clara
- Desktop subutilizado (mobile estirado)

Esto dificulta el escaneo rápido y la comprensión del comportamiento financiero.

---

## 🎯 Objetivo

Rediseñar la pantalla de transacciones para:
- Mejorar escaneabilidad
- Reducir ruido visual
- Aprovechar layout desktop
- Introducir feedback contextual (insights)

---

## 📦 Alcance

Incluye:
- Rediseño completo de lista de transacciones
- Agrupación por día
- Nuevo layout desktop con split view
- Ajustes mobile (lista compacta + modal)
- Introducción de insight superior

No incluye:
- Cambios en lógica de negocio
- Nuevos tipos de transacción

---

## 🧩 Lineamientos de implementación

### 1. Lista compacta
- Reemplazar cards por filas densas
- Altura reducida
- 2 líneas por item:
  - Línea 1: categoría + monto
  - Línea 2: metadata (medio + fecha)

### 2. Agrupación por fecha
- Agrupar transacciones por día
- Header sticky por grupo opcional

### 3. Jerarquía visual
Prioridad:
1. Monto
2. Categoría
3. Metadata
4. Acciones

### 4. Acciones
- Mostrar en hover (desktop)
- Mostrar como iconos (mobile)

### 5. Insight superior
- Línea única
- Dinámica (ej: gasto del día/semana)

### 6. Split view (desktop)
- Lista izquierda (scroll)
- Detalle derecha (sticky)
- Selección de item activa el panel

### 7. Mobile behavior
- Lista simple
- Tap → abre modal con detalle

---

## 🔁 PRs sugeridos

### PR-1: Refactor layout base
- Eliminar estructura basada en cards
- Crear componente TransactionRow
- Crear agrupador por fecha

### PR-2: Agrupación y densidad
- Implementar headers por día
- Reducir spacing
- Ajustar tipografía

### PR-3: Insight + filtros
- Agregar bloque de insight superior
- Ajustar barra de filtros

### PR-4: Split view desktop
- Layout en grid 2 columnas
- Panel de detalle sticky

### PR-5: Mobile modal
- Implementar modal de detalle
- Ajustar interacción táctil

---

## ✅ Criterios de aceptación

- [ ] Las transacciones no se muestran como cards
- [ ] Existe agrupación clara por día
- [ ] La lista permite escaneo rápido (alta densidad)
- [ ] El monto es el elemento visual dominante
- [ ] Desktop muestra split view funcional
- [ ] Mobile abre modal al seleccionar transacción
- [ ] Existe un insight visible en la parte superior
- [ ] No se rompe lógica existente de datos

---

## 📅 Estado

- Disciplina actual: Diseño definido, pendiente implementación
- Próximo paso: PR-1 (refactor layout base)
- Forecast: 2–3 PRs para versión usable


🖥️ DESKTOP (estructura objetivo)

``` plaintext
┌──────────────────────────────────────────────────────────────┐
│ Tablero financiero - ARS                                     │
│ [Filtros: Mes ▼ | Tipo ▼ | Categoría ▼ | Medio ▼ | Buscar 🔍] │
├──────────────────────────────────────────────────────────────┤
│ 💡 Gastaste $245.000 esta semana · Principal: Alimentos      │
├──────────────────────────────┬───────────────────────────────┤
│ LISTA (scroll)               │ DETALLE (sticky)              │
│                              │                               │
│ 17 ABRIL                     │  Alimentos                    │
│ ──────────────────────────   │  $ 41.700                     │
│ Alimentos        $ 41.700    │                               │
│ Visa · 17 abr               │  Fecha: 17 abr                │
│                             │  Medio: Visa                  │
│ Delivery         $ 67.800    │  Categoría: Alimentos         │
│ Visa · 17 abr               │                               │
│                             │  [Editar] [Eliminar]          │
│ 16 ABRIL                     │                               │
│ ──────────────────────────   │                               │
│ Salud           $ 39.067     │                               │
│ Visa · 16 abr               │                               │
│                             │                               │
│ ...                         │                               │
└──────────────────────────────┴───────────────────────────────┘
```

🎯 CLAVES DE DISEÑO

✔️ Lista compacta (NO cards)

* Altura baja
* Información en 2 líneas
* Acciones en hover

⸻

✔️ Agrupación por día

* Reduce ruido
* Mejora escaneo

⸻

✔️ Split view (MUY importante)

* Desktop deja de ser “mobile estirado”
* Permite editar sin perder contexto

⸻

✔️ Insight arriba (liviano)

* No bloque grande
* Una línea útil

⸻

📱 MOBILE
```plaintext
┌────────────────────────────┐
│ Transacciones              │
│ [Filtro ▼]                 │
├────────────────────────────┤
│ 💡 Gastaste $245k hoy      │
├────────────────────────────┤
│ 17 ABRIL                   │
│ ────────────────────────   │
│ Alimentos      $ 41.700    │
│ Visa · 17 abr              │
│                            │
│ Delivery       $ 67.800    │
│ Visa · 17 abr              │
│                            │
│ 16 ABRIL                   │
│ ────────────────────────   │
│ Salud          $ 39.067    │
│ Visa · 16 abr              │
└────────────────────────────┘
```

👉 Tap → abre modal con detalle

---

## 🧠 Notas de implementación

- Priorizar performance en listas largas (virtualización si aplica)
- Mantener consistencia con otras vistas (budget, categories)
- Evitar sobrecargar con colores: usar color solo en monto
- Reutilizar componentes donde sea posible (badges, icons, etc.)