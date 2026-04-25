

# Encaja App — MVP 20

## MVP 20 — Perfil de usuario (implementación técnica)

---

## Objetivo

Implementar la capa de perfil de usuario en Encaja, permitiendo:

- editar nombre
- cambiar contraseña
- separar configuración personal del workspace
- preparar migración de idioma al perfil

---

## 1. Backend (Supabase)

### 1.1 Uso de tabla existente

Se reutiliza la tabla `profiles`:

Campos relevantes:

- `id`
- `email`
- `full_name`

No se requieren migraciones en esta etapa.

---

## 2. Frontend

### 2.1 Nueva ruta

Crear:

- `/profile`

Agregar a ROUTES:

```ts
PROFILE: '/profile'
```

---

### 2.2 Página de perfil

Archivo sugerido:

```
src/features/profile/pages/profile-page.tsx
```

---

### 2.3 Estructura UI

Usar Mantine:

- Container
- Card
- Stack
- TextInput
- Button
- Divider

---

### 2.4 Código base

```tsx
import { useEffect, useState } from 'react'
import { TextInput, Button, Stack, Card, Title } from '@mantine/core'
import { supabase } from '@/lib/supabase'
import { showNotification } from '@mantine/notifications'

export default function ProfilePage() {
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadProfile()
  }, [])

  async function loadProfile() {
    const { data: user } = await supabase.auth.getUser()

    if (!user?.user) return

    const { data } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.user.id)
      .single()

    if (data) setFullName(data.full_name || '')
  }

  async function updateProfile() {
    setLoading(true)

    const { data: user } = await supabase.auth.getUser()

    if (!user?.user) return

    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName })
      .eq('id', user.user.id)

    setLoading(false)

    if (error) {
      showNotification({
        title: 'Error',
        message: 'No se pudo actualizar el perfil',
        color: 'red'
      })
      return
    }

    showNotification({
      title: 'Perfil actualizado',
      message: 'Tus cambios fueron guardados',
      color: 'green'
    })
  }

  async function resetPassword() {
    const { data: user } = await supabase.auth.getUser()

    if (!user?.user?.email) return

    await supabase.auth.resetPasswordForEmail(user.user.email)

    showNotification({
      title: 'Email enviado',
      message: 'Revisá tu correo para cambiar la contraseña',
      color: 'blue'
    })
  }

  return (
    <Stack>
      <Title order={2}>Tu perfil</Title>

      <Card withBorder>
        <Stack>
          <TextInput
            label="Nombre"
            value={fullName}
            onChange={(e) => setFullName(e.currentTarget.value)}
          />

          <Button onClick={updateProfile} loading={loading}>
            Guardar cambios
          </Button>
        </Stack>
      </Card>

      <Card withBorder>
        <Stack>
          <Title order={4}>Seguridad</Title>

          <Button variant="light" onClick={resetPassword}>
            Cambiar contraseña
          </Button>
        </Stack>
      </Card>
    </Stack>
  )
}
```

---

## 3. Navegación

Agregar acceso al perfil:

Opciones recomendadas:

- desde avatar
- desde settings

NO ubicarlo como item principal del sidebar.

---

## 4. Reglas

- cada usuario solo edita su perfil
- no depende del workspace
- no afecta datos financieros

---

## 5. Futuro inmediato

Preparar para mover:

- idioma → perfil

Estructura sugerida futura:

```ts
profiles:
- language
- timezone
- preferences_json
```

---

## 6. Criterios de aceptación

- usuario puede editar su nombre
- usuario puede iniciar cambio de contraseña
- UI clara y consistente
- sin impacto en workspace

---

## Resultado

Encaja ahora tiene una capa de identidad real del usuario, separada de la lógica financiera y lista para evolucionar.