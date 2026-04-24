# Release 1.0.0 Baseline Document

## Resumen del Producto
**Encaja** es una aplicación web de control financiero personal y familiar, nacida de la necesidad de traducir la flexibilidad y robustez de una planilla de Excel avanzada a una experiencia digital segura, accesible y escalable.

Su arquitectura se basa en el concepto de **Workspaces**, permitiendo a los usuarios separar sus finanzas personales de las familiares o de pequeños proyectos, con la capacidad de colaborar con otros miembros.

## Alcance funcional actual (v1.0.0)
- **Infraestructura Core**:
  - Auth integrado con Supabase.
  - Multi-tenancy real por `workspace_id`.
- **Módulo de Ingresos y Gastos**:
  - Registro de transacciones simples.
  - Gestión de categorías (ingresos/gastos).
  - Asociación con métodos de pago (cuentas/tarjetas).
- **Módulo de Planificación**:
  - Definición de presupuestos por categoría.
  - Seguimiento en tiempo real de lo ejecutado vs. lo presupuestado.
- **Visualización**:
  - Dashboard consolidado con saldos por método de pago.
  - Resumen visual de gastos mensuales.

## Estado general del sistema
- **Madurez**: Estable para uso diario. El sistema ha superado las pruebas críticas de integridad de datos y cálculo presupuestario.
- **Seguridad**: RLS (Row Level Security) activo en Supabase, garantizando el aislamiento de datos entre espacios de trabajo.
- **Uso real**: Actualmente utilizado por un grupo reducido de testers que han validado la consistencia de los flujos principales.

## Limitaciones conocidas en esta versión
- No cuenta con reportes históricos consolidados de más de 12 meses.
- No dispone de importación automática de extractos bancarios (CSV/PDF).
- No incluye conciliación bancaria automatizada.
- Visualización gráfica básica (sin charts avanzados o tendencias profundas).

## Objetivo de la v1.0.0
Establecer la **Línea de Base (Baseline)** formal de Encaja. Esta versión marca el cierre de la etapa de prototipado y MVP inicial, definiendo el estándar de calidad y arquitectura sobre el cual se construirán las siguientes etapas (multi-usuario avanzado, reportes complejos, etc.).
