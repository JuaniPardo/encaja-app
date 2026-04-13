begin;

-- Permite vínculos entre workspaces con monedas distintas.
-- La UI mostrará cada resumen en su moneda original sin conversión.
drop trigger if exists validate_workspace_link_currency on public.workspace_links;
drop function if exists public.validate_workspace_link_currency();

-- También eliminamos la restricción que bloqueaba cambios de moneda
-- cuando existían vínculos activos con otra moneda.
drop trigger if exists prevent_workspace_currency_drift_with_links on public.workspace_settings;
drop function if exists public.prevent_workspace_currency_drift_with_links();

commit;
