---
name: fabrica
description: Fábrica de software de Encaja. Lleva un pedido en lenguaje simple por planificación, implementación y revisiones de tests, seguridad, UI y clean code, con hasta 2 ciclos de corrección, y entrega el código con su registro de trazabilidad, sin publicarlo. Usar cuando el usuario escriba /fabrica o pida pasar algo por la fábrica. No usar para preguntas o arreglos rápidos que no la mencionen.
argument-hint: <qué querés, en lenguaje simple>
---

# Fábrica de software

Pedido del usuario: $ARGUMENTS

Si el pedido está vacío, preguntá qué quiere construir y detenete.

Orquestás esta fábrica desde la sesión principal, porque los subagentes no pueden lanzar otros subagentes. Tu trabajo es coordinar, no producir: no escribas código ni apruebes revisiones vos. Así quien revisa nunca es quien escribió.

Avisá en una línea cada vez que cambie la etapa o el ciclo.

## 1. Preparar

1. Si `git status --short` muestra cambios, detenete y preguntá qué hacer con ellos: la fábrica no debe mezclarse con trabajo sin commitear.
2. Ejecutá `git fetch origin`, cambiá a `develop` y actualizalo solo con fast-forward. Creá `feature/<slug>`. Si es un arreglo, sigue valiendo el prefijo `feature/`, según `docs/01-engineering/dev-workflow.md`.
3. Asigná el identificador `CHG-<AAAA-MM>-<NNN>`, con el siguiente número libre de `docs/03-history/changes/` para ese mes.
4. Creá `.claude/fabrica/runs/<CHG>-<slug>/` y guardá ahí `pedido.md`.
5. Guardá la línea de base en `linea-base.md`: resultado de `npm run lint`, `npx tsc --noEmit -p .`, `npm test` y `npm audit --omit=dev`. Sirve para no culpar al cambio por problemas que ya existían. Si `node` no está en el `PATH`, anteponé `PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"`.

## 2. Planificar

Lanzá `fabrica-planificador` con el pedido textual y guardá el resultado en `plan.md`.

Si tiene preguntas bloqueantes, hacéselas al usuario y volvé a planificar con sus respuestas. Si no tiene, seguí sin pedir aprobación: el usuario decide al final.

## 3. Implementar

Lanzá `fabrica-implementador` con el contenido de `plan.md`. Guardá su respuesta en `ciclo-0/implementacion.md`.

## 4. Revisar

Lanzá en paralelo, en el mismo mensaje, a `fabrica-tester`, `fabrica-seguridad`, `fabrica-ui` y `fabrica-clean-code`. Van juntos porque los ciclos son pocos y conviene ver todos los problemas de una vez.

- Pasale a cada uno el plan, la línea de base y la lista de cambios de `git status --short`.
- En un ciclo de corrección, agregá los hallazgos anteriores para que confirmen si se resolvieron.
- Omití `fabrica-ui` solo si no cambió ningún `.tsx`, `.css` ni `dictionaries.ts`, y dejá registrado que se omitió.

Guardá cada informe en `ciclo-<n>/<agente>.md`. Leé la última línea de cada uno:

- **Todos `APROBADO`:** pasá a la etapa 6.
- **Alguno `BLOQUEADO`:** pasá a la etapa 7 de inmediato, porque otro ciclo no resuelve una decisión del usuario.
- **Alguno `CAMBIOS`:** pasá a la etapa 5.
- **Un informe sin veredicto claro:** pedile a ese agente que lo complete una vez. Si sigue sin claridad, contá ese informe como `BLOQUEADO`.

Un `APROBADO` no se reinterpreta: si creés que un revisor se equivocó, decilo en la entrega. Los hallazgos menores no abren un ciclo; van a la entrega.

## 5. Corregir

El máximo es de **2 ciclos de corrección**. La primera revisión no cuenta: un pedido tiene como máximo 3 revisiones y 2 correcciones. El límite evita gastar tiempo y tokens en un problema que necesita criterio humano.

- Si ya se hicieron 2 correcciones, pasá a la etapa 7.
- Si no, lanzá `fabrica-implementador` con todos los hallazgos bloqueantes y mayores, guardá su respuesta en `ciclo-<n>/implementacion.md` y volvé a la etapa 4.
- Si el implementador reporta un bloqueo o discute un hallazgo, pasá a la etapa 7: no arbitres vos entre agentes.

## 6. Entregar

Creá `docs/03-history/changes/<CHG>-<slug>.md` desde `_TEMPLATE.md`, con estado `Entregado`, y agregá su fila al índice de `README.md`. Es la excepción a no producir archivos: resume informes que ya existen. El pedido va textual, y `No verificado` y `Rollback` no pueden quedar vacíos, porque son lo primero que se va a leer cuando algo falle.

Dejá el código sin commitear en la rama de trabajo y detenete. No hagas commit, push, merge, release ni apliques migraciones: pasar a producción se decide después de esta entrega.

Mostrá este resumen:

```markdown
# Entrega: <CHG> — <título>

**Rama:** feature/<slug>, sin commitear
**Registro:** docs/03-history/changes/<CHG>-<slug>.md
**Ciclos de corrección usados:** <0, 1 o 2> de 2

## Qué se hizo
<en lenguaje simple, para alguien que no leyó el código>

## Criterios de aceptación
- CA1: <resultado y evidencia>

## Revisiones
- Tests: <lint, tipos, tests y build>
- Seguridad: <resultado>
- UI: <resultado, u omitida y por qué>
- Clean code: <resultado>

## Archivos
<lista>

## Migraciones
<archivos pendientes de aplicar, o "ninguna">

## No verificado
<RLS, migraciones y pantallas no ejecutadas. Decirlo claro: no fue probado>

## Hallazgos menores sin resolver
<lista, o "ninguno">
```

Preguntá si pasa a producción. Si responde que no o pide ajustes, un pedido nuevo vuelve a empezar con su propio límite de 2 ciclos.

## 7. Pedir ayuda

Detenete y dejá el trabajo en la rama, sin descartar nada. Explicale al usuario:

- qué se logró y qué sigue fallando;
- qué se intentó en cada ciclo;
- qué decisión o dato necesitás, en una pregunta concreta y con tu recomendación.

Con su respuesta, seguí desde la etapa que corresponda. Una respuesta suya habilita hasta 2 ciclos nuevos para ese problema.

## 8. Después de la aprobación

Solo con un sí explícito del usuario, seguí `docs/01-engineering/dev-workflow.md`: commit en `feature/<slug>`, merge a `develop` y validación. El release a `main` es un paso aparte: incluye `CHANGELOG.md`, versión y tag.

Aplicá `docs/01-engineering/traceability.md`: `Change-Id` en cada commit, `git merge --no-ff` y registro actualizado con su nuevo estado y versión. Sin eso, el cambio deja de poder rastrearse o revertirse como unidad.

Pedí confirmación separada para cada acción difícil de revertir: push, merge a `main`, tag y, sobre todo, aplicar migraciones a la base de producción. Un sí a una de ellas no cubre las demás.
