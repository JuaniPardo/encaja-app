# Controles de la fábrica

## Objetivo

Convertir los límites de la fábrica en controles que se ejecutan, para que un error de un agente no llegue a producción. Una instrucción se puede olvidar; un hook no.

Estos controles reducen errores: no contienen a un agente que intente evadirlos a propósito. La protección real de producción sigue siendo que las credenciales no estén al alcance de las sesiones.

---

## 1. Piezas

| Pieza | Ubicación | Qué hace |
|---|---|---|
| Analizador de shell | `scripts/fabrica/comando-shell.mjs` | Convierte el texto de un comando en segmentos. No ejecuta nada. |
| Política | `scripts/fabrica/politica-herramientas.mjs` | Decide `deny`, `ask` o `allow`. Función pura. |
| Adaptador | `scripts/fabrica/hook-pre-tool-use.mjs` | Conecta la política con Claude Code. |
| Configuración | `.claude/settings.json` | Activa el hook, agrega `permissions.deny` como segunda capa y `permissions.allow` para lo rutinario (§3). |
| Estado de corrida | `scripts/fabrica/estado-corrida.mjs` | Valida etapas, contador, informes y revisores. |

Nada de esto llega a la app: `src/` no importa `scripts/fabrica`.

La mediación del planificador ante hallazgos en tensión es una regla de la skill, no un control ejecutable: `estado-corrida.mjs` no tiene una etapa para ella. Ver `.claude/skills/fabrica/SKILL.md`, etapa 5.

---

## 2. Qué decide la política

Gana `deny`, luego `ask`, luego `allow`. Un comando puede tener varios segmentos, y se evalúa cada uno.

El hook recibe `Bash`, `Monitor` y `PowerShell`, que se evalúan como comandos, y `Read`, `Edit`, `Write`, `MultiEdit`, `NotebookEdit` y `Grep`, que se evalúan por ruta. Una herramienta que la política no conoce y recibe `command` da `ask` (`herramienta-desconocida`).

### Niega

| Regla | Qué cubre |
|---|---|
| `supabase-escritura` | `supabase` es una lista cerrada: todo lo no listado se niega, salvo con `--db-url` literal hacia localhost o sin el ref de producción |
| `supabase-db-url-variable` | `--db-url "$VAR"`: no se puede verificar. Usar `scripts/supabase-dev-migrate.sh` |
| `env-local` | Leer o escribir `.env*` con herramienta o por Bash, salvo `.env.example` |
| `git-push-forzado` | `--force`, `-f` y flags combinadas, `--force-with-lease`, `--mirror`, `--prune`, refspec `+x` |
| `git-descarta-trabajo` | Descartar trabajo en bloque: `reset --hard`, `checkout -- .`, `checkout -f`, `restore .`, `clean -f` (sin `-n`), `switch -f` o `--discard-changes`, `stash drop`, `stash clear`, `worktree remove --force`. La ruta se normaliza antes: `./.`, `src/..` y la ruta absoluta del repo o de una carpeta que lo contiene cuentan como `.` |
| `git-rama-protegida` | Borrar, renombrar, copiar o mover `main` o `develop`, local o remotamente: `branch -d/-D/-m/-M/-c/-C/-f`, `push --delete`, `push origin :main`, `checkout -B`, `switch -C`/`--force-create`, `worktree add -B` y un refspec de `fetch` o `pull` (también `--refmap` y globs) cuyo destino sea `main` o `develop` |
| `npm-ci-dry-run` | `npm ci --dry-run`, sus alias (`clean-install`, `ic`, `cit`, `clean-install-test`…) y `npm_config_dry_run` en el entorno |
| `next-build-sin-placeholders` | `next build` y `npm run build` sin los placeholders en la misma línea |

Pasan en Supabase, sin preguntar: `--help`, `--version` y `migration new`.

### Pregunta

| Regla | Qué cubre |
|---|---|
| `supabase-consulta` | `migration list`, `gen`, `status`, `inspect`, `db lint`, `projects list` |
| `git-push` | Cualquier otro `git push` |
| `git-merge-main`, `git-merge-destino-desconocido` | Merge con destino `main`, o sin poder saber el destino |
| `git-commit-rama-protegida` | `git commit`, también `--amend`, cuando la rama de la carpeta del comando es `main` o `develop`. Usa la misma rama que el merge; en HEAD separado o si git falla, pasa |
| `git-tag` | Crear o borrar tags. `git tag --list` y `--contains` pasan |
| `git-rama-dinamica` | Cambiar una rama cuyo nombre se arma al ejecutar o llega por `xargs` |
| `configuracion-en-linea` | Cualquier `git -c`, `--config-env` o `--exec-path=`, una opción global de git en variable, y las variables `GIT_*`, `PAGER`, `EDITOR` y `VISUAL` en el entorno del segmento o declaradas con `export`, `declare` o `typeset`. No se enumeran claves: todas pueden cambiar qué comando corre |
| `git-escribe-archivo` | Una opción de git que empieza con `--out` (`--output`, `--output-directory`) en cualquier subcomando. El texto de un `-m` solo se excluye en los subcomandos que reciben mensaje: `commit`, `merge`, `tag`, `notes` y `stash push`/`save` (o `stash -m`). En `stash list` y `stash show`, `-m` es una opción de diff |
| `vercel`, `gh-accion` | Publicación: `vercel`, `gh pr merge`, `gh release create/delete`, `gh repo delete` y `gh api` con un método distinto de `GET` o con campos |
| `ref-produccion`, `url-produccion`, `url-develop`, `host-supabase` | Cualquier comando que mencione esas URLs o el ref. Si no se conoce el ref, cualquier host de Supabase, salvo `placeholder.supabase.co` |
| `next-sin-placeholders` | `next dev`, `next start`, `npm run dev`, `npm start` sin placeholders |
| `comando-dinamico` | Palabra de comando armada al ejecutar (variables, `$(...)`, llaves, `=cmd`), o un shell, `source`, `.` o intérprete que recibe el script de un pipe, de stdin, de `<(...)` o de `/dev/*` |
| `argumento-incierto` | Cualquier comando con un argumento, o una palabra de un envoltorio, que el shell puede convertir en otra palabra: llaves sin comillas que expanden (`{a,b}`, `{1..3}`; `HEAD@{1}` no), `$X`, `${X}`, `$(...)`, backticks o `<(...)` fuera de comillas dobles, o un primer carácter que sale de una expansión (`"$X…"`, `"$(…)"`) o de un glob (`*…`, `?…`, `[…`). Las demás reglas leen el texto antes de que el shell lo expanda, y el programa recibe otro. Única excepción: `$CLAUDE_PROJECT_DIR/` o `${CLAUDE_PROJECT_DIR}/` al inicio, sin otra expansión, si el comando no asigna, exporta ni declara esa variable ni nombra `IFS`. No miran: los valores de asignaciones (`PATH="…:$PATH"`), los destinos de redirección (los cubre `autoproteccion`) y los cuerpos de heredoc y here-string |
| `comando-no-analizable` | Texto que el analizador no entiende, incluidas las comillas `$'...'`, backticks dentro de `${...}`, heredocs sin comillas con sustituciones, un `(` pegado a una palabra (en zsh, `x(e:'…':)` es un calificador de glob que ejecuta código) y un `$` sin comillas seguido de un carácter que no sea nombre ni fin de palabra (`$=X`, `$~X`, `$^X` de zsh). No detecta las variantes de §4 (carácter escapado antes del `(`, y `$=X` entre comillas dobles). Nunca da `allow` |
| `autoproteccion` | Modificar, mover, borrar o cambiar permisos de `.claude/`, `.claude/settings*.json`, `.claude/fabrica/`, `scripts/`, `scripts/fabrica/`, cualquier `estado.json`, cualquier ruta dentro de `.git/`, o la config global de git (`~/.gitconfig`, `~/.config/git/` y `$XDG_CONFIG_HOME/git/`, con el home expandido y `~` resuelto): con herramienta, redirección, `rm`, `mv`, `cp`, `chmod`, `sed -i`, `perl -i`, `git rm/mv/checkout/restore`, una opción de salida (`-o`, `--out*`, también con `=`) de cualquier programa, globs y llaves que los alcancen, o código de intérprete que los nombre. `.git/` y la config global entran porque su `config` y sus `hooks/` deciden qué ejecuta git |
| `chequeo-con-opciones` | `npm test`, `npm run test`, `npm run lint`, `npm run typecheck`, `vitest` y `eslint` con cualquier opción escrita, antes o después de `--`: solo pasan con argumentos posicionales literales. Una opción que llega armada (`{--config=x,…}`, `"$X"`, `$(...)`) la frena `argumento-incierto`. Las opciones de npm (`--node-options`, `--script-shell`, `--prefix`, `--userconfig`) y las del programa (`--poolOptions.forks.execArgv` y `--config` de vitest; `-c`, `-f`, `--rulesdir` y `--cache-location` de eslint) ejecutan código o escriben donde digan, y no se enumeran |
| `estado-confirmacion` | `estado-corrida.mjs` con `--respuesta-usuario` o `--reabrir`: reinician el tope y los confirma una persona |
| `herramienta-desconocida` | Una herramienta con `command` que la política no evalúa |
| `entrada-invalida` | Una ruta de herramienta que no es texto |

### Dónde mira

Las detecciones atraviesan `&&`, `;`, `|`, `$(...)`, backticks, `<(...)`, `bash|sh|zsh|dash|ksh -c`, heredocs y here-strings que alimentan a un shell, `eval`, `env`, `sudo`, `command`, `exec`, `time`, `nohup`, `nice`, `timeout`, `xargs`, `npx`, `bunx`, `pnpx`, `npm|pnpm|yarn|bun exec/x/dlx`, `yarn <binario>`, `pnpm <binario>`, comillas, rutas absolutas, `git -C`, `git -c` y `--config-env`, hasta 3 niveles de anidación. El cuerpo de un heredoc que alimenta a `python`, `node` u otro intérprete se revisa como texto (archivos `.env*`, ref, controles); el que alimenta a `cat` o `git commit -F -` no.

### Placeholders de la build

Con estas variables en línea, Next no toma las de `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=placeholder NEXT_TELEMETRY_DISABLED=1 npm run build
```

---

## 3. Lo que pasa sin preguntar

`permissions.allow` en `.claude/settings.json` evita que Claude Code pida aprobación para lo rutinario. Sin esa lista, el hook daba `allow` pero Claude Code preguntaba igual, porque no había regla.

La política del hook no es completa (§4): cuando no conoce una forma, da `allow`. Lo que queda afuera de `permissions.allow` lo pregunta Claude Code, y esa es la red por defecto para lo que la política no conoce. El hook se queda con sus `deny` y sus `ask` como defensa adicional, pero ninguna regla de `allow` depende de él.

**Criterio.** Toda regla es `Bash(...)` con el texto exacto del comando, sin `*`, sin `:*` y sin otro comodín. Sin `*`, Claude Code solo aprueba ese texto idéntico, así que nada que el shell pueda expandir entra sin preguntar. `scripts/fabrica/permisos.test.ts` lo hace cumplir: falla si una regla tiene un comodín, si la lista difiere de la de abajo o si el hook no deja pasar alguna de estas formas.

| Grupo | Reglas exactas | Por qué esa forma y no otra |
|---|---|---|
| Chequeos | `npm run lint`, `npm run typecheck`, `npm test`, `npm run test`, `npx tsc --noEmit`, la build con los placeholders de §2, `npm ci`, `npm ci --prefer-offline --no-audit --no-fund`, `npm audit --omit=dev` | npm acepta antes del script opciones propias que ejecutan código (`--node-options`, `--script-shell`, `--prefix`, `--userconfig`); vitest y eslint tienen opciones que ejecutan código o escriben donde digan; `tsc` emite archivos sin `--noEmit`, y `npm audit fix` cambia dependencias: solo entra la forma que se usa |
| Git | `git fetch origin`, `git branch --show-current`, `git rev-parse --show-toplevel`, `git status`, `git status --short`, `git diff`, `git diff --stat`, `git diff HEAD`, `git log --oneline -10`, `git stash list` | Solo leen. `fetch` acepta `--upload-pack`, que ejecuta un comando, y refspecs que mueven ramas; `branch` crea, borra y mueve; `diff`, `log` y `stash list` aceptan `--output` |

Todo lo demás pregunta: los chequeos con argumentos (`npm test -- <ruta>`, `npx vitest …`, `npx eslint …`), `git log`, `git diff` y `git status` con otros argumentos, `git show`, `git rev-parse` con otros argumentos, `git ls-tree`, `git ls-files`, `git add`, `git commit`, `node scripts/fabrica/estado-corrida.mjs …` y `hook-pre-tool-use.mjs …`, `ls`, `cat`, `head`, `tail`, `wc`, `diff`, `git checkout`, `git switch`, `git worktree`, `git merge`, `grep`, `find` y `sed`. Para leer, el tool Read, Grep y Glob no pasan por estas reglas.

Según el binario 2.1.309, Claude Code aprueba algunas lecturas sin regla (`ls`, `cat`, `git status`) con su propio validador, que tiene una lista cerrada de opciones por subcomando. No se verificó en vivo, así que algunas de estas formas podrían no preguntar.

**Por qué no hay prefijos con `*`.** Una regla `Bash(git log *)` compara el texto antes de que el shell lo expanda, y el hook también. El programa recibe otro texto, y el hook no puede reproducir la expansión del shell en todas sus formas. Dos ejemplos que el hook dejaba pasar y una regla con prefijo aprobaba:

- Una sustitución en medio de una palabra entre comillas: `git log -1 --format='…' "--$(git log -1 --format=tformat:output)=$HOME/.gitconfig"`. El hook ve una opción que empieza con `--$(`; git recibe `--output=…` y escribe la config global.
- Un glob que no va al inicio: con un archivo llamado `--output=.claude/settings.json` ya creado, `git log -1 --format='…' --*/*` se expande a esa opción y escribe los controles.

Cada parche del hook encontraba la forma siguiente (zsh suma calificadores de glob y `$=X`). Con formas exactas, el agujero deja de importar: un comando con argumentos libres nunca se aprueba sin preguntar.

Un comando con variables delante, como `PATH="..." npm test`, no coincide con la regla exacta, y entonces Claude Code pregunta. Excepción: según el binario 2.1.309, Claude Code quita antes de comparar una lista cerrada de variables que considera seguras (`NODE_ENV`, `LANG`, `LC_*`, `TZ`, `CI`, `TERM`, `FORCE_COLOR`, `GIT_TERMINAL_PROMPT` y otras). Con ellas delante, el comando sí coincide. Ninguna cambia qué ejecutan estas formas. De las que el hook pregunta (`configuracion-en-linea`), la única en esa lista es `GIT_TERMINAL_PROMPT`, que es inofensiva. `permisos.test.ts` no modela ese recorte.

## 4. Qué no cubre

- Scripts escritos y ejecutados después. El hook evalúa el comando, no el contenido del archivo.
- `python -c` o `node -e` que lancen subprocesos.
- Alias de git ya configurados y ejecutores que no estén listados arriba.
- Escrituras indirectas sobre los controles: `git apply`, `patch`, `tar` o `unzip`, `git stash pop` y código de intérprete que arme la ruta en vez de nombrarla.
- Los scripts internos de `npm run`.
- Lecturas recursivas que vuelcan `.env.local` u otros archivos ignorados de paso, sin nombrarlos. La política solo lo detecta si el comando lo nombra.
  - `grep -r`: como `grep` no tiene regla `allow`, Claude Code pregunta.
  - `diff -r` (o `-R`, `--recursive`) contra una carpeta vacía, como `diff -rN /var/empty .`, y `git diff --no-index /var/empty .`: el hook los deja pasar, y Claude Code pregunta porque no son formas exactas de §3.
  - El tool Grep sobre una carpeta: se evalúa la ruta y el `glob` que recibe, no cada archivo que recorre.
- Opciones de los chequeos que escriben en rutas arbitrarias, incluidos los controles: `--generateCpuProfile`, `--generateTrace` y `--tsBuildInfoFile` de `tsc`, `--cache-location` y `--fix` de eslint, `--outputFile` de vitest. Con las reglas de §3 preguntan: los chequeos solo están en `allow` sin argumentos, y con opciones el hook da `chequeo-con-opciones`. Fuera de esos chequeos la política no las mira: solo `-o` y `--out*` hacia los controles dan `autoproteccion`, y el resto lo pregunta Claude Code porque ninguna regla lo cubre.
- Texto codificado dentro de un intérprete, como `python3 -c "open(chr(46)+'env.local')"`. Las comillas `$'...'` del shell sí dan `ask`.
- Comandos de git de bajo nivel como `git update-ref -d`, y `git push .` hacia una rama local, que pregunta como cualquier push.
- Un repo con una config que ejecuta comandos, creado antes y usado con `git -C` o `--git-dir`.
- `find -exec`, `find -delete` y los comandos `w` y `e` de `sed`. La política no los analiza: preguntan porque `find` y `sed` no tienen regla `allow`.
- Las opciones globales de `yarn`, `pnpm` y `bun` (`-C`, `--dir`, `--cwd`, `--filter`, `-F`, `yarn workspace <x>`, `bun run`). Pierden el `deny` de lo que envuelven, por ejemplo `pnpm -C . supabase db push`, pero preguntan porque no tienen regla.
- Si el tool Grep entra en archivos ocultos o ignorados por git, por ejemplo con `glob: "*.local"`. La política solo evalúa la ruta y el `glob`.
- Symlinks creados antes, servidores MCP y la terminal del usuario.
- En HEAD separado la rama es vacía, así que no se detecta "merge a main". El control real es `git push`.
- Expansiones en medio de una palabra, también entre comillas dobles (`"--o$(…)put=x"`, `".e${X}.local"`), y globs que no van al inicio (`--*/*`, `''*`, `git log \-*`). `argumento-incierto` solo mira el primer carácter, y las reglas que leen un prefijo más largo (`--out`, `--respuesta-usuario`, `--reabrir`, `.env`) ven el texto sin expandir. Es aceptable porque ningún comando con argumentos libres se aprueba sin preguntar (§3): estos comandos los pregunta Claude Code. Lo que se pierde es el `deny` del hook, por ejemplo el de `env-local` ante `cat ".e$(echo nv).local"`, que pasa a ser una pregunta.
- Dos sintaxis de zsh que `comando-no-analizable` no ve, por la misma razón:
  - Un `(` precedido de un carácter escapado, como `ls a\ (e:'…':)` o `ls a\;(e:'…':)`: el escape deja ese carácter dentro de la palabra, y zsh lee el `(` como calificador de glob que ejecuta código.
  - `"$=X"`, `"$~X"`, `"$^X"` y `"$+X"` entre comillas dobles: zsh las expande igual que sin comillas, y el hook ve un `$` literal.
  
  Ninguna es forma exacta de §3, así que Claude Code pregunta. Lo que se pierde es el `deny` o el `ask` del hook sobre lo que esconden.

### Falsos positivos conocidos

`grep ".env.local" docs` da `deny`, porque el analizador no distingue un nombre de archivo de un texto. El motivo sugiere usar el tool Grep, que solo evalúa la ruta.

`argumento-incierto` pregunta también cuando la expansión es inofensiva: `git commit -m "$(cat <<'EOF' …)"`, `git diff $(git merge-base …)`, `cat $(git ls-files …)`, `npm test -- {a,b}.test.ts`, `ls {src,docs}` y `ls *`. En un subagente conviene escribir los argumentos tal cual o usar Glob y Read. El hook deja pasar `src/*.ts`, `HEAD@{1}`, `PATH="…:$PATH" npm test` y `"$CLAUDE_PROJECT_DIR/…"`, aunque Claude Code los pregunta por no ser formas exactas de §3.

### `ask` en subagentes

`ask` dentro de un subagente, o en modo no interactivo, puede resolverse como rechazo. Lo mismo vale para la pregunta de Claude Code ante un comando que no está en `allow`: un subagente debería usar las formas exactas de §3 y Read, Grep y Glob para leer. Editar `scripts/fabrica/` también da `ask`, incluso dentro de un worktree: un cambio a estos controles puede necesitar que el usuario lo apruebe.

---

## 5. Probar

Los tests solo pasan texto a la política: ninguno ejecuta un comando peligroso.

```bash
npx vitest run scripts/fabrica
```

Para probar el adaptador sin activarlo, pasale el JSON por stdin:

```bash
printf '%s' '{"tool_name":"Bash","tool_input":{"command":"git status"}}' | node scripts/fabrica/hook-pre-tool-use.mjs
```

Sin salida significa `allow`.

Pruebas reales, en una sesión nueva. Ninguna tiene efecto, porque el archivo y la rama no existen o se rechaza la pregunta:

| Prueba | Esperado |
|---|---|
| `cat .env.fabrica-sonda` y Read de ese nombre | `deny` |
| `git push --force --dry-run origin refs/heads/sonda-inexistente` | `deny` |
| `git push --dry-run origin HEAD:refs/heads/sonda-inexistente` | `ask`: rechazar |
| `GIT_TERMINAL_PROMPT=0 git status` | `ask`: rechazar |

La última prueba comprueba que un `ask` del hook gana sobre una regla `allow`. Claude Code quita `GIT_TERMINAL_PROMPT` antes de comparar (§3), así que el comando coincide con `Bash(git status)`, y el hook lo pregunta por `configuracion-en-linea`. Si se ejecuta sin preguntar, gana la regla. El impacto sería nulo, porque esa variable es inofensiva, pero confirma el orden. Las formas exactas de §3 sin variables delante el hook las deja pasar, y `permisos.test.ts` lo exige. Fuera de ellas, el hook y Claude Code preguntan o niegan, y el orden no cambia el resultado. También queda sin probar una lectura que Claude Code aprueba por su cuenta (§3) y el hook pregunta, aunque ninguna regla de este repo depende de eso.

Si alguna vez se agrega a `allow` una regla que cubra algo que el hook pregunta o niega con consecuencias, la precedencia pasa a ser un control de seguridad: hay que probarla antes, y los tests de `permisos.test.ts` fallan hasta revisar la regla.

**No usar nunca como sonda `npm ci --dry-run` ni un `supabase db push` real.**

---

## 6. Desactivar

Un hook que falla bloquea todo, incluido arreglarlo. El hook sale con código 2 ante JSON inválido o una excepción, y `settings.json` usa `onFailure: "block"`. El comando termina en `|| exit 2`: si falta `node` (127) o el propio `hook-pre-tool-use.mjs` (1), también sale con 2 y bloquea. El adaptador solo sale con 0 o con 2, así que eso no cambia ninguna otra decisión.

Estas salidas son para el usuario, desde su propia terminal, y en este orden:

1. Sesión con los hooks apagados: `FABRICA_HOOKS_OFF=1 claude`. La variable tiene que estar en el entorno del hook: escribirla delante de un comando en una sesión no cambia nada.
2. Si no alcanza, crear `.claude/settings.local.json` con `{"disableAllHooks": true}` y abrir una sesión nueva.
3. Si tampoco alcanza, revertir `.claude/settings.json`.

No cambiar a una rama sin `scripts/fabrica/` en el checkout principal: el hook no encontraría el archivo y bloquearía todo. Por eso se integra desde un worktree separado, según `dev-workflow.md`. Si esa rama tampoco tiene `.claude/settings.json`, como `v1.8.0`, el checkout borra el hook entero y ya no hay nada que bloquee. Por eso `git checkout` y `git switch` no están en `permissions.allow`: Claude Code pregunta antes.
