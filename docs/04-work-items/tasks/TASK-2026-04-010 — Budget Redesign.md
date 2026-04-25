# TASK-2026-04-010 — Budget Redesign

## 🧠 Problema

La pantalla de presupuesto presenta:
- Scroll excesivo (lista larga sin jerarquía)
- Inputs sin contexto (no muestran consumo real)
- Falta de feedback inmediato por categoría
- Resultado global (balance) poco visible

Esto dificulta la toma de decisiones y reduce el valor percibido del presupuesto.

---

## 🎯 Objetivo

Rediseñar la pantalla de presupuesto para:
- Dar feedback inmediato por categoría
- Mejorar visibilidad del estado financiero global
- Reducir scroll y carga cognitiva
- Introducir una estructura clara y accionable

---

## 📦 Alcance

Incluye:
- Rediseño de layout desktop (con panel lateral)
- Summary sticky (ingresos, gastos, balance)
- Feedback inline por categoría
- Secciones colapsables
- Ajustes mobile (densidad y estructura)

No incluye:
- Cambios en lógica de cálculo de presupuesto
- Nuevos tipos de categorías

---

## 🧩 Lineamientos de implementación

### 1. Summary global (obligatorio)
- Mostrar ingresos, gastos y balance
- Visible permanentemente (sticky)
- Balance con código de color (verde / rojo)

### 2. Feedback por categoría
Cada categoría debe mostrar:
- Monto presupuestado (input)
- Monto gastado
- % de consumo

Ejemplo:
Alimentos
[400.000]
→ Gastado: 250k (62%)

### 3. Secciones colapsables
- Ingresos
- Gastos
- Ahorro

Comportamiento:
- Expandir solo lo necesario
- Reducir scroll total

### 4. Jerarquía visual
Prioridad:
1. Balance global
2. Categorías críticas (alto consumo)
3. Inputs
4. Metadata

### 5. Panel lateral (desktop)
- Estado del presupuesto
- Top categoría de gasto
- Indicador visual de consumo

### 6. Mobile behavior
- Secciones tipo acordeón
- Summary compacto arriba
- CTA siempre visible al final

---

## 🔁 PRs sugeridos

### PR-1: Refactor layout base
- Separar layout en columnas (desktop)
- Crear componente CategoryBudgetRow

### PR-2: Feedback inline
- Agregar consumo real por categoría
- Agregar % y cálculo visual

### PR-3: Summary sticky
- Implementar barra superior sticky
- Colores según estado

### PR-4: Panel lateral
- Crear componente BudgetSummaryPanel
- Mostrar insights clave

### PR-5: Mobile optimización
- Reducir padding
- Implementar acordeones
- Ajustar CTA

---

## ✅ Criterios de aceptación

- [ ] El balance global es visible sin scroll
- [ ] Cada categoría muestra consumo real (% y monto)
- [ ] La pantalla reduce scroll innecesario
- [ ] Existen secciones colapsables funcionales
- [ ] Desktop tiene layout en dos columnas
- [ ] Mobile presenta acordeones utilizables
- [ ] No se rompe lógica de cálculo actual

---

## 📅 Estado

- Disciplina actual: Diseño definido
- Próximo paso: PR-1 (refactor layout base)
- Forecast: 2–3 PRs para versión usable

🖥️ DESKTOP (estructura objetivo)

```plaintext
┌──────────────────────────────────────────────────────────────┐
│ Presupuesto mensual - Abril 2026                             │
│ [Mes ▼]                                                      │
├──────────────────────────────────────────────────────────────┤
│ INGRESOS $3.524.000 | GASTOS $3.895.000 | BALANCE -$371.000  │ ← STICKY
├──────────────────────────────┬───────────────────────────────┤
│ CATEGORÍAS (scroll)          │ RESUMEN (sticky)              │
│                              │                               │
│ ▶ INGRESOS                   │ ⚠ Estás $371.000 arriba       │
│   Sueldo        [2.440.000]  │                               │
│   Extra         [1.084.000]  │ Top gasto: Mantenimiento      │
│                              │ $1.100.000                    │
│ ▶ GASTOS                     │                               │
│   Alimentos     [400.000]    │ % consumo:                    │
│   → Gastado: 250k (62%)      │ ███████░░░                    │
│                              │                               │
│   Transporte    [380.000]    │                               │
│   → Gastado: 300k (79%)      │                               │
│                              │                               │
│   Mantenimiento [1.100.000]  │                               │
│   → Gastado: 960k (87%)      │                               │
│                              │                               │
│ ▶ AHORRO                     │                               │
│   (vacío)                    │                               │
└──────────────────────────────┴───────────────────────────────┘

[Cancelar]                             [Guardar presupuesto]
```
🎯 CLAVES

✔️ Summary SIEMPRE visible

* Esto cambia todo el flujo mental

⸻

✔️ Feedback inline por categoría

* No más inputs ciegos

⸻

✔️ Secciones colapsables

* Evita scroll infinito

⸻

✔️ Panel lateral inteligente

* No decorativo → informativo

⸻

📱 MOBILE
```plaintext
┌────────────────────────────┐
│ Presupuesto mensual        │
│ Abril 2026 ▼               │
├────────────────────────────┤
│ ING $3.5M | GAS $3.8M      │
│ BAL -$371k 🔴              │
├────────────────────────────┤
│ ▶ Ingresos                 │
│ ▶ Gastos                   │
│   Alimentos                │
│   [400.000]                │
│   62% usado                │
│                            │
│   Transporte               │
│   [380.000]                │
│   79% usado                │
│                            │
│ ▶ Ahorro                   │
├────────────────────────────┤
│ ⚠ Estás pasado             │
│                            │
│ [Guardar]                  │
└────────────────────────────┘
```

---

## 🧠 Notas de implementación

- Priorizar claridad sobre estética (evitar exceso de estilos)
- Reutilizar componentes de Transaction donde aplique
- Mantener consistencia de spacing y tipografía
- Evaluar virtualización si la lista crece significativamente
