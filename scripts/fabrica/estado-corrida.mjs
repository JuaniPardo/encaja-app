// Estado persistente de una corrida de la fábrica. La lógica valida cada transición
// para que el límite de correcciones no dependa de la memoria del orquestador.
// Salidas de la CLI: 0 correcto, 1 regla violada, 2 uso incorrecto.

import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const VERSION_DE_ESTADO = 1;
const ARCHIVO_DE_ESTADO = "estado.json";
const AGENTE_DIAGNOSTICO = "fabrica-diagnostico";
const MAXIMO_DE_CORRECCIONES = 2;
const ORDEN_DE_REVISORES = ["fabrica-tester", "fabrica-clean-code", "fabrica-seguridad", "fabrica-ui"];
const TAMANOS = ["S", "M", "L"];
const RIESGOS = ["bajo", "alto"];
const ETAPAS = ["planificar", "implementar", "revisar", "diagnosticar", "corregir", "entregar", "ayuda", "cerrado"];
const SALIDAS_DE_AYUDA = ["planificar", "implementar", "revisar", "corregir", "entregar"];
const ETAPAS_CON_CORRECCION_EN_CURSO = ["diagnosticar", "corregir"];
const VEREDICTO = /^VEREDICTO: (APROBADO|CAMBIOS|BLOQUEADO)$/;

const INDICACIONES = {
  planificar: "Lanzá fabrica-planificador, clasificá la corrida y avanzá a implementar.",
  implementar: "Lanzá fabrica-implementador y guardá implementacion.md en la carpeta del ciclo.",
  revisar: "Lanzá los revisores de revisoresDelCiclo y guardá sus informes completos en la carpeta del ciclo.",
  diagnosticar: "Guardá cambio.diff y lanzá fabrica-diagnostico antes de la segunda corrección.",
  corregir: "Lanzá fabrica-implementador con los hallazgos y guardá implementacion.md en la carpeta del ciclo.",
  entregar: "Creá el registro CHG, mostrá la entrega y esperá la decisión del usuario.",
  ayuda: "Explicale al usuario qué falta y seguí con su respuesta, usando --respuesta-usuario.",
  cerrado: "La corrida terminó. No hay nada para retomar.",
};

export class ErrorDeRegla extends Error {}
export class ErrorDeUso extends Error {}

function ordenarRevisores(revisores) {
  return ORDEN_DE_REVISORES.filter((revisor) => revisores.includes(revisor));
}

export function revisoresPara({ tamano, riesgo, ui = false }) {
  if (!TAMANOS.includes(tamano)) throw new ErrorDeUso(`Tamaño inválido: ${tamano}.`);
  if (!RIESGOS.includes(riesgo)) throw new ErrorDeUso(`Riesgo inválido: ${riesgo}.`);

  const revisores = ["fabrica-tester"];
  if (tamano !== "S" || riesgo === "alto") revisores.push("fabrica-clean-code");
  if (tamano === "L" || riesgo === "alto") revisores.push("fabrica-seguridad");
  if (ui) revisores.push("fabrica-ui");
  return revisores;
}

export function rerevisionCompleta({ tamano, riesgo }) {
  return tamano === "L" || riesgo === "alto";
}

function revisoresDeRerevision(clasificacion, noAprobaron) {
  if (rerevisionCompleta(clasificacion)) return revisoresPara(clasificacion);
  return ordenarRevisores(["fabrica-tester", ...noAprobaron]);
}

function rutaDeEstado(directorio) {
  return path.join(directorio, ARCHIVO_DE_ESTADO);
}

function carpetaDeCiclo(directorio, ciclo) {
  return path.join(directorio, `ciclo-${ciclo}`);
}

function estadoEsValido(estado) {
  return (
    estado?.version === VERSION_DE_ESTADO &&
    ETAPAS.includes(estado.etapa) &&
    Number.isInteger(estado.correcciones) &&
    estado.correcciones >= 0 &&
    Number.isInteger(estado.ciclo) &&
    estado.ciclo >= 0 &&
    Array.isArray(estado.revisoresDelCiclo) &&
    Array.isArray(estado.historial)
  );
}

export function leerEstado(directorio) {
  const ruta = rutaDeEstado(directorio);
  if (!existsSync(ruta)) throw new ErrorDeRegla(`No existe ${ruta}. Ejecutá iniciar primero.`);
  let estado;
  try {
    estado = JSON.parse(readFileSync(ruta, "utf8"));
  } catch {
    throw new ErrorDeRegla(`${ruta} no es JSON válido.`);
  }
  if (!estadoEsValido(estado)) throw new ErrorDeRegla(`${ruta} no tiene el formato esperado.`);
  return estado;
}

function guardarEstado(directorio, estado) {
  const ruta = rutaDeEstado(directorio);
  const temporal = `${ruta}.${process.pid}.tmp`;
  writeFileSync(temporal, `${JSON.stringify(estado, null, 2)}\n`);
  renameSync(temporal, ruta);
}

function ultimoCiclo(directorio) {
  if (!existsSync(directorio)) return -1;
  const ciclos = readdirSync(directorio).map((nombre) => /^ciclo-(\d+)$/.exec(nombre)?.[1]).filter(Boolean);
  return Math.max(-1, ...ciclos.map(Number));
}

// Sin estado.json pero con ciclos, la corrida existió: reabrirla reinicia el tope, así que
// exige --reabrir, que la política de hooks manda a confirmar a una persona.
export function iniciar(directorio, { chg, slug, rama, worktree, reabrir = false, ahora = new Date() }) {
  if (existsSync(rutaDeEstado(directorio))) {
    throw new ErrorDeRegla(`La corrida ya existe en ${directorio}. Usá ver para retomarla.`);
  }
  const ciclo = ultimoCiclo(directorio) + 1;
  if (ciclo > 0 && !reabrir) {
    throw new ErrorDeRegla(`${directorio} ya tiene ciclos. Reabrirla reinicia el tope: requiere --reabrir.`);
  }
  const estado = {
    version: VERSION_DE_ESTADO,
    chg,
    slug,
    rama,
    worktree,
    etapa: "planificar",
    correcciones: 0,
    ciclo,
    clasificacion: null,
    revisoresDelCiclo: [],
    historial: [{ etapa: "planificar", fecha: ahora.toISOString() }],
  };
  mkdirSync(directorio, { recursive: true });
  guardarEstado(directorio, estado);
  return estado;
}

function validarQueSube(actual, nueva) {
  const baja =
    TAMANOS.indexOf(nueva.tamano) < TAMANOS.indexOf(actual.tamano) ||
    RIESGOS.indexOf(nueva.riesgo) < RIESGOS.indexOf(actual.riesgo) ||
    (actual.ui && !nueva.ui) ||
    (actual.financiero && !nueva.financiero);
  if (baja) throw new ErrorDeRegla("La clasificación solo puede subir, nunca bajar.");
}

export function clasificar(directorio, { tamano, riesgo, ui = false, financiero = false }) {
  const estado = leerEstado(directorio);
  if (estado.etapa === "cerrado") throw new ErrorDeRegla("La corrida está cerrada.");

  const nueva = { tamano, riesgo, ui, financiero };
  const revisores = revisoresPara(nueva);
  if (estado.clasificacion) validarQueSube(estado.clasificacion, nueva);

  const cambio = JSON.stringify(estado.clasificacion) !== JSON.stringify(nueva);
  const siguiente = { ...estado, clasificacion: nueva };
  if (cambio) {
    // Con un ciclo de corrección en curso, la revisión siguiente arranca con la lista completa.
    siguiente.revisoresDelCiclo = ETAPAS_CON_CORRECCION_EN_CURSO.includes(estado.etapa) ? [] : revisores;
  }
  guardarEstado(directorio, siguiente);
  return siguiente;
}

function exigirImplementacion(directorio, estado) {
  const ruta = path.join(carpetaDeCiclo(directorio, estado.ciclo), "implementacion.md");
  if (!existsSync(ruta)) throw new ErrorDeRegla(`Falta ${ruta}.`);
  if (!readFileSync(ruta, "utf8").includes("## Cambios")) {
    throw new ErrorDeRegla(`${ruta} no contiene "## Cambios": guardá el informe completo.`);
  }
}

function veredictoDeInforme(ruta) {
  if (!existsSync(ruta)) throw new ErrorDeRegla(`Falta el informe ${ruta}.`);
  const contenido = readFileSync(ruta, "utf8");
  if (!contenido.includes("## Hallazgos")) {
    throw new ErrorDeRegla(`${ruta} no contiene "## Hallazgos": guardá el informe completo, sin resumir.`);
  }
  const ultimaLinea = contenido.trimEnd().split("\n").pop();
  const coincidencia = VEREDICTO.exec(ultimaLinea ?? "");
  if (!coincidencia) throw new ErrorDeRegla(`${ruta} no termina con un VEREDICTO válido.`);
  return coincidencia[1];
}

function veredictosDelCiclo(directorio, estado, ciclo = estado.ciclo) {
  return estado.revisoresDelCiclo.map((revisor) => ({
    revisor,
    veredicto: veredictoDeInforme(path.join(carpetaDeCiclo(directorio, ciclo), `${revisor}.md`)),
  }));
}

function exigirTodosAprobados(directorio, estado) {
  if (estado.revisoresDelCiclo.length === 0) throw new ErrorDeRegla("El ciclo no tiene revisores.");
  const pendientes = veredictosDelCiclo(directorio, estado).filter(({ veredicto }) => veredicto !== "APROBADO");
  if (pendientes.length > 0) {
    throw new ErrorDeRegla(`No todos aprobaron: ${pendientes.map(({ revisor }) => revisor).join(", ")}.`);
  }
}

function exigirCambiosSinBloqueo(directorio, estado) {
  const veredictos = veredictosDelCiclo(directorio, estado).map(({ veredicto }) => veredicto);
  if (veredictos.includes("BLOQUEADO")) {
    throw new ErrorDeRegla("Un revisor quedó BLOQUEADO: pasá a ayuda.");
  }
  if (!veredictos.includes("CAMBIOS")) {
    throw new ErrorDeRegla("Ningún revisor pidió CAMBIOS.");
  }
}

function exigirDebajoDelTope(estado) {
  if (estado.correcciones >= MAXIMO_DE_CORRECCIONES) {
    throw new ErrorDeRegla(`Ya se usaron ${MAXIMO_DE_CORRECCIONES} correcciones: pasá a ayuda.`);
  }
}

function exigirDiagnostico(directorio, estado) {
  const ruta = path.join(carpetaDeCiclo(directorio, estado.ciclo), `${AGENTE_DIAGNOSTICO}.md`);
  const veredicto = veredictoDeInforme(ruta);
  if (veredicto === "BLOQUEADO") throw new ErrorDeRegla("El diagnóstico quedó BLOQUEADO: pasá a ayuda.");
  if (veredicto !== "CAMBIOS") throw new ErrorDeRegla("El diagnóstico debe cerrar con VEREDICTO: CAMBIOS.");
}

function entrarACorregir(estado) {
  return { ...estado, correcciones: estado.correcciones + 1, ciclo: estado.ciclo + 1 };
}

function transicionNormal(directorio, estado, destino) {
  const clave = `${estado.etapa}>${destino}`;
  switch (clave) {
    case "planificar>implementar":
      if (!estado.clasificacion) throw new ErrorDeRegla("Falta clasificar la corrida.");
      return estado;
    case "implementar>revisar":
      exigirImplementacion(directorio, estado);
      return { ...estado, revisoresDelCiclo: revisoresPara(estado.clasificacion) };
    case "revisar>entregar":
      exigirTodosAprobados(directorio, estado);
      return estado;
    case "revisar>corregir":
      exigirDebajoDelTope(estado);
      if (estado.correcciones !== 0) {
        throw new ErrorDeRegla("La segunda corrección exige diagnóstico: pasá a diagnosticar.");
      }
      exigirCambiosSinBloqueo(directorio, estado);
      return entrarACorregir(estado);
    case "revisar>diagnosticar":
      exigirDebajoDelTope(estado);
      if (estado.correcciones !== 1) {
        throw new ErrorDeRegla("El diagnóstico va antes de la segunda corrección: pasá a corregir.");
      }
      exigirCambiosSinBloqueo(directorio, estado);
      return estado;
    case "diagnosticar>corregir":
      exigirDiagnostico(directorio, estado);
      return entrarACorregir(estado);
    case "corregir>revisar": {
      exigirImplementacion(directorio, estado);
      if (estado.revisoresDelCiclo.length === 0) {
        return { ...estado, revisoresDelCiclo: revisoresPara(estado.clasificacion) };
      }
      const noAprobaron = veredictosDelCiclo(directorio, estado, estado.ciclo - 1)
        .filter(({ veredicto }) => veredicto !== "APROBADO")
        .map(({ revisor }) => revisor);
      return { ...estado, revisoresDelCiclo: revisoresDeRerevision(estado.clasificacion, noAprobaron) };
    }
    case "entregar>cerrado":
      return estado;
    default:
      throw new ErrorDeRegla(`Transición inválida: ${estado.etapa} → ${destino}.`);
  }
}

// Entregar desde ayuda exige las aprobaciones del ciclo vigente. Cualquier otra salida
// abre un ciclo nuevo, para que los informes viejos no valgan para código nuevo.
function salirDeAyuda(directorio, estado, destino, respuestaUsuario) {
  if (destino === "cerrado") return estado;
  if (!SALIDAS_DE_AYUDA.includes(destino)) {
    throw new ErrorDeRegla(`Transición inválida: ayuda → ${destino}.`);
  }
  if (!respuestaUsuario) throw new ErrorDeRegla("Salir de ayuda requiere --respuesta-usuario.");
  if (destino !== "planificar" && !estado.clasificacion) throw new ErrorDeRegla("Falta clasificar la corrida.");
  if (destino === "entregar") {
    exigirTodosAprobados(directorio, estado);
    return estado;
  }

  const cicloNuevo = { ...estado, correcciones: 0, ciclo: estado.ciclo + 1, revisoresDelCiclo: [] };
  if (destino === "corregir") return { ...cicloNuevo, correcciones: 1 };
  if (destino === "revisar") return { ...cicloNuevo, revisoresDelCiclo: revisoresPara(estado.clasificacion) };
  return cicloNuevo;
}

export function avanzar(directorio, { destino, respuestaUsuario, ahora = new Date() }) {
  if (!ETAPAS.includes(destino)) throw new ErrorDeUso(`Etapa desconocida: ${destino}.`);
  const estado = leerEstado(directorio);

  let siguiente;
  if (estado.etapa === "ayuda") {
    siguiente = salirDeAyuda(directorio, estado, destino, respuestaUsuario);
  } else if (destino === "ayuda" && estado.etapa !== "cerrado") {
    siguiente = estado;
  } else {
    siguiente = transicionNormal(directorio, estado, destino);
  }

  const entrada = {
    etapa: destino,
    fecha: ahora.toISOString(),
    ...(respuestaUsuario ? { respuestaUsuario } : {}),
  };
  const resultado = { ...siguiente, etapa: destino, historial: [...estado.historial, entrada] };
  guardarEstado(directorio, resultado);
  return resultado;
}

export function ver(directorio) {
  const estado = leerEstado(directorio);
  return {
    chg: estado.chg,
    rama: estado.rama,
    worktree: estado.worktree,
    etapa: estado.etapa,
    ciclo: estado.ciclo,
    correcciones: estado.correcciones,
    clasificacion: estado.clasificacion,
    revisoresDelCiclo: estado.revisoresDelCiclo,
    carpetaDelCiclo: carpetaDeCiclo(directorio, estado.ciclo),
    retomar: INDICACIONES[estado.etapa],
  };
}

function exigirOpciones(valores, nombres) {
  const faltantes = nombres.filter((nombre) => !valores[nombre]);
  if (faltantes.length > 0) {
    throw new ErrorDeUso(`Faltan opciones: ${faltantes.map((nombre) => `--${nombre}`).join(", ")}.`);
  }
}

function leerOpciones(args) {
  try {
    return parseArgs({
      args,
      options: {
        dir: { type: "string" },
        chg: { type: "string" },
        slug: { type: "string" },
        rama: { type: "string" },
        worktree: { type: "string" },
        reabrir: { type: "boolean", default: false },
        tamano: { type: "string" },
        riesgo: { type: "string" },
        ui: { type: "boolean", default: false },
        financiero: { type: "boolean", default: false },
        a: { type: "string" },
        "respuesta-usuario": { type: "string" },
      },
    }).values;
  } catch (error) {
    throw new ErrorDeUso(error.message);
  }
}

function ejecutarComando([comando, ...args]) {
  const valores = leerOpciones(args);
  exigirOpciones(valores, ["dir"]);
  const directorio = path.resolve(valores.dir);

  switch (comando) {
    case "iniciar":
      exigirOpciones(valores, ["chg", "slug", "rama", "worktree"]);
      return iniciar(directorio, valores);
    case "clasificar":
      exigirOpciones(valores, ["tamano", "riesgo"]);
      return clasificar(directorio, valores);
    case "avanzar":
      exigirOpciones(valores, ["a"]);
      return avanzar(directorio, { destino: valores.a, respuestaUsuario: valores["respuesta-usuario"] });
    case "ver":
      return ver(directorio);
    default:
      throw new ErrorDeUso(`Comando desconocido: ${comando}.`);
  }
}

function principal() {
  try {
    const resultado = ejecutarComando(process.argv.slice(2));
    process.stdout.write(`${JSON.stringify(resultado, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = error instanceof ErrorDeUso ? 2 : 1;
  }
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  principal();
}
