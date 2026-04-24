# Encaja App — Guía `Empezar` / Companion

## Objetivo del documento

Consolidar en un único documento:

- la intención original del MVP 18,
- el funcionamiento actualmente implementado de la guía `Empezar`,
- y la evolución propuesta en MVP 18.1 hacia un companion contextual.

La meta es dejar una única referencia funcional y de producto, evitando solapamientos entre documentos separados.

---

## 1. Visión general

`Empezar` nació como una guía simple para acompañar los primeros pasos dentro de Encaja.

Su objetivo inicial fue reducir fricción, evitar pantallas vacías sin contexto y darle al usuario una próxima acción clara.

Esa lógica cumplió bien su función de onboarding liviano, pero tiene un límite natural: una vez que el usuario ya registró algunos movimientos, la guía se agota rápido.

Por eso, la evolución natural es que `Empezar` deje de pensarse solo como onboarding y pase a convertirse en un **companion contextual**, capaz de seguir siendo útil incluso después del arranque.

---

## 2. Objetivo de producto

El objetivo general de este módulo es que Encaja no solo muestre información, sino que también acompañe al usuario con una acción útil y relevante según su situación actual.

En términos de experiencia, el usuario debería poder:

- entender rápidamente qué conviene hacer,
- ver una única acción principal,
- sentir que la app acompaña sin invadir,
- recibir contexto útil tanto al inicio como durante el uso continuo.

---

## 3. Problema a resolver

### Problema original

Un usuario nuevo puede entrar a Encaja y encontrarse con:

- pantallas vacías,
- datos parciales,
- dudas sobre por dónde empezar,
- poco contexto sobre la siguiente acción recomendable.

Eso genera riesgos como:

- abandono temprano,
- baja retención,
- uso superficial,
- percepción de complejidad innecesaria.

### Problema actual

La guía hoy funciona bien para el arranque, pero queda superada muy rápido.

Sus limitaciones principales son:

- está centrada en pasos fijos de onboarding,
- se consume por completo en poco tiempo,
- no acompaña al usuario una vez que ya empezó a usar la app,
- no interpreta suficiente contexto real del workspace,
- no adapta el mensaje según el momento del mes o el comportamiento reciente.

---

## 4. Nuevo modelo mental

### Antes

- guía de primeros pasos,
- progreso lineal,
- final predecible.

### Ahora

- companion contextual,
- sugerencias activas,
- utilidad continua.

`Empezar` ya no debe sentirse como un tutorial ni como una checklist que se termina.

Debe sentirse como una capa liviana de acompañamiento que siempre intenta responder una pregunta simple:

**¿Cuál es la acción más útil para este usuario, en este momento?**

---

## 5. Alcance consolidado

### Incluye

- una pantalla o sección `Empezar`,
- integración en navegación principal,
- un mensaje principal según contexto,
- una única acción principal,
- un insight o mensaje breve de acompañamiento,
- lógica funcional simple para decidir qué mostrar,
- capacidad de evolución desde onboarding a companion.

### No incluye

Este alcance no debe incluir todavía:

- IA o recomendaciones complejas,
- scoring avanzado,
- machine learning,
- coaching sofisticado,
- contenido educativo largo,
- múltiples CTAs compitiendo,
- persistencia histórica específica del companion,
- comparaciones avanzadas contra meses anteriores.

---

## 6. Dónde vive hoy

- Ruta: `/app/[workspaceSlug]/start`
- Navegación principal: ítem `Empezar`
- Idiomas soportados: español e inglés

---

## 7. Funcionamiento actual implementado

Hoy la guía se calcula dinámicamente en base a datos reales del workspace, sin una tabla de onboarding propia.

### Consultas que usa actualmente

1. existencia de cualquier transacción (`limit 1`)
2. existencia de ingresos (`type = income`, `limit 1`)
3. cantidad de gastos para hito inicial (`type = expense`, `limit 3`)

Esto permite evaluar progreso con lógica simple y baja fricción.

### Estados actuales

#### 1. `no_movements`

Condición:

- no hay transacciones

Comportamiento:

- mensaje de estado: `Todavía no registraste movimientos`
- acción principal: registrar primera transacción

#### 2. `started`

Condición:

- hay transacciones, pero todavía no hay base mínima para revisar balance

Comportamiento:

- mensaje de estado: `Ya empezaste a registrar tus finanzas`
- acción principal: registrar más movimientos

#### 3. `ready_for_balance`

Condición:

- ya existen ingresos y gastos

Comportamiento:

- mensaje de estado: `Ya tenés información útil para empezar a analizar tu mes`
- acción principal: ir al tablero para revisar balance

### Checklist actual

La guía registra y muestra estos hitos:

1. `Registrar primer ingreso`
   - completo cuando existe al menos una transacción `income`

2. `Registrar 3 gastos`
   - completo cuando existen al menos 3 transacciones `expense`

3. `Revisar balance del mes`
   - completo cuando existen ingresos y gastos

El progreso visible se muestra como `completados / total`.

### CTA actual

#### Estados iniciales (`no_movements`, `started`)

- CTA: `Nueva transacción`
- destino: `Transacciones`
- comportamiento: abre flujo de alta directa

#### Estado con base suficiente (`ready_for_balance`)

- CTA: `Ir al tablero`
- destino: `Resumen` del workspace

### Insight breve actual

La guía muestra una sola frase por vez.

Regla actual:

- en estados iniciales, usa mensajes breves de acompañamiento,
- en estado `ready_for_balance`, muestra insight orientado a análisis.

Ejemplos de mensajes iniciales:

- `Podés empezar con efectivo o tarjeta y ajustar después.`
- `No te preocupes si al principio el presupuesto no cierra perfecto.`
- `Lo importante es registrar y mejorar de a poco.`

### Configuración progresiva de medios de pago

Para evitar fricción al registrar la primera transacción:

- si el workspace no tiene medios de pago,
- se muestra selector rápido: `Efectivo`, `Tarjeta`, `Otro`,
- al guardar la transacción, se crea automáticamente el medio elegido,
- ese medio se asigna automáticamente a la transacción.

Con esto:

- no se exige ir a `Settings`,
- no hay formulario complejo previo,
- se mantiene consistencia de datos.

### Qué no registra todavía

Hoy no existe una tabla dedicada de onboarding o companion.

El progreso se deriva en tiempo real desde transacciones del workspace.

No hay todavía:

- timestamp de paso completado,
- evento explícito de revisión del balance,
- scoring avanzado,
- histórico específico del companion.

---

## 8. Limitación del enfoque actual

El diseño actual resuelve bien el arranque, pero depende demasiado de una secuencia fija.

Eso lo vuelve útil solo durante una franja breve del ciclo de vida del usuario.

Una vez superados esos hitos iniciales:

- el checklist pierde valor,
- la lógica queda corta,
- el sistema deja de acompañar activamente,
- y `Empezar` corre el riesgo de sentirse irrelevante.

---

## 9. Evolución propuesta: companion contextual

La evolución propuesta es reemplazar la lógica centrada en pasos fijos por una lógica contextual.

En lugar de preguntar solo si el usuario completó ciertos hitos, el sistema debe evaluar el estado real del workspace para devolver:

- un mensaje principal,
- una sugerencia concreta,
- una acción recomendada,
- y eventualmente una variante visual coherente.

---

## 10. Objetivo funcional del companion

Dado un workspace, el sistema debe poder determinar cuál es el mejor mensaje y CTA a mostrar según su situación actual.

La lógica no debe quedar dispersa en la UI.

La UI debería recibir un objeto ya resuelto y limitarse a renderizarlo.

---

## 11. Contexto mínimo a evaluar

Para esta evolución, el motor debe poder evaluar como mínimo:

- si existen transacciones,
- si existen ingresos,
- si existen gastos,
- cuántos días pasaron desde la última transacción,
- si existen transacciones sin categoría,
- en qué momento aproximado del mes está el usuario.

### Context object sugerido

```ts
type CompanionContext = {
  hasTransactions: boolean;
  hasIncome: boolean;
  hasExpenses: boolean;
  uncategorizedCount: number;
  daysSinceLastTransaction: number | null;
  dayOfMonth: number;
};
```

---

## 12. Salida esperada del motor

El motor debería devolver una estructura unificada para renderizar la tarjeta del companion sin lógica dispersa en la UI.

```ts
type CompanionCard = {
  kind:
    | "empty"
    | "missing_income"
    | "missing_expenses"
    | "uncategorized"
    | "inactive"
    | "month_review"
    | "healthy";
  title: string;
  message: string;
  ctaLabel: string;
  ctaHref: string;
};
```

---

## 13. Reglas iniciales del companion

### 1. Workspace vacío

Condición:

- no existen transacciones.

Resultado esperado:

- mostrar mensaje inicial de arranque,
- CTA hacia nueva transacción.

Ejemplo:

- title: `Empezá a registrar tus movimientos`
- message: `Todavía no cargaste ingresos ni gastos. Tu primer movimiento activa el seguimiento de tu dinero.`
- ctaLabel: `Registrar movimiento`
- ctaHref: `/transactions/new`

### 2. Tiene transacciones sin categoría

Condición:

- `uncategorizedCount > 0`

Resultado esperado:

- priorizar orden y clasificación.

Ejemplo:

- title: `Tenés movimientos para ordenar`
- message: `Hay transacciones sin categoría. Clasificarlas te va a ayudar a que los resúmenes tengan más sentido.`
- ctaLabel: `Revisar transacciones`
- ctaHref: `/transactions`

### 3. Tiene gastos pero no ingresos

Condición:

- existen transacciones,
- `hasExpenses = true`,
- `hasIncome = false`

Resultado esperado:

- sugerir registrar ingresos.

Ejemplo:

- title: `Te falta registrar ingresos`
- message: `Ya empezaste a cargar gastos, pero todavía no registraste ingresos. Sumarlos te va a dar una foto más real de tu balance.`
- ctaLabel: `Registrar ingreso`
- ctaHref: `/transactions/new?type=income`

### 4. Tiene ingresos pero no gastos

Condición:

- existen transacciones,
- `hasIncome = true`,
- `hasExpenses = false`

Resultado esperado:

- sugerir registrar gastos.

Ejemplo:

- title: `Ahora sumá tus gastos`
- message: `Ya registraste ingresos. El siguiente paso es cargar tus gastos para empezar a entender cómo se mueve tu dinero.`
- ctaLabel: `Registrar gasto`
- ctaHref: `/transactions/new?type=expense`

### 5. Inactividad reciente

Condición:

- `daysSinceLastTransaction !== null`,
- `daysSinceLastTransaction >= 4`

Resultado esperado:

- reactivar al usuario.

Ejemplo:

- title: `Hace unos días que no registrás movimientos`
- message: `Mantener tus movimientos al día hace que el balance sea más útil y confiable.`
- ctaLabel: `Registrar movimiento`
- ctaHref: `/transactions/new`

### 6. Revisión de fin de mes

Condición:

- `dayOfMonth >= 25`,
- `hasIncome = true`,
- `hasExpenses = true`

Resultado esperado:

- llevar al usuario al resumen.

Ejemplo:

- title: `Es buen momento para revisar tu mes`
- message: `Ya tenés movimientos suficientes para ver cómo cerró el mes y en qué se fue tu dinero.`
- ctaLabel: `Ir al resumen`
- ctaHref: `/summary`

### 7. Estado saludable / general

Condición:

- no aplica ninguna regla prioritaria anterior.

Resultado esperado:

- mostrar mensaje útil pero liviano.

Ejemplo:

- title: `Vas bien`
- message: `Ya tenés actividad registrada. Podés seguir cargando movimientos o revisar tu resumen cuando quieras.`
- ctaLabel: `Ver resumen`
- ctaHref: `/summary`

---

## 14. Prioridad de reglas

Las reglas deben evaluarse en este orden:

1. workspace vacío,
2. transacciones sin categoría,
3. falta de ingresos,
4. falta de gastos,
5. inactividad,
6. revisión de fin de mes,
7. estado saludable.

Esto evita contradicciones y asegura que el companion priorice la acción más útil.

---

## 15. Función sugerida

```ts
export function getCompanionCard(context: CompanionContext): CompanionCard {
  if (!context.hasTransactions) {
    return {
      kind: "empty",
      title: "Empezá a registrar tus movimientos",
      message:
        "Todavía no cargaste ingresos ni gastos. Tu primer movimiento activa el seguimiento de tu dinero.",
      ctaLabel: "Registrar movimiento",
      ctaHref: "/transactions/new",
    };
  }

  if (context.uncategorizedCount > 0) {
    return {
      kind: "uncategorized",
      title: "Tenés movimientos para ordenar",
      message:
        "Hay transacciones sin categoría. Clasificarlas te va a ayudar a que los resúmenes tengan más sentido.",
      ctaLabel: "Revisar transacciones",
      ctaHref: "/transactions",
    };
  }

  if (context.hasExpenses && !context.hasIncome) {
    return {
      kind: "missing_income",
      title: "Te falta registrar ingresos",
      message:
        "Ya empezaste a cargar gastos, pero todavía no registraste ingresos. Sumarlos te va a dar una foto más real de tu balance.",
      ctaLabel: "Registrar ingreso",
      ctaHref: "/transactions/new?type=income",
    };
  }

  if (context.hasIncome && !context.hasExpenses) {
    return {
      kind: "missing_expenses",
      title: "Ahora sumá tus gastos",
      message:
        "Ya registraste ingresos. El siguiente paso es cargar tus gastos para empezar a entender cómo se mueve tu dinero.",
      ctaLabel: "Registrar gasto",
      ctaHref: "/transactions/new?type=expense",
    };
  }

  if (
    context.daysSinceLastTransaction !== null &&
    context.daysSinceLastTransaction >= 4
  ) {
    return {
      kind: "inactive",
      title: "Hace unos días que no registrás movimientos",
      message:
        "Mantener tus movimientos al día hace que el balance sea más útil y confiable.",
      ctaLabel: "Registrar movimiento",
      ctaHref: "/transactions/new",
    };
  }

  if (
    context.dayOfMonth >= 25 &&
    context.hasIncome &&
    context.hasExpenses
  ) {
    return {
      kind: "month_review",
      title: "Es buen momento para revisar tu mes",
      message:
        "Ya tenés movimientos suficientes para ver cómo cerró el mes y en qué se fue tu dinero.",
      ctaLabel: "Ir al resumen",
      ctaHref: "/summary",
    };
  }

  return {
    kind: "healthy",
    title: "Vas bien",
    message:
      "Ya tenés actividad registrada. Podés seguir cargando movimientos o revisar tu resumen cuando quieras.",
    ctaLabel: "Ver resumen",
    ctaHref: "/summary",
  };
}
```

---

## 16. Consideraciones de UX

La UI del companion debería mantener un formato simple y consistente:

- título corto,
- mensaje de una a dos líneas,
- CTA principal,
- ícono o variante visual según `kind`.

No debería verse como tutorial ni como checklist.

Debe verse como una ayuda viva dentro del dashboard o del punto de entrada principal.

---

## 17. Criterios de aceptación

### Producto

- el usuario entiende qué hacer en pocos segundos,
- la app deja de sentirse pasiva al inicio,
- el companion sigue siendo útil incluso después del onboarding.

### UX

- hay una sola acción principal clara,
- el contenido se siente humano y útil,
- no hay sobrecarga visual ni textual,
- la UI no depende de lógica condicional compleja.

### Técnica

- el sistema ya no depende exclusivamente de una secuencia fija de pasos,
- siempre devuelve una tarjeta válida para un contexto dado,
- la prioridad entre reglas evita contradicciones,
- la UI puede renderizar el resultado desde una estructura unificada.

---

## 18. Fuera de alcance

Quedan fuera de esta etapa:

- persistencia histórica de eventos del companion,
- recomendaciones avanzadas por categoría,
- comparaciones contra meses anteriores,
- machine learning,
- scoring,
- personalización por perfil de usuario.

---

## 19. Evolución posterior sugerida

En iteraciones futuras, este companion podría expandirse con:

- insights automáticos,
- detección de patrones de gasto,
- mensajes según avance del mes,
- reactivación más fina de usuarios inactivos,
- sugerencias de revisión por categoría,
- capa de hábitos o seguimiento semanal.

---

## 20. Resumen operativo

La versión actual de `Empezar` resolvió bien el problema inicial de onboarding liviano.

La siguiente evolución lógica es consolidar esa base en un companion contextual que:

- detecte mejor el momento del usuario,
- priorice una sola acción útil,
- y mantenga valor continuo dentro del producto.

La dirección correcta no es agregar complejidad, sino aumentar relevancia.

`Empezar` debe dejar de ser una guía que se termina y pasar a ser una ayuda que acompaña.
