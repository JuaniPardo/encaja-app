// Política pura de los hooks de la fábrica: decide sobre un uso de herramienta sin
// ejecutarlo. Gana deny, luego ask, luego allow. Ver docs/01-engineering/fabrica-controles.md.

import os from "node:os";
import path from "node:path";

import {
  analizarComando,
  esOpcion,
  INTERPRETES,
  OPCIONES_NPM_CON_VALOR,
  opcionesYPosicionales,
  RAIZ_DEL_PROYECTO,
} from "./comando-shell.mjs";

const RAMAS_PROTEGIDAS = new Set(["main", "develop"]);
const HOST_PRODUCCION = /(?<![a-z0-9.-])encaja-app\.vercel\.app(?![a-z0-9-])/i;
const HOST_DEVELOP = /(?<![a-z0-9.-])encaja-app-git-develop-juan-pardos-projects\.vercel\.app(?![a-z0-9-])/i;
const HOST_SUPABASE = /[a-z0-9.-]*(?:\.supabase\.co(?![a-z0-9-])|pooler\.supabase\.com)/gi;
const HOST_PLACEHOLDER = "placeholder.supabase.co";
const HOSTS_LOCALES = new Set(["localhost", "127.0.0.1", "[::1]"]);
const NOMBRE_ENV = /(?<![\w$)\]])\.env[\w.-]*/gi;
const CANDIDATOS_ENV = [".env", ".env.local", ".env.production", ".env.development", ".env.production.local"];

// .git/ entra porque su config y sus hooks deciden qué ejecuta git: core.pager, core.fsmonitor, hooks/*.
const RUTAS_PROTEGIDAS = [
  /(^|\/)\.claude(\/settings[^/]*\.json|\/fabrica(\/runs(\/[^/]+)?)?)?$/i,
  /(^|\/)scripts(\/fabrica(\/.*)?)?$/i,
  /(^|\/)estado\.json$/i,
  /(^|\/)\.git(\/|$)/i,
];
// La config global de git decide qué ejecuta git por la misma razón que .git/config.
function configGitDelUsuario(home, xdgConfigHome) {
  const carpetas = [path.posix.join(home, ".config", "git"), ...(xdgConfigHome ? [path.posix.join(xdgConfigHome, "git")] : [])];
  return { home, archivos: [path.posix.join(home, ".gitconfig")], carpetas };
}
const CANDIDATOS_PROTEGIDOS = [
  ".claude", ".claude/settings.json", ".claude/settings.local.json", ".claude/fabrica", "scripts", "scripts/fabrica",
  "scripts/fabrica/hook-pre-tool-use.mjs", "estado.json", ".git", ".git/config", ".git/hooks", ".git/hooks/pre-commit",
];
const MENCION_DE_CONTROLES = /\.claude\/settings|scripts\/fabrica|estado\.json/i;
const PALABRA_DE_CODIGO = /[\s('"]/;
const COMANDOS_QUE_ESCRIBEN = new Set([
  "tee", "rm", "rmdir", "unlink", "mv", "cp", "truncate", "ln", "chmod", "chown", "touch", "shred", "install", "rsync",
]);
const EDITORES_EN_LUGAR = new Set(["sed", "gsed", "perl", "ruby"]);
const SUBCOMANDOS_GIT_QUE_ESCRIBEN = new Set(["rm", "mv", "checkout", "restore"]);

const SUBCOMANDOS_GIT_CON_MENSAJE = new Set(["commit", "merge", "tag", "notes"]);
const STASH_CON_MENSAJE = new Set(["push", "save"]);
const OPCIONES_GLOBALES_GIT_CON_VALOR = new Set([
  "-C", "-c", "--git-dir", "--work-tree", "--namespace", "--config-env", "--super-prefix", "--attr-source",
]);
const OPCIONES_PUSH_CON_VALOR = ["-o", "--push-option", "--repo", "--receive-pack", "--exec"];
const OPCIONES_PUSH_FORZADO = [
  ["--force", 7], ["--force-with-lease", 8], ["--force-if-includes", 8], ["--mirror", 3], ["--prune", 5],
];
const OPCIONES_BRANCH_QUE_CAMBIAN = [["--delete", 3], ["--move", 4], ["--copy", 5], ["--force", 6]];
const OPCIONES_TAG_DE_LISTADO = /^(-l|--list|--contains|--no-contains|--merged|--no-merged|--points-at|--sort|--format|--column|-n\d*)(=.*)?$/;
const RUTAS_EN_BLOQUE = /^(\.{1,2}\/?|:\/?\*?|\*)$/;
const DESTINOS_PROTEGIDOS = ["main", "develop", "refs/heads/main", "refs/heads/develop"];
const OPCION_DE_SALIDA = /^--out/i;
const ENTORNO_QUE_EJECUTA = /^(GIT_[A-Z0-9_]+|PAGER|EDITOR|VISUAL)$/;
const DECLARAN_ENTORNO = new Set(["export", "declare", "typeset"]);

const ACCIONES_GH = new Set(["pr merge", "release create", "release delete", "repo delete"]);
const GH_API_ESCRIBE = /(^| )(-[fF]|--field|--raw-field|--input|(-X ?|--method[ =])(?!GET( |$)))/i;
const ALIAS_NPM_CI = new Set([
  "ci", "clean-install", "ic", "install-clean", "isntall-clean", "cit", "clean-install-test", "install-ci-test",
]);
const ALIAS_NPM_RUN = new Set(["run", "run-script", "rum", "urn"]);
const ALIAS_NPM_TEST = new Set(["test", "t", "tst"]);
const SCRIPTS_DE_CHEQUEO = new Set(["lint", "typecheck", "test"]);
const PROGRAMAS_DE_CHEQUEO = new Set(["vitest", "eslint"]);
const OPCIONES_SUPABASE_CON_VALOR = [
  "--workdir", "--output", "-o", "--profile", "--dns-resolver", "--network-id", "--db-url",
];
const TAREAS_NEXT = new Set(["build", "dev", "start"]);
const OPCIONES_QUE_CONFIRMA_UNA_PERSONA = /^--(respuesta-usuario|reabrir)(=|$)/;
const HERRAMIENTAS_DE_COMANDO = new Set(["Bash", "Monitor", "PowerShell"]);
const CAMPOS_DE_RUTA = {
  Read: ["file_path"], Edit: ["file_path"], Write: ["file_path"], MultiEdit: ["file_path"],
  NotebookEdit: ["notebook_path"], Grep: ["path", "glob"],
};

const allow = () => ({ decision: "allow", regla: null, motivo: "" });
const ask = (regla, motivo) => ({ decision: "ask", regla, motivo });
const deny = (regla, motivo) => ({ decision: "deny", regla, motivo });
const askAutoproteccion = () => ask("autoproteccion", "Modifica los controles de la fábrica: lo confirma el usuario.");

function masSevera(hallazgos) {
  return hallazgos.find(({ decision }) => decision === "deny") ?? hallazgos.find(({ decision }) => decision === "ask") ?? allow();
}

function todasLasPalabras({ palabras, otrasPalabras, redirecciones }) {
  return [...palabras, ...otrasPalabras, ...redirecciones.map(({ destino }) => destino)];
}

// Git acepta prefijos únicos de sus opciones largas, por ejemplo --del o --mirr.
function esOpcionLarga(valor, opcion, minimo) {
  const nombre = valor.split("=")[0];
  return nombre.length >= minimo && opcion.startsWith(nombre);
}

function expandirLlaves(valor) {
  const coincidencia = /^(.*?)\{([^{}]*,[^{}]*)\}(.*)$/s.exec(valor);
  if (!coincidencia) return [valor];
  const [, antes, opciones, despues] = coincidencia;
  return opciones.split(",").flatMap((opcion) => expandirLlaves(`${antes}${opcion}${despues}`));
}

function globAlcanza(glob, candidatos) {
  const fuente = glob
    .replace(/[.+^$()|\\]/g, "\\$&")
    .replace(/\*/g, "[^/]*")
    .replace(/\?/g, "[^/]");
  try {
    const regex = new RegExp(`^${fuente}$`, "i");
    return candidatos.some((candidato) => regex.test(candidato));
  } catch {
    return true;
  }
}

function globAlcanzaEnv(valor) {
  const base = valor.split("/").pop() ?? "";
  return base.startsWith(".") && globAlcanza(base, CANDIDATOS_ENV);
}

function mencionaEnvSensible({ valor, glob, entrecomillada }) {
  return (glob ? expandirLlaves(valor) : [valor]).some((variante) => {
    const nombres = variante.match(NOMBRE_ENV) ?? [];
    const sensible = nombres.some((nombre) => nombre.replace(/[.-]+$/, "").toLowerCase() !== ".env.example");
    return sensible || (glob && !entrecomillada && globAlcanzaEnv(variante));
  });
}

function denegarEnv() {
  return deny(
    "env-local",
    "Los archivos .env* no se leen ni se escriben, salvo .env.example. Si solo buscás un texto, usá el tool Grep sobre el código.",
  );
}

// `git stash -m x` es un push implícito; `git stash list -m` es una opción de diff de git log.
function recibeMensaje({ subcomando, resto }) {
  if (subcomando?.valor !== "stash") return SUBCOMANDOS_GIT_CON_MENSAJE.has(subcomando?.valor);
  const primero = resto[0]?.valor;
  return primero === undefined || primero.startsWith("-") || STASH_CON_MENSAJE.has(primero);
}

function mensajeGit(git) {
  if (!recibeMensaje(git)) return [];
  const { resto } = git;
  const abreMensaje = (valor) => valor === "--message" || /^-[a-zA-Z]*m$/.test(valor);
  return resto.filter(
    ({ valor }, i) => abreMensaje(valor) || /^--message=|^-m./.test(valor) || abreMensaje(resto[i - 1]?.valor ?? ""),
  );
}

function palabrasSinMensajeGit(segmento) {
  const mensaje = mensajeGit(analizarGit(segmento));
  return todasLasPalabras(segmento).filter((palabra) => !mensaje.includes(palabra));
}

function reglaEnv(segmento) {
  const palabras = segmento.nombre === "git" ? palabrasSinMensajeGit(segmento) : todasLasPalabras(segmento);
  return palabras.some(mencionaEnvSensible) ? denegarEnv() : null;
}

function reglaUrlProduccion(segmento, { refsProduccion }) {
  const textos = todasLasPalabras(segmento).map(({ valor }) => valor);
  const contiene = (regex) => textos.some((texto) => regex.test(texto));
  const refs = refsProduccion.map((ref) => ref.toLowerCase());

  if (textos.some((texto) => refs.some((ref) => texto.toLowerCase().includes(ref)))) {
    return ask("ref-produccion", "El comando menciona el ref del proyecto Supabase de producción.");
  }
  if (contiene(HOST_PRODUCCION)) {
    return ask("url-produccion", "El comando apunta a la URL de producción.");
  }
  if (contiene(HOST_DEVELOP)) {
    return ask("url-develop", "El comando apunta a develop, que hoy usa la base de producción.");
  }
  const hostsSupabase = textos.flatMap((texto) => texto.match(HOST_SUPABASE) ?? []);
  if (refs.length === 0 && hostsSupabase.some((host) => host.toLowerCase() !== HOST_PLACEHOLDER)) {
    return ask("host-supabase", "No se conoce el ref de producción y el comando apunta a un host de Supabase.");
  }
  return null;
}

function valoresDbUrl(palabras) {
  return palabras.flatMap((palabra, i) => {
    if (palabra.valor === "--db-url") return [palabras[i + 1] ?? { valor: "", dinamico: true }];
    return palabra.valor.startsWith("--db-url=") ? [{ ...palabra, valor: palabra.valor.slice("--db-url=".length) }] : [];
  });
}

function hostDeUrl(valor) {
  try {
    return new URL(valor).hostname.toLowerCase() || null;
  } catch {
    return null;
  }
}

function dbUrlEsSegura({ valor, dinamico }, refsProduccion) {
  const host = hostDeUrl(valor);
  if (dinamico || host === null) return false;
  const minusculas = valor.toLowerCase();
  if (refsProduccion.some((ref) => minusculas.includes(ref.toLowerCase()))) return false;
  return HOSTS_LOCALES.has(host) || refsProduccion.length > 0;
}

function reglaSupabase(segmento, { refsProduccion }) {
  if (segmento.nombre !== "supabase") return null;

  const { opciones, posicionales } = opcionesYPosicionales(segmento.palabras, OPCIONES_SUPABASE_CON_VALOR);
  const [primero, segundo] = posicionales.map(({ valor }) => valor);
  const subcomando = [primero, segundo].filter(Boolean).join(" ");

  if (opciones.length === 1 && (opciones[0] === "--help" || opciones[0] === "-h")) return null;
  if (posicionales.length === 0 && opciones.includes("--version")) return null;
  if (subcomando === "migration new") return null;
  if (
    ["migration list", "db lint", "projects list"].includes(subcomando) ||
    ["gen", "status", "inspect"].includes(primero)
  ) {
    return ask("supabase-consulta", "Esta consulta de Supabase puede usar el proyecto enlazado, que es producción.");
  }

  const dbUrls = valoresDbUrl(segmento.palabras);
  if (dbUrls.some(({ dinamico }) => dinamico)) {
    return deny("supabase-db-url-variable", "Una --db-url en variable no se puede verificar. Usá scripts/supabase-dev-migrate.sh.");
  }
  if (dbUrls.length > 0 && dbUrls.every((dbUrl) => dbUrlEsSegura(dbUrl, refsProduccion))) return null;
  return deny(
    "supabase-escritura",
    "Este comando de Supabase puede tocar producción. En desarrollo usá scripts/supabase-dev-migrate.sh; en producción lo ejecuta el usuario desde su terminal.",
  );
}

// Cualquier configuración en línea puede cambiar qué ejecuta git (core.pager, diff.external,
// alias.*, core.sshCommand…): no se enumeran claves, se pregunta por todas.
function esConfiguracionEnLinea(valor) {
  return /^-c/.test(valor) || /^--config-env(=|$)/.test(valor) || valor.startsWith("--exec-path=");
}

function analizarGit(segmento) {
  const { palabras } = segmento;
  let cwd = segmento.cwd;
  let configuracionEnLinea = false;
  let i = 0;
  for (; i < palabras.length; i += 1) {
    const { valor, dinamico } = palabras[i];
    if (!valor.startsWith("-")) break;
    if (esConfiguracionEnLinea(valor) || dinamico) configuracionEnLinea = true;
    if (OPCIONES_GLOBALES_GIT_CON_VALOR.has(valor)) i += 1;
    if (valor === "-C") {
      const destino = palabras[i];
      if (!destino || destino.dinamico) cwd = null;
      else if (path.posix.isAbsolute(destino.valor) || cwd !== null) cwd = path.posix.resolve(cwd ?? "/", destino.valor);
    }
  }
  return { subcomando: palabras[i], resto: palabras.slice(i + 1), cwd, configuracionEnLinea };
}

function subcomandoGit(segmento) {
  return segmento.nombre === "git" ? analizarGit(segmento).subcomando?.valor : undefined;
}

function esRamaProtegida(valor) {
  return RAMAS_PROTEGIDAS.has(valor.replace(/^refs\/heads\//, "").replace(/^origin\//, ""));
}

function pushEsForzado(opcion) {
  return /^-[a-zA-Z]*f/.test(opcion) || OPCIONES_PUSH_FORZADO.some(([larga, minimo]) => esOpcionLarga(opcion, larga, minimo));
}

function pushBorra(opcion) {
  return /^-[a-zA-Z]*d/.test(opcion) || esOpcionLarga(opcion, "--delete", "--de".length);
}

function reglaPush(git) {
  const { opciones, posicionales } = opcionesYPosicionales(git.resto, OPCIONES_PUSH_CON_VALOR);
  const valores = posicionales.map(({ valor }) => valor);

  if (opciones.some(pushEsForzado) || valores.some((valor) => valor.startsWith("+"))) {
    return deny("git-push-forzado", "Reescribir historia remota no está permitido.");
  }
  const borraProtegida = opciones.some(pushBorra)
    ? valores.some(esRamaProtegida)
    : valores.some((valor) => valor.startsWith(":") && esRamaProtegida(valor.slice(1)));
  if (borraProtegida) {
    return deny("git-rama-protegida", "main y develop no se borran, ni se renombran, ni se mueven.");
  }
  return ask("git-push", "El push publica código: lo confirma el usuario.");
}

function reglaBranch(git, segmento) {
  const { opciones, posicionales } = opcionesYPosicionales(git.resto);
  const cambia = opciones.some(
    (opcion) =>
      /^-[a-zA-Z]*[dDmMcCf][a-zA-Z]*$/.test(opcion) ||
      OPCIONES_BRANCH_QUE_CAMBIAN.some(([larga, minimo]) => esOpcionLarga(opcion, larga, minimo)),
  );
  if (!cambia) return null;
  if (posicionales.some(({ valor }) => esRamaProtegida(valor))) {
    return deny("git-rama-protegida", "main y develop no se borran, ni se renombran, ni se mueven.");
  }
  if (posicionales.some(({ dinamico }) => dinamico) || segmento.envoltorios.includes("xargs")) {
    return ask("git-rama-dinamica", "No se puede saber qué rama se va a cambiar.");
  }
  return null;
}

// Valores de una opción, separada (`-B main`, `--force-create main`) o pegada (`-Bmain`, `--force-create=main`).
function valoresDeOpcion(resto, corta, larga = null, minimo = Infinity) {
  return resto.flatMap(({ valor }, i) => {
    const siguiente = resto[i + 1]?.valor ?? "";
    const pegada = new RegExp(`^-[a-zA-Z]*?${corta}(.*)$`).exec(valor);
    if (pegada) return [pegada[1] || siguiente];
    if (!larga || !valor.startsWith("--") || !esOpcionLarga(valor, larga, minimo)) return [];
    return [valor.includes("=") ? valor.slice(valor.indexOf("=") + 1) : siguiente];
  });
}

function destinoEsProtegido(destino) {
  return destino.includes("*") ? globAlcanza(destino, DESTINOS_PROTEGIDOS) : esRamaProtegida(destino);
}

// Misma invariante que reglaBranch por otros subcomandos: crear "a la fuerza" una rama que ya
// existe la mueve, y un refspec de fetch o pull con destino local también.
function mueveRamaProtegida({ subcomando: { valor: subcomando }, resto }) {
  switch (subcomando) {
    case "checkout":
      return valoresDeOpcion(resto, "B").some(esRamaProtegida);
    case "switch":
      return valoresDeOpcion(resto, "C", "--force-create", "--force-c".length).some(esRamaProtegida);
    case "worktree":
      return resto[0]?.valor === "add" && valoresDeOpcion(resto, "B").some(esRamaProtegida);
    case "fetch":
    case "pull":
      return resto.some(({ valor }) => {
        const separador = valor.lastIndexOf(":");
        return separador !== -1 && destinoEsProtegido(valor.slice(separador + 1));
      });
    default:
      return false;
  }
}

// `./.`, `src/..` y la ruta absoluta del repo o de una carpeta que lo contiene cuentan como `.`.
function rutaNormalizada(valor, cwd) {
  if (valor.startsWith(":")) return valor;
  if (path.posix.isAbsolute(valor) && cwd !== null && !path.posix.relative(valor, cwd).startsWith("..")) return ".";
  return path.posix.normalize(valor).replace(/(.)\/+$/, "$1");
}

function descartaTrabajo({ subcomando: { valor: subcomando }, resto, cwd }) {
  const { opciones, posicionales } = opcionesYPosicionales(resto);
  const tiene = (corta, larga, minimo) =>
    opciones.some((opcion) => corta.test(opcion) || esOpcionLarga(opcion, larga, minimo));
  const fuerza = tiene(/^-[a-zA-Z]*f/, "--force", "--f".length);
  const enBloque = posicionales.some(({ valor }) => RUTAS_EN_BLOQUE.test(rutaNormalizada(valor, cwd)));
  const primero = posicionales[0]?.valor;

  switch (subcomando) {
    case "reset":
      return tiene(/^$/, "--hard", "--ha".length);
    case "clean":
      return fuerza && !tiene(/^-[a-zA-Z]*n/, "--dry-run", "--d".length);
    case "checkout":
      return fuerza || enBloque;
    case "switch":
      return fuerza || tiene(/^$/, "--discard-changes", "--di".length);
    case "restore":
      return enBloque && (!tiene(/^-S$/, "--staged", "--st".length) || tiene(/^-W$/, "--worktree", "--wo".length));
    case "stash":
      return primero === "drop" || primero === "clear";
    case "worktree":
      return primero === "remove" && fuerza;
    default:
      return false;
  }
}

function reglaTag(git) {
  const { opciones, posicionales } = opcionesYPosicionales(git.resto);
  const lista = opciones.length > 0 && opciones.every((opcion) => OPCIONES_TAG_DE_LISTADO.test(opcion));
  if (lista || (opciones.length === 0 && posicionales.length === 0)) return null;
  return ask("git-tag", "Crear o borrar tags es una acción de release: la confirma el usuario.");
}

function ramaDestino(git, { ramaDe, cambiaDeRama }) {
  return git.cwd === null || cambiaDeRama ? null : ramaDe(git.cwd);
}

function reglaMerge(git, contexto) {
  if (git.resto.some(({ valor }) => valor === "--abort")) return null;
  const rama = ramaDestino(git, contexto);
  if (rama === null) {
    return ask("git-merge-destino-desconocido", "No se puede saber en qué rama cae este merge.");
  }
  return rama === "main" ? ask("git-merge-main", "El merge a main es parte del release: lo confirma el usuario.") : null;
}

// Un commit, o un --amend, sobre main o develop solo ocurre en un release o en una integración.
function reglaCommit(git, contexto) {
  const rama = ramaDestino(git, contexto);
  return rama !== null && RAMAS_PROTEGIDAS.has(rama)
    ? ask("git-commit-rama-protegida", `El commit cae en ${rama}: lo confirma el usuario.`)
    : null;
}

function reglaDeSubcomandoGit(git, segmento, contexto) {
  if (!git.subcomando) return null;
  if (git.subcomando.dinamico) {
    return ask("comando-dinamico", "El subcomando de git se arma al ejecutar y no se puede evaluar.");
  }
  if (descartaTrabajo(git)) {
    return deny("git-descarta-trabajo", "Este comando descarta trabajo en bloque, sin recuperación.");
  }
  if (mueveRamaProtegida(git)) {
    return deny("git-rama-protegida", "main y develop no se borran, ni se renombran, ni se mueven.");
  }
  const mensaje = mensajeGit(git);
  if (git.resto.some((palabra) => !mensaje.includes(palabra) && OPCION_DE_SALIDA.test(palabra.valor))) {
    return ask("git-escribe-archivo", "Una opción --output de git escribe un archivo cualquiera: lo confirma el usuario.");
  }

  switch (git.subcomando.valor) {
    case "push":
      return reglaPush(git);
    case "branch":
      return reglaBranch(git, segmento);
    case "tag":
      return reglaTag(git);
    case "merge":
      return reglaMerge(git, contexto);
    case "commit":
      return reglaCommit(git, contexto);
    default:
      return null;
  }
}

function reglaGit(segmento, contexto) {
  if (segmento.nombre !== "git") return null;
  const git = analizarGit(segmento);
  const hallazgo = reglaDeSubcomandoGit(git, segmento, contexto);
  if (hallazgo?.decision === "deny" || !git.configuracionEnLinea) return hallazgo;
  return ask("configuracion-en-linea", "Una configuración de git en línea puede cambiar qué comando corre.");
}

function reglaEntornoQueEjecuta({ nombre, entorno, args }) {
  const declaradas = DECLARAN_ENTORNO.has(nombre) ? args.map((valor) => valor.split("=")[0]) : [];
  const nombres = [...Object.keys(entorno), ...declaradas];
  return nombres.some((variable) => ENTORNO_QUE_EJECUTA.test(variable))
    ? ask("configuracion-en-linea", "GIT_*, PAGER, EDITOR o VISUAL en el entorno pueden cambiar qué comando corre.")
    : null;
}

function posicionalesDeNpm(segmento) {
  return opcionesYPosicionales(segmento.palabras, OPCIONES_NPM_CON_VALOR).posicionales.map(({ valor }) => valor);
}

function reglaNpmCi(segmento) {
  if (segmento.nombre !== "npm" || !ALIAS_NPM_CI.has(posicionalesDeNpm(segmento)[0])) return null;
  const conDryRun = segmento.args.some((valor) => /^--dry-run(=(?!false$).*)?$/.test(valor));
  const dryRunDeEntorno = Object.entries(segmento.entorno).some(
    ([nombre, valor]) => nombre.toLowerCase() === "npm_config_dry_run" && !["", "false"].includes(valor),
  );
  return conDryRun || dryRunDeEntorno ? deny("npm-ci-dry-run", "npm ci --dry-run puede vaciar node_modules: no se usa.") : null;
}

function tareaNext(segmento) {
  if (segmento.nombre === "next") {
    const { opciones, posicionales } = opcionesYPosicionales(segmento.palabras);
    if (opciones.some((opcion) => ["-h", "--help", "-v", "--version"].includes(opcion))) return null;
    const tarea = posicionales[0]?.valor ?? "dev";
    return TAREAS_NEXT.has(tarea) ? tarea : null;
  }
  if (segmento.nombre === "npm") {
    const [primero, segundo] = posicionalesDeNpm(segmento);
    if (primero === "start") return "start";
    return ALIAS_NPM_RUN.has(primero) && TAREAS_NEXT.has(segundo) ? segundo : null;
  }
  return null;
}

function tienePlaceholders({ entorno }) {
  const url = entorno.NEXT_PUBLIC_SUPABASE_URL === `https://${HOST_PLACEHOLDER}`;
  return url && entorno.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY === "placeholder";
}

function reglaNext(segmento) {
  const tarea = tareaNext(segmento);
  if (!tarea || tienePlaceholders(segmento)) return null;
  const motivo =
    "Sin NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY de placeholder en la misma línea, Next carga .env.local, que apunta a producción.";
  return tarea === "build" ? deny("next-build-sin-placeholders", motivo) : ask("next-sin-placeholders", motivo);
}

function reglaPublicacion(segmento) {
  if (segmento.nombre === "vercel") {
    return ask("vercel", "Los comandos de Vercel pueden publicar: los confirma el usuario.");
  }
  if (segmento.nombre !== "gh") return null;
  const { posicionales } = opcionesYPosicionales(segmento.palabras, ["-R", "--repo", "-X", "--method"]);
  const [primero, segundo] = posicionales.map(({ valor }) => valor);
  if (ACCIONES_GH.has(`${primero} ${segundo}`) || (primero === "api" && GH_API_ESCRIBE.test(segmento.args.join(" ")))) {
    return ask("gh-accion", "Esta acción de GitHub publica o borra: la confirma el usuario.");
  }
  return null;
}

function reglaComandoDinamico({ dinamico }) {
  return dinamico ? ask("comando-dinamico", "La palabra de comando se arma al ejecutar y no se puede evaluar.") : null;
}

// El texto del usuario lo escribe el orquestador: el script no puede comprobarlo. El control
// es que el comando pase por una confirmación humana.
function reglaEstadoCorrida({ args }) {
  return args.some((valor) => OPCIONES_QUE_CONFIRMA_UNA_PERSONA.test(valor))
    ? ask("estado-confirmacion", "Reinicia el tope de correcciones o una corrida: lo confirma una persona.")
    : null;
}

function sinTilde(ruta, home) {
  return ruta === "~" || ruta.startsWith("~/") ? `${home}${ruta.slice(1)}` : ruta;
}

// Sin distinguir mayúsculas, como RUTAS_PROTEGIDAS: el disco de macOS no las distingue.
function esConfigGitDelUsuario(ruta, { archivos, carpetas }) {
  const igual = (a, b) => a.toLowerCase() === b.toLowerCase();
  const dentro = (carpeta) => igual(ruta, carpeta) || ruta.toLowerCase().startsWith(`${carpeta.toLowerCase()}/`);
  return archivos.some((archivo) => igual(ruta, archivo)) || carpetas.some(dentro);
}

function alcanzaControles(ruta, cwd, configGit) {
  return expandirLlaves(ruta).some((variante) => {
    const expandida = sinTilde(variante, configGit.home);
    const absoluta = path.posix.isAbsolute(expandida) || !cwd ? expandida : path.posix.join(cwd, expandida);
    const normalizada = path.posix.normalize(absoluta).replace(/\/+$/, "");
    if (RUTAS_PROTEGIDAS.some((regex) => regex.test(normalizada))) return true;
    if (esConfigGitDelUsuario(normalizada, configGit)) return true;
    if (!/[*?[]/.test(variante)) return false;
    const partes = normalizada.split("/");
    const candidatosDelUsuario = [...configGit.archivos, ...configGit.carpetas.map((carpeta) => `${carpeta}/config`)];
    return (
      globAlcanza(normalizada, candidatosDelUsuario) ||
      partes.some((_, i) => globAlcanza(partes.slice(i).join("/"), CANDIDATOS_PROTEGIDOS))
    );
  });
}

// Una opción de salida (`-o`, `--out*`) escribe donde diga su valor, en cualquier programa:
// los chequeos de permissions.allow (eslint, vitest) también la tienen.
function escribeArchivos(segmento) {
  if (COMANDOS_QUE_ESCRIBEN.has(segmento.nombre)) return true;
  if (segmento.args.some((valor) => /^-o$/.test(valor) || OPCION_DE_SALIDA.test(valor))) return true;
  if (EDITORES_EN_LUGAR.has(segmento.nombre)) {
    return segmento.args.some((valor) => /^(-[a-zA-Z]*i|--in-place)/.test(valor));
  }
  return SUBCOMANDOS_GIT_QUE_ESCRIBEN.has(subcomandoGit(segmento));
}

function valorSinOpcion(palabra) {
  const igual = palabra.valor.indexOf("=");
  return palabra.valor.startsWith("-") && igual !== -1 ? { ...palabra, valor: palabra.valor.slice(igual + 1) } : palabra;
}

function reglaAutoproteccion(segmento, { configGit }) {
  const afecta = ({ valor, dinamico }) =>
    (dinamico && !RAIZ_DEL_PROYECTO.test(valor)) || alcanzaControles(valor, segmento.cwd, configGit);
  const redirige = segmento.redirecciones.some(({ escribe, destino }) => escribe && afecta(destino));
  const escribe =
    escribeArchivos(segmento) &&
    (segmento.envoltorios.includes("xargs") || segmento.palabras.map(valorSinOpcion).some(afecta));
  const codigoEnLinea =
    INTERPRETES.test(segmento.nombre ?? "") &&
    todasLasPalabras(segmento).some(({ valor }) => PALABRA_DE_CODIGO.test(valor) && MENCION_DE_CONTROLES.test(valor));
  return redirige || escribe || codigoEnLinea ? askAutoproteccion() : null;
}

// Los chequeos de permissions.allow solo pasan con argumentos posicionales. Sus opciones,
// las de npm (--node-options, --script-shell, --prefix, --userconfig) y las del programa
// (--poolOptions.forks.execArgv de vitest, -c, -f y --rulesdir de eslint), ejecutan código o
// escriben donde digan: no se enumeran, se pregunta por todas.
function esChequeo(segmento) {
  if (PROGRAMAS_DE_CHEQUEO.has(segmento.nombre)) return true;
  if (segmento.nombre !== "npm") return false;
  const [primero, segundo] = posicionalesDeNpm(segmento);
  return ALIAS_NPM_TEST.has(primero) || (ALIAS_NPM_RUN.has(primero) && SCRIPTS_DE_CHEQUEO.has(segundo));
}

function reglaChequeoConOpciones(segmento) {
  const conOpciones = segmento.args.some((valor) => valor !== "--" && esOpcion(valor));
  return conOpciones && esChequeo(segmento)
    ? ask("chequeo-con-opciones", "Las opciones de npm, vitest o eslint pueden ejecutar código: lo confirma el usuario.")
    : null;
}

// Las demás reglas leen el texto de cada argumento antes de que el shell lo expanda. Si el
// shell puede cambiarlo, ese texto no es lo que recibe el programa, en cualquier comando. Quedan
// afuera los valores de asignaciones, los destinos de redirección (autoproteccion) y los cuerpos.
function reglaArgumentoIncierto({ palabras, palabrasDeEnvoltorios }) {
  return [...palabrasDeEnvoltorios, ...palabras].some(({ incierta }) => incierta)
    ? ask(
        "argumento-incierto",
        "Un argumento se arma al ejecutar (variable, sustitución, llaves o glob al inicio) y puede ser otra opción: lo confirma el usuario.",
      )
    : null;
}

function decidirComando(toolInput, contexto) {
  const analisis = analizarComando(toolInput?.command, { cwd: contexto.cwd ?? null });
  if (!analisis.ok) {
    return ask("comando-no-analizable", `No se pudo analizar el comando: ${analisis.error}.`);
  }
  const { segmentos } = analisis;
  const cambiaDeRama = segmentos.some((segmento) => ["checkout", "switch"].includes(subcomandoGit(segmento)));
  const hallazgos = segmentos.flatMap((segmento) => [
    reglaComandoDinamico(segmento),
    reglaEnv(segmento),
    reglaUrlProduccion(segmento, contexto),
    reglaSupabase(segmento, contexto),
    reglaGit(segmento, { ...contexto, cambiaDeRama }),
    reglaNpmCi(segmento),
    reglaNext(segmento),
    reglaPublicacion(segmento),
    reglaEstadoCorrida(segmento),
    reglaAutoproteccion(segmento, contexto),
    reglaEntornoQueEjecuta(segmento),
    reglaChequeoConOpciones(segmento),
    reglaArgumentoIncierto(segmento),
  ]);
  return masSevera(hallazgos.filter(Boolean));
}

function decidirArchivo(toolName, toolInput, contexto) {
  const valores = CAMPOS_DE_RUTA[toolName].map((campo) => toolInput?.[campo]).filter((valor) => valor !== undefined);
  if (valores.some((valor) => typeof valor !== "string")) {
    return ask("entrada-invalida", "La ruta de la herramienta no es texto.");
  }
  const sensible = valores.flatMap(expandirLlaves).some((valor) => {
    const base = valor.split("/").pop() ?? "";
    return mencionaEnvSensible({ valor: base, glob: /[*?[]/.test(base), entrecomillada: false });
  });
  if (sensible) return denegarEnv();
  if (toolName !== "Read" && toolName !== "Grep" && valores.some((valor) => alcanzaControles(valor, contexto.cwd, contexto.configGit))) {
    return askAutoproteccion();
  }
  return allow();
}

export function decidirHerramienta({ toolName, toolInput, contexto }) {
  const { home, xdgConfigHome, ...resto } = contexto ?? {};
  const contextoCompleto = {
    refsProduccion: [],
    ramaDe: () => null,
    ...resto,
    configGit: configGitDelUsuario(home ?? os.homedir(), xdgConfigHome ?? process.env.XDG_CONFIG_HOME),
  };
  if (HERRAMIENTAS_DE_COMANDO.has(toolName)) return decidirComando(toolInput, contextoCompleto);
  if (Object.hasOwn(CAMPOS_DE_RUTA, toolName)) return decidirArchivo(toolName, toolInput, contextoCompleto);
  if (toolInput?.command !== undefined) {
    return ask("herramienta-desconocida", `La política no conoce ${toolName}, que recibe un comando.`);
  }
  return allow();
}
