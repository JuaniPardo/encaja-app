# Encaja App — Visión del Producto v1

## Fecha
2026-04-10

## Estado
Draft

## Autor
Juan Pardo

---

## 1. Qué es Encaja

Encaja es una aplicación web de presupuesto y control financiero personal nacida a partir de una planilla de Excel ya madura y funcional. El objetivo no es copiar la planilla de forma literal, sino transformar su lógica en un producto digital más claro, mantenible, accesible y escalable.

La aplicación permitirá planificar presupuestos, registrar movimientos reales, analizar desvíos y visualizar indicadores clave desde una interfaz web moderna.

---

## 2. Problema que busca resolver

Hoy la lógica financiera ya existe en una planilla de Excel que permite trabajar con presupuestos, gastos, ingresos, ahorro y dashboard. Sin embargo, una planilla tiene límites naturales:

- depende de fórmulas y estructuras manuales
- es más difícil de mantener a medida que crece
- no está pensada para escalar a múltiples usuarios
- no ofrece una experiencia de uso optimizada para web o mobile
- vuelve más costoso evolucionar la lógica del producto

Encaja busca resolver esto transformando una solución útil pero artesanal en una aplicación web sólida, evolutiva y preparada para crecer.

---

## 3. Objetivo principal del producto

Construir una aplicación web que permita:

- definir presupuestos por categoría y período
- registrar ingresos, gastos y ahorro
- comparar ejecución real contra presupuesto
- visualizar balances, métricas y resúmenes
- evolucionar a futuro hacia un producto compartible o vendible

---

## 4. Usuario inicial

El usuario inicial es el propio autor del proyecto, que ya utiliza una planilla de Excel para administrar su economía y tiene bastante clara la lógica del sistema que desea construir.

Esto representa una ventaja importante: el producto no nace desde cero ni desde una necesidad abstracta, sino desde un flujo real ya validado en la práctica.

---

## 5. Usuarios futuros

Aunque el MVP inicial se orienta a un uso personal, el producto se diseñará desde el inicio para permitir una evolución futura hacia otros escenarios, por ejemplo:

- uso familiar
- uso compartido entre socios o pareja
- uso para distintos espacios financieros separados
- producto SaaS para otros usuarios

Por eso la arquitectura no se pensará como single-user rígido, sino como una base escalable soportada por workspaces.

---

## 6. Qué hace diferente a Encaja

Encaja no pretende ser solo una app para “anotar gastos”.

Su valor diferencial está en combinar tres capas que en muchos productos aparecen separadas:

### 6.1 Planificación
El usuario define cuánto espera ingresar, gastar o ahorrar en un período.

### 6.2 Ejecución
El usuario registra los movimientos reales que efectivamente ocurren.

### 6.3 Análisis
El sistema compara lo planificado contra lo ejecutado y devuelve indicadores útiles para tomar decisiones.

En otras palabras, Encaja combina presupuesto, seguimiento y lectura del resultado en un único flujo.

---

## 7. Qué no es Encaja

Para evitar desvíos, es importante definir también qué no es este producto en esta etapa.

Encaja no busca ser inicialmente:

- una app bancaria
- una plataforma contable empresarial
- un ERP
- una herramienta de conciliación automática avanzada
- una solución cargada de automatizaciones prematuras
- una app de inversiones complejas

El foco inicial está en el control financiero personal o de pequeños espacios de gestión, con una experiencia clara y una lógica sólida.

---

## 8. Alcance funcional esperado

A nivel general, el producto debería cubrir estos bloques:

### 8.1 Presupuesto
- definición de presupuestos por categoría
- organización por mes y año
- subtotales y totales

### 8.2 Movimientos
- registro de ingresos, gastos y ahorro
- clasificación por categoría
- asociación a medio de pago cuando corresponda
- manejo de fecha y eventualmente fecha efectiva

### 8.3 Configuración
- parámetros del workspace
- medios de pago
- categorías activas
- reglas de cálculo base

### 8.4 Análisis y dashboard
- balance del período
- comparación real vs presupuesto
- porcentaje de ejecución
- ahorro del período
- indicadores resumidos

---

## 9. Principios del producto

El desarrollo de Encaja debería guiarse por estos principios:

### 9.1 Claridad
El usuario debe entender fácilmente qué está viendo y qué impacto tienen sus registros.

### 9.2 Incrementalidad
El producto se construirá por MVPs pequeños, cerrados y funcionales.

### 9.3 Escalabilidad
Aunque el arranque sea simple, la base técnica debe permitir crecer.

### 9.4 Fidelidad a la lógica real
La app debe respetar la lógica de negocio validada en la planilla, pero sin quedar presa de la forma de Excel.

### 9.5 Simplicidad
No se agregarán complejidades técnicas o funcionales que todavía no generen valor real.

---

## 10. Visión a futuro

A futuro, Encaja podría evolucionar hacia:

- múltiples workspaces por usuario
- invitación de otros miembros a un workspace
- dashboards más avanzados
- mejores reportes
- reglas más sofisticadas para tarjeta, ahorro e imputación temporal
- experiencia SaaS para terceros

La visión no es solo “digitalizar una planilla”, sino construir una base de producto que pueda crecer sin rehacerse por completo.

---

## 11. Criterio de éxito inicial

En una primera etapa, Encaja será exitoso si logra reemplazar de forma útil y clara la lógica principal de la planilla actual en una experiencia web más ordenada.

Eso implica, como mínimo:

- cargar categorías
- definir presupuesto mensual
- registrar movimientos
- obtener un resumen confiable del período

Si eso funciona bien, el producto ya habrá demostrado valor real.

---

## 12. Relación con la implementación

Este documento no define tablas, endpoints ni componentes concretos. Su función es fijar el sentido del producto y servir como referencia para los siguientes documentos:

- arquitectura inicial
- modelo de datos v1
- reglas de negocio v1
- definición de MVPs
- prompts de Vibe Coding

---

## 13. Resumen ejecutivo

Encaja es una app web de presupuesto y control financiero basada en una lógica ya validada en Excel. Su propósito es convertir esa lógica en un producto más claro, mantenible y escalable. Nace para uso personal, pero se diseña desde el inicio con visión multiusuario y posibilidad de evolución a SaaS. El foco inicial estará en presupuesto, registro de movimientos, configuración base y análisis del período mediante una construcción incremental por MVPs.
