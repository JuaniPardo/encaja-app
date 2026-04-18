# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

# Encaja App — AGENTS.md

## Propósito
Este archivo define las reglas de trabajo para cualquier agente o asistente que genere código, documentación o refactors dentro de este repositorio.

---

## 1. Contexto del producto

Encaja es una aplicación web de presupuesto y control financiero personal basada en una planilla de Excel existente. No debe copiar Excel visualmente; debe traducir su lógica a un producto web claro, mantenible y escalable.

La aplicación está diseñada para comenzar como una experiencia simple, pero con arquitectura lista para evolucionar a multiusuario mediante workspaces.

---

## 2. Stack del proyecto

- Next.js (App Router)
- TypeScript
- Mantine
- Supabase (Auth + Postgres + RLS)
- React Hook Form
- Zod

---

## 2.1 Entorno de terminal (Codex)

- En sesiones de Codex, `node`/`npm` pueden no estar en el `PATH` por defecto.
- Para ejecutar comandos de Node, usar:
  - `PATH="/usr/local/bin:/opt/homebrew/bin:$PATH" npm run lint`
  - `PATH="/usr/local/bin:/opt/homebrew/bin:$PATH" npm run build`
- Nota operativa: el build puede requerir acceso de red para descargar Google Fonts.
- Supabase CLI (ruta operativa en este repo): `/tmp/supabase-cli/supabase`
  - Ver estado de migraciones: `/tmp/supabase-cli/supabase migration list`
  - Aplicar migraciones remotas: `/tmp/supabase-cli/supabase db push --yes`
  - Si el binario no existe, reinstalar en esa ruta:
    - `rm -rf /tmp/supabase-cli && mkdir -p /tmp/supabase-cli`
    - `cd /tmp/supabase-cli && curl -fL https://github.com/supabase/cli/releases/download/v2.90.0/supabase_darwin_arm64.tar.gz -o supabase.tar.gz`
    - `cd /tmp/supabase-cli && tar -xzf supabase.tar.gz && chmod +x /tmp/supabase-cli/supabase`

---

## 3. Restricción crítica sobre Next.js

Este proyecto usa una versión moderna de Next.js con App Router.

Antes de generar código que dependa de APIs, convenciones o estructura de Next.js, revisar la documentación local del proyecto dentro de:

`node_modules/next/dist/docs/`

No asumir compatibilidad con ejemplos viejos ni con patrones heredados de Pages Router.

---

## 4. Principios de desarrollo

- Priorizar claridad por sobre cleverness.
- Evitar sobreingeniería.
- Construir por MVPs pequeños y cerrados.
- No introducir complejidad futura antes de que sea necesaria.
- Mantener separación entre UI, lógica de negocio y acceso a datos.
- Mantener el modelo multi-tenant por `workspace_id`.

---

## 5. Reglas de arquitectura

- Los datos financieros pertenecen al workspace, no al usuario.
- No colgar datos de negocio directamente de `profiles`.
- Toda entidad de negocio debe respetar ownership por `workspace_id` cuando aplique.
- No romper la separación entre planificación (budget) y ejecución (transactions).
- No implementar soluciones single-user rígidas.

---

## 6. Reglas para frontend

- Usar Mantine como librería base de UI.
- No introducir Tailwind.
- Preferir componentes reutilizables y wrappers propios cuando tenga sentido.
- Mantener una UI sobria, clara y orientada a gestión.
- Evitar estilos dispersos o mezclas innecesarias de estrategias de styling.

---

## 7. Reglas para formularios

- Usar React Hook Form + Zod.
- No usar Mantine Form como solución principal.
- Mantener schemas de validación explícitos.
- Reutilizar tipos inferidos desde Zod cuando sea útil.

---

## 8. Reglas para Supabase

- Usar Supabase como fuente principal de datos y auth.
- Mantener el diseño preparado para RLS.
- No asumir acceso global a datos sin filtrar por workspace.
- Mantener funciones de bootstrap de usuario/workspace bien delimitadas.

---

## 9. Reglas para implementación

Cuando se implemente una feature nueva:

1. revisar el documento funcional correspondiente en `/docs`
2. respetar el modelo de datos y reglas de negocio ya definidos
3. construir solo el alcance del MVP actual
4. no agregar features fuera de alcance

---

## 10. Documentación del proyecto

Tomar como referencia principal los archivos dentro de `/docs`, especialmente:

- `01-vision-v1.md`
- `02-modelo_de_datos-v1.md`
- `03-reglas_de_negocio-v1.md`
- `01-mvp1-definition.md`
- `04-lineamientos-ui-v1.md`

Si hay contradicción entre código y documentación, preferir alinear el código a la documentación vigente, salvo que se esté haciendo una refactorización explícita de los documentos.

---

## 11. Estilo de código

- TypeScript estricto.
- Nombres claros y semánticos.
- Evitar comentarios redundantes.
- Evitar archivos excesivamente grandes.
- Preferir composición por sobre duplicación.
- No optimizar prematuramente.

---

## 12. Qué evitar

- No agregar charts, data grids complejos o automatizaciones fuera del MVP.
- No usar React Compiler en esta etapa.
- No mezclar reglas de negocio dentro de componentes visuales.
- No hardcodear lógica de ownership fuera del modelo de workspace.
- No introducir librerías innecesarias.

---

## 13. Resultado esperado de cualquier agente

Cada cambio debería dejar el proyecto:

- más claro
- más consistente
- más alineado con los documentos
- más cerca del MVP actual

---

## 14. Versionado y workflow de releases

El sistema de versionado y releases del proyecto está definido en:

`/docs/dev-workflow.md`

Todo agente debe respetar:

- versionado semántico (SemVer)
- flujo feature → develop → main
- reglas de branching
- proceso de releases

Reglas clave:

- ❌ No modificar versiones en branches `feature/*`
- ❌ No modificar versiones en `develop`
- ✅ Versionar únicamente al hacer release
- ✅ La versión siempre representa el estado de `main`

Este flujo es obligatorio para mantener consistencia, trazabilidad y estabilidad del producto.

---
