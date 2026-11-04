# CHG-2026-11-008 — Controles reales para la fábrica de software

| Campo | Valor |
|---|---|
| Estado | Entregado |
| Fecha | 2026-11-03 |
| Rama | `feature/fabrica-controles` |
| Release | Pendiente |
| Tarea relacionada | Ninguna |
| Clasificación | L, riesgo alto, no financiero |
| Revisores por ciclo | Ciclo 0: tester, seguridad, clean-code, ui. Ciclo 1: tester, seguridad, clean-code. Ciclos 2 a 5: tester, seguridad, clean-code |
| Diagnóstico | Sí, antes de la segunda corrección |
| Informes | `.claude/fabrica/runs/CHG-2026-11-008-fabrica-controles/`, solo en la copia local |

Estados posibles: `Entregado`, `Integrado`, `En producción`, `Revertido`.

## Pedido

> Mejorar la fábrica de software con lo que se puede hacer sin depender del usuario: (1) hooks de seguridad reales que bloqueen acciones peligrosas aunque un agente se equivoque, como aplicar migraciones o tocar producción, leer .env.local y hacer push; (2) clasificación de cada pedido por tamaño y por riesgo, para usar menos revisores en cambios chicos y más controles en cambios financieros o de seguridad; (3) un agente de diagnóstico antes de la segunda corrección; (4) invariantes financieras documentadas; (5) estado persistente y contador de correcciones validados por un script con tests; (6) guardar los informes completos de cada corrida; (7) usar worktrees para no bloquearse con trabajo sin commitear. No crear una plataforma propia, CLI, soporte multi-proveedor ni paralelismo.

Sumado durante la corrida, a pedido del usuario: que el planificador medie cuando hay hallazgos en tensión, y que la fábrica pida menos aprobaciones de comandos.

## Qué cambió

- Un hook `PreToolUse` analiza cada comando y cada acceso a archivos antes de ejecutarlo:
  - Bloquea migraciones contra producción, lectura de `.env*`, `push --force`, `reset --hard`, y borrar o mover `main` y `develop`.
  - Pide confirmación para `push`, merges a `main`, tags, Vercel y la URL de producción.
  - Si el hook falla, bloquea.
- `scripts/fabrica/estado-corrida.mjs` guarda la etapa y los contadores de cada corrida. No permite una tercera corrección, exige diagnóstico antes de la segunda y valida que los informes estén completos.
- Cada pedido se clasifica por tamaño y riesgo, y eso decide qué revisores corren.
- Agente nuevo `fabrica-diagnostico`, que busca la causa raíz antes de la segunda corrección.
- `docs/00-product/financial-invariants.md` documenta las invariantes de dinero, con fuente y estado.
- Cada corrida trabaja en su propio worktree, y los informes se guardan completos.
- **Mediación:** si dos hallazgos se contradicen, o si el implementador discute uno con un argumento técnico, el planificador decide una sola vez. Seguridad y dinero no se negocian: solo puede darle la razón al revisor o pasarle la decisión al usuario.
- `permissions.allow` lista, como texto exacto y sin `*`, los chequeos diarios (lint, tipos, tests, build con placeholders, `npm ci`, `npm audit`) y unas pocas consultas de git sin argumentos libres (`git status`, `git diff`, `git log --oneline -10`…), para que no pidan aprobación. Todo lo demás lo pregunta Claude Code.

## Por qué

Los límites de la fábrica eran instrucciones, y un agente podía saltearlos por error. Ahora los hace cumplir código con tests.

Decisiones:
- La primera versión de la lista de permisos usaba prefijos amplios. Eso convertía cualquier opción que el hook no conocía en un `allow` silencioso. El diagnóstico lo identificó como causa raíz, y la lista se achicó a formas exactas o seguras en lugar de enumerar más casos peligrosos.
- Después, la revisión siguió encontrando expansiones del shell (en medio de una palabra, globs que no van al inicio, sintaxis de zsh) que el hook no veía y que una regla con prefijo aprobaba. El usuario decidió sacar todos los prefijos con `*`: Claude Code vuelve a ser la red, y el hook se queda con sus `deny` y `ask` como defensa adicional.
- `.claude/agents` y `.claude/skills` quedan fuera de las rutas protegidas, porque el implementador los edita.

## Áreas afectadas

- Pantallas o flujos: ninguno de la app. Cambia cómo trabajan los agentes de la fábrica.
- Archivos principales: `scripts/fabrica/*`, `.claude/settings.json`, `.claude/skills/fabrica/SKILL.md`, `.claude/skills/fabrica/references/veredicto.md`, `.claude/agents/fabrica-*.md`, `docs/01-engineering/fabrica-controles.md`, `docs/00-product/financial-invariants.md`, `docs/01-engineering/environments.md`, `AGENTS.md`, `vitest.config.ts`, `eslint.config.mjs`, `.gitignore`.
- Tablas, policies o funciones: ninguna.

## Migraciones

Ninguna.

## Verificación

- Lint, tipos, tests y build: lint y typecheck sin errores; 31 archivos y 1217 tests en verde (234 de base); build con placeholders exitosa.
- Seguridad: aprobado en el ciclo 5, con tres menores abiertos (S5-1 a S5-3, ver "No verificado").
- UI: revisada en el ciclo 0. Después se omitió, porque no cambió ningún `.tsx`.
- Clean code: aprobado en el ciclo 5, con seis menores abiertos (listas de tests duplicadas, nombres de `describe` que remiten a ciclos, tamaño de `politica-herramientas.mjs`).
- Ciclos de corrección usados: 5. Los ciclos 3 a 5 se agregaron por decisión del usuario, después de agotar los 2 previstos.

## No verificado

- **Precedencia del hook sobre `permissions.allow`.** No se probó en vivo. Ninguna regla `allow` cubre algo peligroso que el hook pregunte, pero sí hay un caso inofensivo: Claude Code quita algunas variables antes de comparar, y `GIT_TERMINAL_PROMPT=0 git status` coincide con `Bash(git status)` mientras el hook pregunta. Es una de las pruebas de §5, que siguen pendientes.
- **Límites conocidos del hook** (menores, porque Claude Code pregunta en todos): un `(` precedido de un carácter escapado (`a\ (e:…)`) y `"$=X"`, `"$~X"`, `"$^X"` entre comillas dobles se expanden en zsh y el hook no los ve. Documentados en `fabrica-controles.md` §4.
- Que `onFailure: "block"` bloquee en vivo. Lo respalda `|| exit 2`, que sí tiene test.
- Cómo compara Claude Code las reglas con comandos compuestos o con variables de entorno delante. No se sabe si la regla exacta de la build con placeholders coincide.
- Si Claude Code valida por su cuenta las redirecciones de `cat`, `head` o `tail` hacia fuera del repo.
- CA11 (worktree limpio con `npm ci`) se probó sobre `HEAD`, sin estos cambios.

## Qué vigilar

- Que el hook bloquee comandos legítimos del flujo normal. Ver el motivo en el mensaje y ajustar la política con su test.
- Que vuelvan a aparecer muchas preguntas de aprobación: es esperable para worktrees, `checkout`, `switch`, `merge`, `branch` salvo `--show-current`, `fetch` salvo `git fetch origin`, y `grep`, `find` o `sed` por Bash.
- Que una sesión quede bloqueada por un hook roto: salida en `fabrica-controles.md` §6.

## Rollback

No hay migraciones ni datos. Revertir el merge de la rama:

```bash
git revert -m 1 <commit de merge con Change-Id: CHG-2026-11-008>
```

Si el hook bloquea la sesión y no se puede revertir desde ella, primero desactivarlo según `fabrica-controles.md` §6 (`FABRICA_HOOKS_OFF=1 claude`, o `{"disableAllHooks": true}` en `.claude/settings.local.json` y sesión nueva) y después revertir.

## Commits

```bash
git log --all --grep="Change-Id: CHG-2026-11-008"
```
