# Encaja App — MVP 17

## MVP 17 — Revamping de la página de Settings

---

## Objetivo

Rediseñar y reorganizar la página de Settings para que deje de sentirse como una pantalla secundaria o técnica y pase a ser un centro claro de configuración del producto.

La meta de este MVP es que Settings funcione como el lugar donde el usuario entiende y administra las reglas generales de su experiencia en Encaja, con mejor jerarquía, mejor organización y mejor utilidad real.

---

## Problema a resolver

A medida que Encaja creció, la cantidad de configuraciones y decisiones globales también creció.

Hoy Settings corre el riesgo de convertirse en una pantalla:

- dispersa
- poco jerárquica
- demasiado técnica
- difícil de escanear
- poco alineada con el nivel visual del resto del producto

Además, varias configuraciones actuales o futuras necesitan una mejor “casa” dentro del sistema, por ejemplo:

- idioma
- moneda (selector, obligatoria y única por workspace)
- visualización de centavos (mostrar/ocultar, sin afectar el almacenamiento real)
- preferencias generales del workspace
- gestión de miembros
- gestión de workspaces vinculados
- features futuras relacionadas con plan o permisos

La meta de este MVP es transformar Settings en una pantalla ordenada, clara y preparada para crecer.

---

## Resultado esperado

Al finalizar este MVP, un usuario debe poder:

- entender rápidamente qué configuraciones existen
- encontrar fácilmente la configuración que busca
- distinguir entre preferencias personales, configuraciones del workspace y opciones avanzadas
- sentir que Settings forma parte del mismo sistema de diseño y calidad del resto de Encaja
- acceder desde Settings a configuraciones relacionadas con colaboración, idioma y linking sin confusión

---

## Alcance

### Incluye

#### 1. Reorganización de Settings
- redefinir la estructura general de la pantalla
- agrupar configuraciones por tema
- mejorar jerarquía visual

#### 2. Secciones claras
Separar Settings al menos en bloques como:

- Preferencias personales
- Configuración del workspace
- Colaboración
- Integraciones o vínculos
- Avanzado

#### 3. Integración de configuraciones existentes y futuras
Settings debe poder alojar de forma coherente elementos como:

- idioma
- moneda (selector, obligatoria y única por workspace)
- mostrar/ocultar centavos (sin afectar el almacenamiento real)
- nombre del workspace
- miembros del workspace
- workspaces vinculados
- preferencias del período o comportamiento general

#### 4. UX y copy
- usar lenguaje claro y no demasiado técnico
- mejorar labels, subtítulos y descripciones breves
- ayudar al usuario a entender el impacto de cada ajuste

#### 5. Consistencia visual
- alinear esta pantalla con Dashboard, Insights, Transacciones, Categorías y Medios de pago
- evitar look de panel administrativo crudo

---

### NO incluye

Este MVP no debe incluir:

- monetización activa
- billing real
- automatizaciones complejas
- permisos granulares avanzados
- settings extremadamente técnicos visibles al usuario final

---

## Decisiones de producto

### 1. Settings no es un cajón de sastre
No debe ser una lista plana de toggles o formularios sin orden.

### 2. Separar por nivel de responsabilidad
Debe diferenciar claramente:

#### Preferencias personales
Configuraciones del usuario, por ejemplo:
- idioma

#### Configuración del workspace
Configuraciones compartidas por quienes usan ese workspace, por ejemplo:
- nombre
- moneda (selector, obligatoria y única por workspace)
- centavos (mostrar/ocultar, sin afectar el almacenamiento real)

#### Colaboración
- miembros
- roles visibles
- invitaciones

#### Vínculos y relaciones
- workspaces vinculados
- resúmenes externos

### 3. Escalable
La estructura debe quedar preparada para futuras configuraciones sin necesidad de rediseñar toda la pantalla otra vez.

### 4. Moneda a nivel workspace
- cada workspace debe tener una única moneda definida
- la moneda debe elegirse mediante un `select`, no mediante input libre
- todas las transacciones deben operar en esa moneda
- no se soporta multi-moneda en esta etapa
- esta decisión simplifica cálculos, reporting y linking entre workspaces

### 5. Centavos (visual vs dato real)
- el usuario puede elegir mostrar u ocultar centavos en la interfaz
- esta configuración no afecta el almacenamiento real ni cálculos internos
- mejora la legibilidad sin perder precisión

---

## Propuesta de estructura

### Sección 1 — Preferencias personales
Ejemplos:
- idioma

### Sección 2 — Workspace actual
Ejemplos:
- nombre del workspace
- moneda (selector, obligatoria y única por workspace)
- mostrar/ocultar centavos (sin afectar el almacenamiento real)
- otras preferencias globales del workspace

### Sección 3 — Colaboración
Ejemplos:
- miembros del workspace
- invitaciones
- rol actual del usuario dentro del workspace

### Sección 4 — Workspaces vinculados
Ejemplos:
- vínculos activos
- crear vínculo
- gestionar resúmenes externos

### Sección 5 — Avanzado
Solo si realmente aporta valor.
No debe dominar la pantalla.

---

## Reglas funcionales

### 1. Claridad
Cada configuración debe tener:
- título claro
- descripción breve si hace falta
- acción comprensible

### 2. Responsabilidad
El usuario debe entender si una configuración afecta:
- solo a él
- al workspace completo
- a otros miembros del workspace

### 3. Permisos
No todas las opciones deben verse o editarse igual para owner y member.

Por ejemplo:
- owner puede editar settings estructurales del workspace
- member puede ver algunos, pero no necesariamente cambiarlos

### 4. Modularidad
Cada bloque debe poder crecer sin romper la estructura general.

---

## Propuesta de UX

### 1. Layout
La pantalla debe sentirse más como una serie de módulos bien agrupados que como un formulario largo sin jerarquía.

### 2. Navegación interna
Opcionalmente se puede evaluar:
- tabs
- secciones con anchors
- cards agrupadas

La solución elegida debe ser simple y clara.

### 3. Estados vacíos
Si una sección no tiene elementos todavía, debe comunicarse claramente.

Ejemplo:
- no hay workspaces vinculados
- no hay miembros adicionales

### 4. Mobile
En mobile, Settings debe seguir siendo muy legible.
No debe convertirse en una pantalla pesada o confusa.

---

## Criterios de aceptación

### Producto
- el usuario entiende mejor qué puede configurar
- Settings deja de sentirse como una pantalla secundaria improvisada
- la pantalla queda preparada para crecer con el producto

### UX
- la jerarquía visual es clara
- las secciones son fáciles de escanear
- cada ajuste se entiende rápidamente

### Permisos
- owner y member ven una experiencia coherente con su rol
- no aparecen controles que el usuario no debería tocar sin contexto

### Consistencia
- Settings se siente alineado con el resto de Encaja
- desaparece la sensación de “panel técnico aislado”

---

## Orden de implementación

### 1
- definir arquitectura de secciones de Settings

### 2
- reorganizar configuraciones existentes

### 3
- mejorar copy y labels

### 4
- ajustar visibilidad según rol

### 5
- pulir diseño responsive

### 6
- dejar estructura preparada para configuraciones futuras

---

## Definición de terminado

El MVP está completo cuando la página de Settings pasa a ser una pantalla clara, jerárquica y preparada para crecimiento, permitiendo administrar de forma entendible preferencias personales, configuración del workspace, colaboración y vínculos entre workspaces dentro de una experiencia coherente con el resto del producto.

---

## Próximos pasos sugeridos

Después de este MVP, los siguientes incrementos posibles podrían ser:

- visibilidad más fina por rol
- settings avanzados de linking
- configuración de features premium cuando se active monetización
- mejoras de onboarding según configuración inicial
