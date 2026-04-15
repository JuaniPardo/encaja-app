# Encaja App — Guía `Empezar` (Funcionamiento actual)

## Objetivo

Documentar cómo funciona hoy la guía `Empezar`, qué reglas usa, y cuáles son los pasos de progreso que el sistema registra actualmente.

---

## 1. Dónde vive la guía

- Ruta: `/app/[workspaceSlug]/start`
- Navegación principal: ítem `Empezar`
- Idiomas soportados: español e inglés

---

## 2. Qué datos usa hoy

La guía se calcula dinámicamente en base a datos reales del workspace, sin tabla de onboarding propia.

Consultas utilizadas:

1. existencia de cualquier transacción (`limit 1`)
2. existencia de ingresos (`type = income`, `limit 1`)
3. cantidad de gastos para hito inicial (`type = expense`, `limit 3`)

Esto permite evaluar progreso con lógica simple y baja fricción.

---

## 3. Estados de la guía

El sistema define 3 estados:

1. `no_movements`
- condición: no hay transacciones
- mensaje de estado: "Todavía no registraste movimientos"
- acción principal: registrar primera transacción

2. `started`
- condición: hay transacciones, pero todavía no hay base mínima para revisar balance (por ejemplo, faltan ingresos o gastos)
- mensaje de estado: "Ya empezaste a registrar tus finanzas"
- acción principal: registrar más movimientos

3. `ready_for_balance`
- condición: ya existen ingresos y gastos
- mensaje de estado: "Ya tenés información útil para empezar a analizar tu mes"
- acción principal: ir al tablero para revisar balance

---

## 4. Pasos registrados actualmente (checklist)

La guía registra y muestra estos hitos:

1. `Registrar primer ingreso`
- se marca completo cuando existe al menos una transacción `income`

2. `Registrar 3 gastos`
- se marca completo cuando existen al menos 3 transacciones `expense`

3. `Revisar balance del mes`
- se marca completo cuando existen ingresos y gastos

El progreso visible se muestra como `completados / total` (ejemplo: `2/3`).

---

## 5. Acción principal (CTA)

Regla de CTA única por estado:

1. estados iniciales (`no_movements`, `started`)
- CTA: `Nueva transacción`
- destino: `Transacciones`
- comportamiento: abre flujo de alta directa

2. estado con base suficiente (`ready_for_balance`)
- CTA: `Ir al tablero`
- destino: `Resumen` del workspace

---

## 6. Insight breve

La guía muestra una sola frase por vez.

Regla actual:

- en estados iniciales, usa mensajes breves de acompañamiento (rotación estable por workspace y día)
- en estado `ready_for_balance`, muestra insight orientado a análisis

Mensajes iniciales incluyen, entre otros:

- "Podés empezar con efectivo o tarjeta y ajustar después."
- "No te preocupes si al principio el presupuesto no cierra perfecto."
- "Lo importante es registrar y mejorar de a poco."

---

## 7. Configuración progresiva de medios de pago

Para evitar fricción inicial al registrar la primera transacción:

- si el workspace no tiene medios de pago:
  - se muestra selector rápido: `Efectivo`, `Tarjeta`, `Otro`
  - al guardar la transacción, se crea automáticamente el medio elegido
  - ese medio se asigna automáticamente a la transacción

Con esto:

- no se exige ir a `Settings`
- no hay formulario complejo previo
- se mantiene consistencia de datos (transacción + medio de pago existente)

---

## 8. Qué NO registra todavía

La guía actual no guarda histórico de onboarding en una tabla dedicada.

Hoy el progreso se deriva en tiempo real desde transacciones del workspace.

No hay todavía:

- timestamp de "paso completado"
- evento explícito de "usuario revisó balance"
- scoring avanzado o coaching inteligente

---

## 9. Resumen operativo

La guía `Empezar` está implementada como acompañamiento liviano y contextual:

- detecta estado de adopción con reglas mínimas
- propone una sola acción clara
- muestra progreso visible
- reduce fricción inicial con alta implícita de medios de pago

Esto mantiene la app alineada con el objetivo de hábito progresivo: empezar simple, registrar, y mejorar iterativamente.
