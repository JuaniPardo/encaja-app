# Entornos

## Objetivo

Separar los datos reales de las pruebas, para poder verificar sesiones, RLS y migraciones sin riesgo.

---

## 1. Mapa

| Entorno | Rama | URL | Supabase |
|---|---|---|---|
| Producción | `main` | https://encaja-app.vercel.app/ | Producción |
| Develop | `develop` | https://encaja-app-git-develop-juan-pardos-projects.vercel.app/ | Producción, hasta completar §3 |
| Local | cualquiera | http://localhost:3000 | Producción, hasta completar §3 |

La columna muestra el estado actual: el destino de Develop y Local es Desarrollo, pero el proyecto todavía no existe.

Develop está protegido por el login de Vercel.

---

## 2. Reglas

1. Producción nunca se usa para probar.
2. `supabase db push` sin `--db-url` apunta al proyecto enlazado, que es producción. Solo lo ejecuta el usuario desde su terminal, durante un release. Ningún agente puede hacerlo: los hooks lo niegan, según `fabrica-controles.md`.
3. Las migraciones se aplican primero en desarrollo, con `scripts/supabase-dev-migrate.sh`.
4. Las credenciales no van al repo ni al chat. Las claves `service_role` o secretas no se usan en la app.
5. Desarrollo solo contiene datos de prueba. No se copian datos reales.
6. Un worktree también queda enlazado a producción, porque `supabase/.temp/` está versionado. `supabase db push` sin `--db-url` allí pega en producción.
7. La build de verificación usa placeholders en línea, para no cargar `.env.local`. El comando está en `fabrica-controles.md`.

---

## 3. Crear el proyecto de desarrollo

Se hace una sola vez.

### Supabase

1. Crear un proyecto `encaja-dev`, en la misma región que producción.
2. Guardar la contraseña de la base en un gestor de contraseñas.
3. En Authentication → URL Configuration:
   - **Site URL:** la URL de develop.
   - **Redirect URLs:** la URL de develop y `http://localhost:3000/**`.
4. Copiar de Authentication la configuración de producción que afecte a las pruebas, como la confirmación de email y las sesiones.

### Migraciones

Copiar la cadena de conexión del proyecto desde Connect, con la contraseña codificada para URL. Pegarla cuando la pida `read`: no se muestra ni queda en el historial de la terminal.

```bash
read -rs SUPABASE_DEV_DB_URL && export SUPABASE_DEV_DB_URL
```

Simular primero:

```bash
scripts/supabase-dev-migrate.sh
```

Si la lista de migraciones es correcta, aplicar:

```bash
scripts/supabase-dev-migrate.sh --apply
```

Borrar la variable al terminar:

```bash
unset SUPABASE_DEV_DB_URL
```

### Vercel

1. En Settings → Environment Variables, definir `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` con los valores de desarrollo, **solo para Preview**.
2. No modificar los valores de Production.
3. Volver a desplegar `develop`: las variables `NEXT_PUBLIC_*` se fijan durante el build.

### Local

Cambiar `.env.local` para que apunte a desarrollo. Hasta ese cambio, `npm run dev` usa la base de producción.

### Verificación

1. Abrir develop y comprobar que el proyecto que usa ya no es el de producción.
2. Abrir producción y comprobar que sigue funcionando con sus datos.
3. Registrar una cuenta de prueba en develop y confirmar que no aparece en producción.

---

## 4. Uso diario

- Toda migración nueva se aplica y se prueba en desarrollo antes del release.
- Si desarrollo queda en mal estado, se puede borrar y recrear con esta guía: no tiene datos que conservar.
