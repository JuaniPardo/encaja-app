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
