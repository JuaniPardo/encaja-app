---
name: fabrica
description: Fábrica de software de Encaja. Lleva un pedido en lenguaje simple por planificación, implementación y revisiones según su clasificación por tamaño y riesgo, con hasta 2 ciclos de corrección, y entrega el código con su registro de trazabilidad, sin publicarlo. Usar cuando el usuario escriba /fabrica o pida pasar algo por la fábrica. No usar para preguntas o arreglos rápidos que no la mencionen.
argument-hint: <qué querés, en lenguaje simple>
---

# Fábrica de software

Pedido del usuario: $ARGUMENTS

Si el pedido está vacío, preguntá qué quiere construir y detenete.

Orquestás esta fábrica desde la sesión principal, porque los subagentes no pueden lanzar otros subagentes. Tu trabajo es coordinar, no producir: no escribas código ni apruebes revisiones vos. Así quien revisa nunca es quien escribió.

Avisá en una línea cada vez que cambie la etapa o el ciclo.

## Estado de la corrida

`scripts/fabrica/estado-corrida.mjs` guarda la etapa y los contadores en `estado.json`, y rechaza lo que esta guía no permite. En adelante, `<estado>` significa:

```bash
node "$CLAUDE_PROJECT_DIR/scripts/fabrica/estado-corrida.mjs"
```

Y `<run>` significa `$CLAUDE_PROJECT_DIR/.claude/fabrica/runs/<CHG>-<slug>`.

`<estado>` y los comandos con argumentos que no están literales en `permissions.allow`, como `git ls-tree …` o `git diff HEAD | shasum`, piden aprobación cada vez: ver `docs/01-engineering/fabrica-controles.md` §3.

Cada cambio de etapa pasa por `<estado> avanzar --dir <run> --a <etapa>`. Salida 1 significa que una regla lo impide: leé el mensaje y no edites `estado.json` a mano. Salida 2 significa que el comando está mal escrito.

**Retomar:** si la sesión se corta, `<estado> ver --dir <run>` indica la etapa, el ciclo, los revisores y qué hacer a continuación.

## Worktree

Cada corrida trabaja en su propio worktree, así que el trabajo sin commitear del checkout principal ya no la detiene. Los informes y el estado quedan siempre en `<run>`, dentro del checkout principal.

Lanzá cada subagente con `cwd` igual al worktree. Si el tool no ofrece `cwd`, pasale la ruta y pedile que cada comando empiece con `cd <worktree> &&`.

## 1. Preparar

1. Verificá que existan `scripts/fabrica/estado-corrida.mjs` y `.claude/settings.json` en el checkout principal. Sin ellos no hay controles: detenete y avisá.
2. Ejecutá `git fetch origin`.
3. Asigná el identificador `CHG-<AAAA-MM>-<NNN>`, con el siguiente número libre para ese mes, leyendo tanto `git ls-tree --name-only origin/develop docs/03-history/changes/` como `.claude/fabrica/runs/`.
4. Creá el worktree desde `origin/develop` e instalá las dependencias. Si es un arreglo, sigue valiendo el prefijo `feature/`, según `docs/01-engineering/dev-workflow.md`.

   ```bash
   git worktree add -b feature/<slug> .claude/worktrees/<CHG>-<slug> origin/develop
   cd .claude/worktrees/<CHG>-<slug> && npm ci --prefer-offline --no-audit --no-fund
   ```

   No copies `.env.local`: el worktree no lo necesita. Tampoco enlaces `node_modules`, porque Turbopack no resuelve enlaces fuera de la raíz. El worktree queda enlazado a producción igual que el checkout principal, por los archivos versionados de `supabase/.temp/`.
5. Ejecutá `<estado> iniciar --dir <run> --chg <CHG> --slug <slug> --rama feature/<slug> --worktree <ruta absoluta>` y guardá `pedido.md` en `<run>`.
6. Desde el worktree, guardá la línea de base en `<run>/linea-base.md`: resultado de `npm run lint`, `npm run typecheck`, `npm test` y `npm audit --omit=dev`. Sirve para no culpar al cambio por problemas que ya existían. Si `node` no está en el `PATH`, anteponé `PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"`.

## 2. Planificar

Lanzá `fabrica-planificador` con el pedido textual y guardá el resultado en `plan.md`.

Si tiene preguntas bloqueantes, hacéselas al usuario y volvé a planificar con sus respuestas. Si no tiene, seguí sin pedir aprobación: el usuario decide al final.

### Clasificar

Tomá la sección `## Clasificación` del plan, comprobala con estas reglas y registrala:

```bash
<estado> clasificar --dir <run> --tamano <S|M|L> --riesgo <bajo|alto> [--ui] [--financiero]
```

**Tamaño.** Los tests y los documentos no cuentan.

- **S:** hasta 3 archivos de producto y sin esquema.
- **M:** hasta 10 archivos.
- **L:** más de 10 archivos o cambios de diseño.

**Riesgo alto automático, por ruta:** `supabase/migrations/**`, `package.json`, `package-lock.json`, `src/proxy.ts`, `src/lib/supabase/**`, `src/features/workspace/permissions*`, `.github/**`, `.claude/settings*.json`, `scripts/fabrica/**`.

**Riesgo alto por contenido:** todo lo que cambie cómo se calcula, guarda, parsea, redondea o interpreta un monto, además de auth, RLS y dependencias. Si solo cambia cómo se muestra una etiqueta, es bajo. Si hay duda, es alto.

**`--financiero`:** se activa si el cambio toca dinero, y hace obligatorio `docs/00-product/financial-invariants.md` para todos los agentes.

**`--ui`:** se activa si cambia algún `.tsx`, `.css` o `dictionaries.ts`. Agrega `fabrica-ui` a los revisores.

| Combinación | Revisores | Re-revisión tras corregir |
|---|---|---|
| S, bajo | tester | tester + quien no aprobó |
| M, bajo | tester, clean-code | tester + quien no aprobó |
| L, bajo | tester, clean-code, seguridad | todos |
| S, M o L, alto | tester, clean-code, seguridad | todos |

La clasificación solo sube, nunca baja. Pasá a `implementar` con `avanzar`.

## 3. Implementar

Lanzá `fabrica-implementador` con el contenido de `plan.md`. Guardá su respuesta en `<run>/ciclo-0/implementacion.md`.

Después compará `git diff --stat` con la clasificación. Si el cambio resultó más grande o más riesgoso, subila con `clasificar` antes de avanzar a `revisar`.

## Informes

Todo informe de un subagente se guarda **completo y textual** en `<run>`, sin resumir ni acortar. Escribilo con la respuesta tal como llegó. `estado-corrida.mjs` rechaza un informe sin `## Hallazgos` o sin `VEREDICTO:` en la última línea, y uno de implementación sin `## Cambios`.

## 4. Revisar

Entrá a esta etapa con `<estado> avanzar --dir <run> --a revisar`, tanto después de implementar como después de cada corrección: el script carga ahí `revisoresDelCiclo` y rechaza el paso si falta `implementacion.md` del ciclo.

Corré los agentes de `revisoresDelCiclo`, que indica `<estado> ver --dir <run>`. No uses una lista fija. Lanzalos en paralelo, en el mismo mensaje: conviene ver todos los problemas de una vez, porque los ciclos son pocos.

- Pasale a cada uno el plan, la línea de base y la lista de cambios de `git status --short`.
- En un ciclo de corrección, agregá los hallazgos anteriores para que confirmen si se resolvieron.
- Si hubo mediación, agregá el `mediacion.md` de la carpeta del ciclo que revisan, la misma de `implementacion.md`. Los revisores controlan que se haya cumplido y siguen `references/veredicto.md`.
- Si `fabrica-ui` no está en la lista, dejá registrado que se omitió.

Los revisores no deben cambiar nada. Antes y después de lanzarlos, tomá la huella del worktree con `git status --short` y `git diff HEAD | shasum`. Si cambió, pasá a `ayuda`.

Guardá cada informe en `<run>/ciclo-<n>/<agente>.md`. Leé la última línea de cada uno:

- **Todos `APROBADO`:** pasá a la etapa 6.
- **Alguno `BLOQUEADO`:** pasá a la etapa 7 de inmediato, porque otro ciclo no resuelve una decisión del usuario.
- **Alguno `CAMBIOS`:** pasá a la etapa 5, que fija el orden, incluida la mediación si dos hallazgos se contradicen.
- **Un informe sin veredicto claro:** pedile a ese agente que lo complete una vez. Si sigue sin claridad, contá ese informe como `BLOQUEADO`.

Un `APROBADO` no se reinterpreta: si creés que un revisor se equivocó, decilo en la entrega. Los hallazgos menores no abren un ciclo; van a la entrega.

## 5. Corregir

El máximo es de **2 ciclos de corrección**. La primera revisión no cuenta: un pedido tiene como máximo 3 revisiones y 2 correcciones. El límite evita gastar tiempo y tokens en un problema que necesita criterio humano. El script lo hace cumplir.

Si ya hubo 2 correcciones, pasá a la etapa 7. Si no, seguí este orden:

1. **Diagnosticar, solo antes de la segunda corrección.** Avanzá a `diagnosticar`, guardá `git diff HEAD` en `<run>/ciclo-<n>/cambio.diff` y lanzá `fabrica-diagnostico` con los hallazgos, los ciclos anteriores, el plan y ese diff. Guardá su informe en `<run>/ciclo-<n>/fabrica-diagnostico.md`. Con `VEREDICTO: BLOQUEADO`, pasá a la etapa 7. El diagnóstico y `cambio.diff` quedan en el ciclo revisado.
2. **Entrar a `corregir`** con `avanzar --a corregir`. El script suma 1 al ciclo: desde acá, `<n>` es el ciclo de la corrección, el que muestra `ver`.
3. **Mediar, si dos hallazgos se contradicen.** Lanzás a `fabrica-planificador` para mediar, antes de lanzar al implementador (ver "Mediación").
4. **Lanzar `fabrica-implementador`** con todos los hallazgos bloqueantes y mayores, las causas raíz del diagnóstico si lo hubo y la decisión de la mediación si la hubo. Guardá su respuesta en `<run>/ciclo-<n>/implementacion.md`.
5. **Si vuelve con un `DISCUTIDO`** con argumento técnico verificable, lanzás al planificador para mediar y, según la decisión, otra vez al implementador, en el mismo ciclo. Su nueva respuesta reemplaza `implementacion.md`.

Después volvé a la etapa 4 con `avanzar`. Si el implementador reporta un bloqueo, pasá a la etapa 7.

### Mediación

Esta es la única definición de las reglas de mediación: el planificador y `references/veredicto.md` remiten acá. No arbitrás vos: cuando hay hallazgos en tensión, lanzás a `fabrica-planificador` para mediar. Media solo en dos casos:

- **Dos hallazgos se contradicen:** cumplir uno obliga a incumplir el otro.
- **El implementador discute un hallazgo** con un argumento técnico verificable. Un "no estoy de acuerdo" sin evidencia no alcanza: se corrige o va a la etapa 7.

Pasale los hallazgos en tensión con sus informes, el argumento del implementador si lo hay, el plan, `git diff HEAD` y `docs/00-product/financial-invariants.md`. Guardá su respuesta completa en `<run>/ciclo-<n>/mediacion.md`, en la carpeta del ciclo de la corrección (paso 2): es el mismo ciclo que revisan después.

Reglas:

1. **Seguridad y dinero no se negocian, según el tipo de hallazgo.** Frente a un hallazgo de seguridad bloqueante o mayor, o a uno que toque una invariante de `docs/00-product/financial-invariants.md`, la mediación solo puede darle la razón al revisor o cerrar con `MEDIACIÓN: AL USUARIO`. Nunca lo descarta, ni siquiera concluyendo que el riesgo no existe o que otra parte del código ya lo cubre: esa conclusión la toma el usuario, en la etapa 7.
2. **Lo que no le toca va al usuario:** alcance, producto, riesgos aceptados y cualquier cosa difícil de revertir. Tampoco media si el conflicto es sobre su propio plan.
3. **Una vez por conflicto.** Si el mismo conflicto vuelve, porque el implementador discute la decisión o un revisor la reabre, pasá a la etapa 7.
4. **No gasta un ciclo.** No hay etapa nueva en `estado-corrida.mjs`: la mediación ocurre dentro de `corregir`. Tampoco habilita correcciones por encima del tope.
5. **Si no puede decidir,** porque le falta un dato o un criterio, cierra con `MEDIACIÓN: AL USUARIO` y pasás a la etapa 7.

Con `MEDIACIÓN: DECIDIDA`, la decisión se cumple. El implementador la recibe junto con los hallazgos, y los revisores del ciclo siguiente controlan que se haya cumplido. Si un `mediacion.md` descartó un hallazgo de los de la regla 1, no vale: el revisor lo vuelve a levantar como bloqueante y cierra con `VEREDICTO: BLOQUEADO`.

## 6. Entregar

Creá `docs/03-history/changes/<CHG>-<slug>.md` desde `_TEMPLATE.md`, con estado `Entregado`, y agregá su fila al índice de `README.md`. Es la excepción a no producir archivos: resume informes que ya existen. El pedido va textual, y `No verificado` y `Rollback` no pueden quedar vacíos, porque son lo primero que se va a leer cuando algo falle.

Ejecutá `avanzar --a entregar`. Dejá el código sin commitear en la rama de trabajo, dentro del worktree, y detenete. No hagas commit, push, merge, release ni apliques migraciones: pasar a producción se decide después de esta entrega. El worktree se conserva hasta `cerrado`.

Mostrá este resumen:

```markdown
# Entrega: <CHG> — <título>

**Rama:** feature/<slug>, sin commitear
**Worktree:** <ruta absoluta>
**Registro:** docs/03-history/changes/<CHG>-<slug>.md
**Clasificación:** <tamaño>, riesgo <bajo|alto><, financiero>
**Ciclos de corrección usados:** <0, 1 o 2> de 2
**Diagnóstico:** <sí o no>
**Informes:** <ruta de run>
**Mediaciones:** <cantidad, o "ninguna">

## Qué se hizo
<en lenguaje simple, para alguien que no leyó el código>

## Criterios de aceptación
- CA1: <resultado y evidencia>

## Revisiones
- Tests: <lint, tipos, tests y build>
- Seguridad: <resultado, u omitida y por qué>
- UI: <resultado, u omitida y por qué>
- Clean code: <resultado, u omitida y por qué>

## Archivos
<lista>

## Migraciones
<archivos pendientes de aplicar, o "ninguna">

## No verificado
<RLS, migraciones y pantallas no ejecutadas. Decirlo claro: no fue probado>

## Mediaciones
<por cada una: ciclo, conflicto, qué se decidió, qué alternativa quedó descartada y cómo volver a ella, con la ruta de `mediacion.md`. O "ninguna">

## Hallazgos menores sin resolver
<lista, o "ninguno">
```

Preguntá si pasa a producción. Si responde que no o pide ajustes, un pedido nuevo vuelve a empezar con su propio límite de 2 ciclos.

## 7. Pedir ayuda

Ejecutá `avanzar --a ayuda`. Detenete y dejá el trabajo en el worktree, sin descartar nada. Explicale al usuario:

- qué se logró y qué sigue fallando;
- qué se intentó en cada ciclo;
- qué decisión o dato necesitás, en una pregunta concreta y con tu recomendación.

Con su respuesta, seguí desde la etapa que corresponda con `avanzar --a <etapa> --respuesta-usuario "<texto>"`. El hook pregunta antes de ejecutarlo, porque reinicia el tope: lo confirma una persona. Salir hacia `implementar`, `revisar` o `corregir` abre un ciclo nuevo, así que los informes anteriores no valen para el código nuevo; salir hacia `entregar` exige las aprobaciones del ciclo vigente. Una respuesta suya habilita hasta 2 ciclos nuevos para ese problema: el contador de correcciones se reinicia y el de ciclos no.

## 8. Después de la aprobación

Solo con un sí explícito del usuario, seguí `docs/01-engineering/dev-workflow.md`: commit en `feature/<slug>`, merge a `develop` y validación. El release a `main` es un paso aparte: incluye `CHANGELOG.md`, versión y tag.

Aplicá `docs/01-engineering/traceability.md`: `Change-Id` en cada commit, `git merge --no-ff` y registro actualizado con su nuevo estado y versión. Sin eso, el cambio deja de poder rastrearse o revertirse como unidad.

Integrá desde un worktree separado, para no tocar el checkout principal:

```bash
git fetch origin
git worktree add --detach .claude/worktrees/<CHG>-integracion origin/develop
cd .claude/worktrees/<CHG>-integracion
git merge --no-ff feature/<slug> -m "Merge feature/<slug> into develop" -m "Change-Id: <CHG>"
git push origin HEAD:develop
```

Para un release, repetí los mismos pasos con `origin/main`.

Escribí el mensaje con `-m` repetidos: `git merge` no acepta leerlo de stdin, y la opción `-F -` falla.

Pedí confirmación separada para cada acción difícil de revertir: push, merge a `main` y tag. Un sí a una de ellas no cubre las demás. La pregunta `ask` de un hook y la confirmación explícita del usuario son cosas separadas: primero pedí la confirmación por escrito y después ejecutá el comando, aunque el hook vuelva a preguntar.

Las migraciones a la base de producción no las ejecutás vos: el hook las niega. Dale al usuario el comando para que lo corra en su terminal y esperá su confirmación.

Al cerrar, ejecutá `avanzar --a cerrado` y limpiá los worktrees de la corrida, sin `--force`:

```bash
git worktree remove .claude/worktrees/<CHG>-<slug>
git worktree remove .claude/worktrees/<CHG>-integracion
git worktree prune
```

Si `git worktree remove` se niega, hay trabajo sin guardar: avisá al usuario en vez de forzarlo.
