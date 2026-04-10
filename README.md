# Encaja App

Aplicación web de **presupuesto y control financiero personal** basada en una planilla de Excel existente, diseñada para evolucionar a un producto multiusuario (SaaS) en el futuro.

---

## 🧭 Objetivo

- Definir presupuestos por período y categoría
- Registrar ingresos, gastos y ahorro
- Comparar ejecución real vs presupuesto
- Visualizar indicadores y balances
- Escalar a múltiples usuarios mediante workspaces

---

## 🧱 Stack Tecnológico

### Frontend
- Next.js (App Router)
- TypeScript
- Mantine (UI + hooks)

### Backend / Plataforma
- Supabase
  - Postgres
  - Auth
  - Row Level Security (RLS)

### Formularios
- React Hook Form
- Zod

---

## 🏗️ Arquitectura (Resumen)

- Modelo **multi-tenant por workspace**
- Cada dato pertenece a un `workspace_id`
- Un usuario puede pertenecer a múltiples workspaces
- RLS en Supabase para aislar datos

> En el MVP inicial, la experiencia es single-workspace, pero el modelo ya es escalable.

---

## 📦 Estructura del Proyecto (inicial)

```
src/
  app/
  components/
  features/
  lib/
  hooks/
  types/
```

---

## 🚀 Getting Started

### 1. Instalar dependencias

```bash
npm install
```

### 2. Variables de entorno

Crear un archivo `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

---

### 3. Correr el proyecto

```bash
npm run dev
```

Abrir en:

👉 http://localhost:3000

---

## 📌 Estado del Proyecto

Actualmente en fase:

👉 Definición de arquitectura + construcción incremental (Vibe Coding)

---

## 🧩 Roadmap (alto nivel)

### MVP 0
- Setup base
- Layout

### MVP 1
- Categorías
- Settings

### MVP 2
- Presupuesto mensual

### MVP 3
- Registro de movimientos

### MVP 4
- Resumen mensual

### MVP 5
- Dashboard

---

## ⚠️ Principios de Desarrollo

- Simplicidad primero
- Iteración incremental
- Arquitectura escalable
- Reglas de negocio explícitas
- Evitar sobreingeniería

---

## 🧠 Notas

- No usar React Compiler en esta etapa
- No optimizar prematuramente
- Mantener foco en MVPs pequeños y funcionales

---

## 📄 Próximos documentos

- Modelo de datos v1
- Reglas de negocio v1
- Definición de MVPs detallados

---

## 🧑‍💻 Autor

Proyecto en desarrollo por Juan Pardo

---

## 📜 Licencia

Pendiente
