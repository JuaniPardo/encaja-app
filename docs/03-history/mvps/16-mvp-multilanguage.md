

# Encaja App — MVP 16

## MVP 16 — Base multiidioma (Español + Inglés)

---

## Objetivo

Preparar Encaja para soportar más de un idioma de forma escalable, comenzando con:

- Español (`es`) como idioma actual
- Inglés (`en`) como nuevo idioma

La meta de este MVP no es traducir solo textos sueltos, sino dejar una base sólida para que la app pueda crecer a futuro sin parches ni strings hardcodeados dispersos.

---

## Problema a resolver

Hoy Encaja está construida en español y eso funciona bien para el usuario actual, pero limita:

- pruebas con usuarios angloparlantes
- expansión a nuevos usuarios
- claridad de mantenimiento cuando empiecen a aparecer más textos en distintas pantallas

Además, ya existe un caso especial importante:

- las categorías por defecto del sistema deben poder crearse en el idioma activo del usuario
- las categorías creadas o editadas por el usuario no deben traducirse automáticamente

La meta de este MVP es separar claramente:

- textos del sistema
- datos definidos por el usuario

---

## Resultado esperado

Al finalizar este MVP, Encaja debe poder:

- funcionar en español e inglés
- detectar o permitir elegir idioma
- renderizar la UI en el idioma activo
- mantener una estructura de traducciones escalable
- crear categorías por defecto iniciales según el idioma del usuario al bootstrap
- respetar que las categorías personalizadas del usuario siguen siendo texto libre y no traducible automáticamente

---

## Alcance

### Incluye

#### 1. Infraestructura i18n
- introducir una capa centralizada de traducciones
- eliminar dependencia de strings hardcodeados en componentes nuevos o prioritarios
- definir namespace o estructura clara por módulos

#### 2. Idiomas soportados en esta etapa
- `es`
- `en`

#### 3. Idioma activo
- definir cómo se resuelve el idioma activo del usuario
- permitir fallback claro

#### 4. Textos del sistema
Traducir gradualmente los textos del sistema, incluyendo:

- navegación
- títulos
- labels
- botones
- mensajes vacíos
- estados
- mensajes del dashboard
- insights
- formularios

#### 5. Categorías por defecto
- las categorías iniciales del bootstrap deben crearse según el idioma activo
- deben existir catálogos base al menos para `es` y `en`

#### 6. Persistencia de idioma
- definir dónde se guarda la preferencia de idioma
- idealmente a nivel usuario o workspace según la decisión de producto

---

### NO incluye

Este MVP no debe incluir:

- traducción automática por IA
- más idiomas aparte de español e inglés
- traducción automática de contenido creado por el usuario
- localización avanzada por región
- múltiples formatos monetarios por locale
- multi-moneda

---

## Decisiones de producto

### 1. Textos del sistema vs contenido del usuario
Diferenciar claramente:

#### Textos del sistema
Sí se traducen:
- botones
- navegación
- labels
- mensajes
- categorías por defecto iniciales

#### Contenido del usuario
No se traduce automáticamente:
- categorías editadas manualmente
- nombres de workspaces
- nombres de medios de pago
- descripciones y notas de transacciones

### 2. Categorías por defecto solo al inicio
Las categorías base se crean en el idioma activo durante el bootstrap inicial del workspace.

Después:
- si el usuario las edita, pasan a ser contenido propio
- no deben re-traducirse al cambiar idioma

### 3. Fallback
Si falta una traducción:
- fallback a español o al idioma base definido
- evitar mostrar keys técnicas en producción si es posible

### 4. Escalabilidad
No resolver esto con condicionales manuales tipo:
- `if (lang === 'en')`
- strings embebidos en componentes

La base debe quedar preparada para crecer bien.

---

## Pregunta de diseño importante

### ¿Dónde vive la preferencia de idioma?

Opciones razonables:

#### Opción A — nivel usuario
Ventajas:
- consistente para toda la app
- más natural si el mismo usuario usa varios workspaces

#### Opción B — nivel workspace
Ventajas:
- útil si un workspace se comparte con otras personas y se quiere una experiencia uniforme

### Recomendación para esta etapa
Usar preferencia de idioma a **nivel usuario**.

Motivo:
- el idioma es preferencia de lectura del usuario
- evita mezclar configuración financiera del workspace con preferencia visual

---

## Propuesta técnica

### 1. Capa de traducción
Definir una función o hook centralizado, por ejemplo:

- `t('dashboard.balancePeriod')`
- `useI18n()` o equivalente

### 2. Organización de diccionarios
Propuesta por namespaces:

- `common`
- `nav`
- `dashboard`
- `insights`
- `transactions`
- `budget`
- `categories`
- `paymentMethods`
- `settings`
- `auth`

### 3. Formato sugerido
Archivos por idioma, por ejemplo:

- `locales/es/common.json`
- `locales/en/common.json`

O estructura equivalente si preferís consolidar por módulo.

### 4. Resolución de idioma activo
Orden sugerido:

1. preferencia guardada del usuario
2. fallback por defecto (`es`)

Opcionalmente, en una etapa muy inicial:
- detectar idioma del navegador solo si no existe preferencia guardada

---

## Categorías por defecto

### Regla funcional
Cuando se bootstrappea un workspace nuevo, las categorías base deben generarse en el idioma activo del usuario en ese momento.

### Ejemplo
Si el idioma activo es `en`, el bootstrap debería crear algo equivalente a:

- Salary
- Rent
- Groceries
- Transport
- Savings

Si el idioma activo es `es`, crear:

- Sueldo
- Alquiler
- Mercado
- Transporte
- Ahorro

### Importante
Una vez creadas:
- se consideran datos del workspace
- no deben cambiar automáticamente si el usuario cambia el idioma más tarde

---

## Reglas funcionales

### 1. UI
Toda la UI del sistema debe poder renderizarse en español o inglés.

### 2. Cambio de idioma
El usuario debe poder cambiar idioma de forma explícita desde configuración o lugar equivalente.

### 3. Persistencia
La preferencia debe guardarse para próximas sesiones.

### 4. Bootstrap
El idioma activo impacta en la creación inicial de categorías por defecto.

### 5. Contenido libre
No se traduce automáticamente el contenido creado por el usuario.

---

## Criterios de aceptación

### Producto
- la app se puede usar en español e inglés
- el usuario puede cambiar idioma sin confusión
- las categorías por defecto nuevas respetan el idioma activo en bootstrap
- el contenido propio del usuario no se altera por cambiar idioma

### UX
- la navegación y los textos clave se ven naturales en ambos idiomas
- no aparecen mezclas raras de idiomas en flujos principales
- el cambio de idioma se siente consistente

### Técnica
- existe una capa centralizada de traducciones
- los strings del sistema no siguen dispersos en componentes nuevos o revisados
- el sistema queda listo para agregar más idiomas después

---

## Orden de implementación

### 1
- definir estrategia de i18n y preferencia de idioma

### 2
- crear estructura de diccionarios `es` / `en`

### 3
- introducir hook o helper centralizado de traducción

### 4
- migrar textos de navegación y layout global

### 5
- migrar textos de pantallas clave

### 6
- adaptar bootstrap de categorías por defecto al idioma activo

### 7
- agregar selector de idioma en configuración

### 8
- pulir fallbacks y consistencia visual

---

## Definición de terminado

El MVP está completo cuando Encaja cuenta con una base multiidioma sólida para español e inglés, permite renderizar la UI en ambos idiomas, guarda la preferencia del usuario y genera categorías por defecto en el idioma activo durante el bootstrap, sin traducir automáticamente el contenido libre creado por el usuario.

---

## Próximos pasos sugeridos

Después de este MVP, los siguientes incrementos posibles podrían ser:

- localización más fina por región
- nuevos idiomas
- mejoras de formato por locale
- revisión completa de copy bilingüe