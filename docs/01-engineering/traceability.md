# Trazabilidad y rollback

## Objetivo

Poder responder tres preguntas sobre cualquier cambio: qué se hizo y por qué, cuándo apareció un bug, y cómo deshacerlo sin dañar datos.

---

## 1. Qué conecta cada cosa

| Fuente | Responde |
|---|---|
| `docs/03-history/changes/` | Qué se pidió, cómo se verificó, qué vigilar y cómo revertir |
| Trailer `Change-Id` en commits | Qué commits pertenecen a un cambio |
| Merge `--no-ff` | Qué se integró como una unidad, para revertirlo de una vez |
| Tags `vX.Y.Z` | Qué código tiene cada versión |
| `CHANGELOG.md` y `docs/03-history/releases/` | Qué recibió el usuario en cada release |
| `supabase/migrations/` | Qué cambió en la base y en qué orden |

---

## 2. Reglas por cambio

1. Todo cambio tiene un registro `CHG-AAAA-MM-NNN` en `docs/03-history/changes/` y una fila en su índice.
2. Todo commit del cambio termina con `Change-Id: CHG-AAAA-MM-NNN`.
3. La integración a `develop` y a `main` usa `git merge --no-ff`, para que exista un commit de merge que revertir. El mensaje del merge incluye el mismo `Change-Id`.
4. El estado y la versión del registro se actualizan al integrar, publicar o revertir.
5. Toda migración declara en el registro cómo compensarla.

Ejemplo de commit:

```text
feat(budget): guardar presupuesto de forma atómica

Change-Id: CHG-2026-11-002
```

Ejemplo de merge. El trailer va en su propio `-m`, para que quede separado del título:

```bash
git merge --no-ff feature/presupuesto-atomico -m "Merge feature/presupuesto-atomico into develop" -m "Change-Id: CHG-2026-11-002"
```

---

## 3. Localizar un cambio o un bug

Ver los commits de un cambio:

```bash
git log --all --grep="Change-Id: CHG-2026-11-001"
```

Ver qué cambió en un archivo, con su historial previo si fue renombrado:

```bash
git log --oneline --follow -- src/proxy.ts
```

Ver qué commit tocó una línea por última vez:

```bash
git blame -L 60,70 src/proxy.ts
```

Ver cuándo apareció o desapareció un texto en el código:

```bash
git log --oneline -S"clearAuthCookie" -- src/proxy.ts
```

Ver qué versiones contienen un commit:

```bash
git tag --contains <commit>
```

Ver qué cambió entre dos versiones:

```bash
git log --oneline --first-parent v1.6.1..v1.7.0
```

Ver qué migraciones entraron entre dos versiones:

```bash
git diff --name-only v1.6.1 v1.7.0 -- supabase/migrations
```

### Encontrar el commit que introdujo un bug

Hacelo con el repo limpio. `git bisect` recorre el historial por mitades hasta encontrar el primer commit con el problema. El orden es: empezar, marcar una versión mala y una buena, probar y terminar.

```bash
git bisect start
```

```bash
git bisect bad HEAD
```

```bash
git bisect good v1.6.1
```

Si existe un test que reproduce el bug, podés automatizarlo:

```bash
git bisect run npx vitest run src/features/transactions/schema.test.ts
```

Si no, probá cada commit a mano y marcá `git bisect good` o `git bisect bad`. Al terminar:

```bash
git bisect reset
```

Durante un bisect no apliques migraciones: el código viaja al pasado, pero la base no. Si el bug depende del esquema, usá `supabase/migrations/` y el registro para acotarlo.

Con el commit identificado, buscá su `Change-Id` y abrí el registro para ver el pedido, los riesgos y el rollback.

---

## 4. Hacer rollback

Antes de actuar, abrí el registro y verificá dos cosas: si el cambio trae migraciones y si cambios posteriores dependen de él. Revertir en la rama no deshace nada en producción hasta que se publica.

### Solo código

Revertí el commit de merge. `-m 1` conserva la rama principal y deshace lo que entró con el merge:

```bash
git revert -m 1 <commit-de-merge>
```

Para un commit normal:

```bash
git revert <commit>
```

Usá `git revert` y no `git reset`: `revert` agrega un commit nuevo y conserva la historia, mientras que `reset` más un force push la reescribe.

Si hace falta volver a integrar ese cambio más adelante, primero hay que revertir el commit del revert. Volver a mergear la rama sin hacerlo no trae el código de vuelta.

### Código y migraciones

Las migraciones aplicadas no se editan ni se borran. Se deshacen con una migración nueva que compensa la anterior.

1. Evaluá si el código nuevo y el esquema viejo pueden convivir, y elegí el orden según cuál deje la app funcionando en cada paso.
2. Como regla general: si la migración agregó algo, revertí primero el código y después compensá la migración. Si la migración quitó algo, publicá primero una compensación que lo restaure.
3. Si la migración borró o transformó datos, una migración compensatoria no los recupera. Hace falta un backup de Supabase, así que confirmá que exista antes de aplicar esa clase de migraciones.
4. Probá la compensación en un entorno que no sea producción. Si no hay ninguno, dejalo explícito antes de aplicarla.

### Después del rollback

1. Marcá el registro como `Revertido`, con fecha, motivo y commit del revert.
2. Actualizá la fila del índice.
3. Publicá como patch: el revert no se versiona ni se publica por fuera del workflow de releases.
4. Agregá un test que habría detectado el problema antes de reintentar.
