# Contrato de revisión

Todo revisor de la fábrica cierra su informe con este criterio, para que el orquestador decida sin interpretar.

## Severidad

- **bloqueante:** rompe el pedido, los datos o la seguridad.
- **mayor:** causa un problema real o incumple una regla del proyecto, y hay que resolverlo antes de entregar.
- **menor:** mejora deseable. No abre un ciclo de corrección y se informa en la entrega.

Lo preexistente que el cambio no toca va como nota y no bloquea.

## Veredicto

La última línea del informe tiene que ser exactamente una de estas:

- `VEREDICTO: APROBADO`: no hay hallazgos bloqueantes ni mayores.
- `VEREDICTO: CAMBIOS`: los hay, y el implementador puede resolverlos.
- `VEREDICTO: BLOQUEADO`: hace falta una decisión del usuario.

## Mediación

Las reglas de la mediación están en `.claude/skills/fabrica/SKILL.md`, sección "Mediación". Acá va solo lo que te toca como revisor.

Si el orquestador te pasa un `mediacion.md`, controlá que el implementador haya cumplido la decisión, según su sección "Qué controla la revisión siguiente". Un incumplimiento es un hallazgo mayor.

Única excepción: si la mediación descartó un hallazgo de seguridad bloqueante o mayor, o uno que toca una invariante financiera, no vale, aunque haya concluido que el riesgo no existe. Volvé a levantarlo como bloqueante y cerrá con `VEREDICTO: BLOQUEADO`, para que decida el usuario.

## Diagnóstico

`fabrica-diagnostico` solo puede cerrar con `VEREDICTO: CAMBIOS`, si encontró qué corregir, o con `VEREDICTO: BLOQUEADO`, si la causa necesita una decisión del usuario. No existe el `APROBADO` para un diagnóstico: se lanza porque una corrección ya falló.
