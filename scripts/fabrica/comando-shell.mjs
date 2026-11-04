// Analizador puro de comandos de shell para la política de hooks de la fábrica.
// No ejecuta nada y no busca entender todo bash: reconoce la forma trivial (palabras,
// comillas, && || ; |, redirecciones y sustituciones revisables). Lo demás lo informa
// como error o como segmento dinámico, y la política responde ask. Una palabra que el shell
// puede convertir en otra (llaves, expansiones sin comillas, o un primer carácter que sale
// de una expansión o de un glob) se marca `incierta`: su texto no es lo que recibe el programa.

import path from "node:path";

const PROFUNDIDAD_MAXIMA = 3;
const SHELLS = new Set(["bash", "sh", "zsh", "dash", "ksh"]);
export const INTERPRETES = /^(python[\d.]*|node|nodejs|ruby|perl|php|deno|bun|tsx|ts-node)$/;
const PALABRAS_RESERVADAS = new Set([
  "!", "{", "}", "if", "then", "elif", "else", "fi", "do", "done", "while", "until", "esac", "function",
]);
const OPERADORES_DE_CONTROL = ["&&", "||", "|&", "|", ";", "&"];
const OPERADORES_DE_REDIRECCION = ["<<<", "<<-", "&>>", "<<", "<&", "<>", ">>", ">&", ">|", "&>", "<", ">"];
const REDIRECCIONES_DE_ESCRITURA = new Set([">", ">>", ">|", "&>", "&>>", "<>"]);
const ASIGNACION = /^([A-Za-z_][A-Za-z0-9_]*)\+?=/;
const OPCION_C_DE_SHELL = /^-[a-zA-Z]*c[a-zA-Z]*$/;
const OPCION_CON_SCRIPT = /^(-S|--split-string|-c$|--call)/;
const SCRIPT_POR_DESCRIPTOR = /^\/(dev|proc)\//;
export const RAIZ_DEL_PROYECTO = /^(\$CLAUDE_PROJECT_DIR|\$\{CLAUDE_PROJECT_DIR\})\/[^$`]*$/;
const LLAVES_QUE_EXPANDEN = /\{[^{}]*(,|\.\.)[^{}]*\}/;
const GLOB_AL_INICIO = /^[*?[]/;
const OCULTO = "_";
const ANTES_DE_SUBSHELL = /^$|[\s;|&(]/;
const FIN_DE_PALABRA = /^$|[\s;|&()<>]/;

export const OPCIONES_NPM_CON_VALOR = ["--prefix", "-w", "--workspace"];
const OPCIONES_DE_PAQUETE = ["-p", "--package"];
const OPCIONES_DE_ENVOLTORIOS = {
  env: ["-u", "--unset", "-C", "--chdir", "-P"],
  sudo: [
    "-u", "--user", "-g", "--group", "-h", "--host", "-p", "--prompt", "-C", "-D", "--chdir", "-R", "--chroot", "-T",
    "-U", "-r", "-t",
  ],
  command: [],
  exec: ["-a"],
  time: ["-o", "-f"],
  nohup: [],
  nice: ["-n", "--adjustment"],
  timeout: ["-k", "--kill-after", "-s", "--signal"],
  xargs: [
    "-I", "--replace", "-L", "--max-lines", "-n", "--max-args", "-P", "--max-procs", "-s", "--max-chars", "-E", "--eof",
    "-d", "--delimiter", "-a", "--arg-file", "-J", "-R", "-S",
  ],
  npx: OPCIONES_DE_PAQUETE,
  bunx: OPCIONES_DE_PAQUETE,
  pnpx: OPCIONES_DE_PAQUETE,
};
const GESTORES_DE_PAQUETES = new Set(["npm", "pnpm", "yarn", "bun"]);
const SUBCOMANDOS_QUE_EJECUTAN = new Set(["exec", "x", "dlx"]);
// yarn y pnpm ejecutan el binario de un paquete cuando el subcomando no es propio: `yarn supabase`.
const GESTORES_QUE_EJECUTAN_BINARIOS = new Set(["pnpm", "yarn"]);
const SUBCOMANDOS_PROPIOS_DE_GESTORES = new Set([
  "add", "audit", "cache", "config", "i", "info", "init", "install", "link", "list", "ls", "outdated", "pack",
  "publish", "remove", "rm", "store", "unlink", "up", "update", "upgrade", "why",
]);

class ErrorDeAnalisis extends Error {}

function nuevaPalabra(valor = "") {
  return { valor, dinamico: false, entrecomillada: false, glob: false, incierta: false };
}

// Fuera del texto del comando, CLAUDE_PROJECT_DIR solo puede aparecer como expansión simple:
// si aparece de otra forma (asignación, export, read, for, ${…:=…}), su valor no es seguro.
// Tampoco si el comando nombra IFS: sin comillas, la raíz se parte en las palabras que IFS diga.
function raizSinReasignar(texto) {
  const menciones = texto.match(/CLAUDE_PROJECT_DIR/g)?.length ?? 0;
  const expansiones = texto.match(/\$CLAUDE_PROJECT_DIR(?![A-Za-z0-9_])|\$\{CLAUDE_PROJECT_DIR\}/g)?.length ?? 0;
  return menciones === expansiones && !/(?<![A-Za-z0-9_])IFS(?![A-Za-z0-9_])/.test(texto);
}

function nuevoComando() {
  return { palabras: [], redirecciones: [], hereString: null, recibePipe: false, segmento: null };
}

function nombreDeComando(valor) {
  const base = valor.split("/").pop() ?? "";
  return base.replace(/(.)@.*$/, "$1").toLowerCase();
}

export function esOpcion(valor) {
  return valor.length > 1 && valor.startsWith("-");
}

/**
 * Con `limite`, corta al juntar esa cantidad de posicionales y devuelve lo no recorrido en `resto`.
 * @template {{ valor: string }} P
 * @param {P[]} palabras
 * @param {string[]} [conValor]
 * @param {number} [limite]
 * @returns {{ opciones: string[], posicionales: P[], resto: P[] }}
 */
export function opcionesYPosicionales(palabras, conValor = [], limite = Infinity) {
  const opciones = [];
  const posicionales = [];
  for (let i = 0; i < palabras.length; i += 1) {
    if (posicionales.length >= limite) return { opciones, posicionales, resto: palabras.slice(i) };
    const { valor } = palabras[i];
    if (valor === "--") {
      posicionales.push(...palabras.slice(i + 1));
      break;
    }
    if (esOpcion(valor)) {
      opciones.push(valor);
      if (conValor.includes(valor)) i += 1;
    } else {
      posicionales.push(palabras[i]);
    }
  }
  return { opciones, posicionales, resto: [] };
}

function extraerAsignaciones(palabras, entorno, otrasPalabras) {
  let i = 0;
  for (; i < palabras.length; i += 1) {
    const coincidencia = ASIGNACION.exec(palabras[i].valor);
    if (!coincidencia) break;
    entorno[coincidencia[1]] = palabras[i].valor.slice(coincidencia[0].length);
    otrasPalabras.push(palabras[i]);
  }
  return palabras.slice(i);
}

function sinPalabrasReservadas(palabras) {
  const esReservada = ({ valor, entrecomillada, dinamico }) =>
    !entrecomillada && !dinamico && PALABRAS_RESERVADAS.has(valor);
  const primera = palabras.findIndex((palabra) => !esReservada(palabra));
  return primera === -1 ? [] : palabras.slice(primera);
}

function palabraDeComandoEsDinamica({ valor, dinamico, glob }) {
  return dinamico || valor.startsWith("=") || (glob && !/^\[\[?$/.test(valor));
}

function esScriptDinamico(palabra) {
  return !palabra || palabra.dinamico || SCRIPT_POR_DESCRIPTOR.test(palabra.valor);
}

function leeDeRedireccion({ redirecciones }) {
  return redirecciones.some(({ operador }) => operador === "<");
}

function palabrasDelEnvuelto(args, conValor, previos = 0) {
  const { opciones, posicionales, resto } = opcionesYPosicionales(args, conValor, previos + 1);
  return { opciones, palabras: [...posicionales.slice(previos), ...resto] };
}

function interiorDeEnvoltorio(nombre, args) {
  if (GESTORES_DE_PAQUETES.has(nombre)) {
    const { posicionales, resto } = opcionesYPosicionales(args, OPCIONES_NPM_CON_VALOR, 1);
    const subcomando = posicionales[0]?.valor;
    const ejecutaBinarios = GESTORES_QUE_EJECUTAN_BINARIOS.has(nombre);
    if (SUBCOMANDOS_QUE_EJECUTAN.has(subcomando) || (ejecutaBinarios && subcomando === "run")) {
      return palabrasDelEnvuelto(resto, [...OPCIONES_DE_PAQUETE, ...OPCIONES_NPM_CON_VALOR]);
    }
    const ejecutaBinario = ejecutaBinarios && subcomando !== undefined && !SUBCOMANDOS_PROPIOS_DE_GESTORES.has(subcomando);
    return ejecutaBinario ? { opciones: [], palabras: [posicionales[0], ...resto] } : null;
  }
  if (!Object.hasOwn(OPCIONES_DE_ENVOLTORIOS, nombre)) return null;
  const interior = palabrasDelEnvuelto(args, OPCIONES_DE_ENVOLTORIOS[nombre], nombre === "timeout" ? 1 : 0);
  const soloConsulta = nombre === "command" && interior.opciones.some((opcion) => /^-[vV]$/.test(opcion));
  return soloConsulta ? null : interior;
}

function desenvolver(palabrasIniciales) {
  const entorno = {};
  const otrasPalabras = [];
  const palabrasDeEnvoltorios = [];
  const envoltorios = [];
  let conScript = false;
  let palabras = extraerAsignaciones(palabrasIniciales, entorno, otrasPalabras);

  while (palabras.length > 0 && !palabras[0].dinamico) {
    const [cabeza, ...args] = palabras;
    const nombre = nombreDeComando(cabeza.valor);
    const interior = interiorDeEnvoltorio(nombre, args);
    if (!interior) break;
    envoltorios.push(nombre);
    const delEnvoltorio = [cabeza, ...args.slice(0, args.length - interior.palabras.length)];
    otrasPalabras.push(...delEnvoltorio);
    palabrasDeEnvoltorios.push(...delEnvoltorio);
    conScript ||= interior.opciones.some((opcion) => OPCION_CON_SCRIPT.test(opcion));
    palabras = extraerAsignaciones(interior.palabras, entorno, otrasPalabras);
  }
  return { palabras, entorno, otrasPalabras, palabrasDeEnvoltorios, envoltorios, conScript };
}

class Lector {
  constructor(texto, { profundidad = 0, cwd = null, raizFija = raizSinReasignar(texto) } = {}) {
    this.texto = texto;
    this.profundidad = profundidad;
    this.cwd = cwd;
    this.raizFija = raizFija;
    this.i = 0;
    this.segmentos = [];
    this.heredocsPendientes = [];
  }

  leerTodo() {
    this.leerLista(false);
    if (this.heredocsPendientes.length > 0) {
      throw new ErrorDeAnalisis("heredoc sin cuerpo");
    }
    return this.segmentos;
  }

  leerLista(conCierre, recibePipe = false) {
    let comando = { ...nuevoComando(), recibePipe };
    const cerrar = () => {
      this.cerrarComando(comando);
      comando = nuevoComando();
    };

    for (;;) {
      this.saltarBlancos();
      const caracter = this.texto[this.i];

      if (caracter === undefined) {
        if (conCierre) throw new ErrorDeAnalisis("falta cerrar un paréntesis");
        cerrar();
        return;
      }
      if (caracter === ")") {
        if (!conCierre) throw new ErrorDeAnalisis("paréntesis sin abrir");
        this.i += 1;
        cerrar();
        return;
      }
      if (caracter === "\n") {
        this.i += 1;
        cerrar();
        this.leerCuerposDeHeredoc();
        continue;
      }
      if (caracter === "(") {
        // Pegado a una palabra no abre un subshell: en zsh es un calificador de glob, y `(e:…:)` ejecuta.
        if (!ANTES_DE_SUBSHELL.test(this.texto[this.i - 1] ?? "")) {
          throw new ErrorDeAnalisis("paréntesis pegado a una palabra");
        }
        this.i += 1;
        const subshellRecibePipe = comando.recibePipe;
        cerrar();
        this.conCwdPropio(() => this.leerLista(true, subshellRecibePipe));
        continue;
      }

      const redireccion = this.operadorDeRedireccion();
      if (redireccion) {
        this.leerRedireccion(redireccion, comando);
        continue;
      }

      const control = OPERADORES_DE_CONTROL.find((operador) => this.texto.startsWith(operador, this.i));
      if (control) {
        this.i += control.length;
        cerrar();
        comando.recibePipe = control === "|" || control === "|&";
        continue;
      }

      const palabra = this.leerPalabra();
      const esDescriptor =
        /^\d+$/.test(palabra.valor) && !palabra.entrecomillada && /[<>]/.test(this.texto[this.i] ?? "");
      if (!esDescriptor) comando.palabras.push(palabra);
    }
  }

  conCwdPropio(accion) {
    const cwd = this.cwd;
    accion();
    this.cwd = cwd;
  }

  saltarBlancos() {
    for (;;) {
      const caracter = this.texto[this.i];
      if (caracter === " " || caracter === "\t" || caracter === "\r") {
        this.i += 1;
      } else if (caracter === "\\" && this.texto[this.i + 1] === "\n") {
        this.i += 2;
      } else if (caracter === "#") {
        while (this.i < this.texto.length && this.texto[this.i] !== "\n") this.i += 1;
      } else {
        return;
      }
    }
  }

  operadorDeRedireccion() {
    const operador = OPERADORES_DE_REDIRECCION.find((opcion) => this.texto.startsWith(opcion, this.i));
    if (!operador) return null;
    const esSustitucionDeProceso = this.texto[this.i + 1] === "(" && operador.length === 1;
    return esSustitucionDeProceso ? null : operador;
  }

  leerRedireccion(operador, comando) {
    this.i += operador.length;
    this.saltarBlancos();
    const destino = this.leerPalabra();
    if (destino.valor === "" && !destino.entrecomillada) {
      throw new ErrorDeAnalisis(`redirección ${operador} sin destino`);
    }
    if (operador === "<<" || operador === "<<-") {
      const { valor: delimitador, entrecomillada } = destino;
      this.heredocsPendientes.push({ delimitador, entrecomillada, sinTabs: operador === "<<-", comando });
      return;
    }
    if (operador === "<<<") {
      comando.hereString = destino;
      return;
    }
    const escribe =
      REDIRECCIONES_DE_ESCRITURA.has(operador) || (operador === ">&" && !/^\d+$|^-$/.test(destino.valor));
    comando.redirecciones.push({ operador, destino, escribe });
  }

  leerCuerposDeHeredoc() {
    for (const pendiente of this.heredocsPendientes.splice(0)) {
      const lineas = [];
      for (;;) {
        if (this.i >= this.texto.length) throw new ErrorDeAnalisis("heredoc sin cerrar");
        const fin = this.texto.indexOf("\n", this.i);
        const corte = fin === -1 ? this.texto.length : fin;
        const linea = this.texto.slice(this.i, corte);
        this.i = fin === -1 ? this.texto.length : fin + 1;
        const comparable = pendiente.sinTabs ? linea.replace(/^\t+/, "") : linea;
        if (comparable === pendiente.delimitador) break;
        lineas.push(comparable);
      }
      const cuerpo = lineas.join("\n");
      if (!pendiente.entrecomillada && /\$\(|`/.test(cuerpo)) {
        throw new ErrorDeAnalisis("heredoc sin comillas con sustituciones");
      }
      this.entregarCuerpo(cuerpo, pendiente.comando.segmento);
    }
  }

  // El cuerpo solo importa si alguien lo ejecuta: un shell se analiza, y el código de un
  // intérprete se suma como palabra para que lo revisen las reglas de texto.
  entregarCuerpo(cuerpo, segmento) {
    if (SHELLS.has(segmento?.nombre)) this.analizarAnidado(cuerpo);
    else if (INTERPRETES.test(segmento?.nombre ?? "")) segmento.otrasPalabras.push(nuevaPalabra(cuerpo));
  }

  leerPalabra() {
    const palabra = nuevaPalabra();
    // El esqueleto es la parte sin comillas, con un carácter neutro por cada tramo entrecomillado,
    // escapado o expandido: así una coma entre comillas no se confunde con las llaves del shell.
    const lectura = { esqueleto: "", expansiones: [] };
    for (;;) {
      const caracter = this.texto[this.i];
      if (caracter === undefined || " \t\r\n;|&()".includes(caracter)) break;
      if (caracter === "<" || caracter === ">") {
        if (this.texto[this.i + 1] !== "(") break;
        this.anotarExpansion(palabra, lectura, false, () => {
          palabra.dinamico = true;
          palabra.valor += this.leerSustitucion(2);
        });
      } else if (caracter === "\\") {
        this.leerEscape(palabra);
      } else if (caracter === "'") {
        this.leerComillaSimple(palabra);
      } else if (caracter === '"') {
        this.leerComillaDoble(palabra, lectura);
      } else if (caracter === "$") {
        this.leerDolar(palabra, lectura, false);
      } else if (caracter === "`") {
        this.leerBacktick(palabra, lectura, false);
      } else {
        if ("*?[{".includes(caracter)) palabra.glob = true;
        palabra.valor += caracter;
        this.i += 1;
        lectura.esqueleto += caracter;
        continue;
      }
      lectura.esqueleto += OCULTO;
    }
    palabra.incierta = this.esIncierta(palabra, lectura);
    return palabra;
  }

  anotarExpansion(palabra, lectura, enComillaDoble, leer) {
    const inicio = palabra.valor.length;
    leer();
    lectura.expansiones.push({ alInicio: inicio === 0, enComillaDoble, texto: palabra.valor.slice(inicio) });
  }

  // Incierta: el shell puede partirla en varias palabras o hacerla empezar con `-`. La raíz del
  // proyecto es la excepción, si es la única expansión y nadie la reasigna en el comando.
  esIncierta({ valor }, { esqueleto, expansiones }) {
    const conLlaves = LLAVES_QUE_EXPANDEN.test(esqueleto);
    const soloRaiz = expansiones.length === 1 && /^\$\{?CLAUDE_PROJECT_DIR\}?$/.test(expansiones[0].texto);
    if (this.raizFija && soloRaiz && !conLlaves && RAIZ_DEL_PROYECTO.test(valor)) return false;
    return (
      conLlaves ||
      GLOB_AL_INICIO.test(esqueleto) ||
      expansiones.some(({ alInicio, enComillaDoble }) => alInicio || !enComillaDoble)
    );
  }

  leerEscape(palabra) {
    const siguiente = this.texto[this.i + 1];
    this.i += 2;
    if (siguiente === "\n") return;
    if (siguiente === undefined) throw new ErrorDeAnalisis("barra invertida al final");
    palabra.valor += siguiente;
    palabra.entrecomillada = true;
  }

  leerComillaSimple(palabra) {
    const cierre = this.texto.indexOf("'", this.i + 1);
    if (cierre === -1) throw new ErrorDeAnalisis("comilla simple sin cerrar");
    palabra.valor += this.texto.slice(this.i + 1, cierre);
    palabra.entrecomillada = true;
    this.i = cierre + 1;
  }

  leerComillaDoble(palabra, lectura) {
    palabra.entrecomillada = true;
    this.i += 1;
    for (;;) {
      const caracter = this.texto[this.i];
      if (caracter === undefined) throw new ErrorDeAnalisis("comilla doble sin cerrar");
      if (caracter === '"') {
        this.i += 1;
        return;
      }
      if (caracter === "\\") {
        const siguiente = this.texto[this.i + 1];
        if (siguiente === undefined) throw new ErrorDeAnalisis("comilla doble sin cerrar");
        if (siguiente !== "\n") palabra.valor += '$`"\\'.includes(siguiente) ? siguiente : `\\${siguiente}`;
        this.i += 2;
      } else if (caracter === "$") {
        this.leerDolar(palabra, lectura, true);
      } else if (caracter === "`") {
        this.leerBacktick(palabra, lectura, true);
      } else {
        palabra.valor += caracter;
        this.i += 1;
      }
    }
  }

  leerDolar(palabra, lectura, enComillaDoble) {
    const siguiente = this.texto[this.i + 1];
    if (siguiente === "(") {
      this.anotarExpansion(palabra, lectura, enComillaDoble, () => {
        palabra.dinamico = true;
        palabra.valor += this.leerSustitucion(2);
      });
    } else if (siguiente === "{") {
      this.anotarExpansion(palabra, lectura, enComillaDoble, () => this.leerExpansion(palabra));
    } else if ((siguiente === "'" || siguiente === '"') && !enComillaDoble) {
      throw new ErrorDeAnalisis("comillas con $ no se decodifican");
    } else if (siguiente !== undefined && /[A-Za-z0-9_@*#?$!-]/.test(siguiente)) {
      const nombre = /^[A-Za-z_][A-Za-z0-9_]*/.exec(this.texto.slice(this.i + 1));
      const largo = nombre ? nombre[0].length : 1;
      this.anotarExpansion(palabra, lectura, enComillaDoble, () => {
        palabra.dinamico = true;
        palabra.valor += this.texto.slice(this.i, this.i + 1 + largo);
        this.i += 1 + largo;
      });
    } else if (!enComillaDoble && !FIN_DE_PALABRA.test(siguiente ?? "")) {
      // zsh lee `$=X`, `$~X` y `$^X` como expansiones; bash, como un `$` literal.
      throw new ErrorDeAnalisis(`$${siguiente} sin comillas no se decodifica`);
    } else {
      palabra.valor += "$";
      this.i += 1;
    }
  }

  leerSustitucion(largoApertura) {
    const inicio = this.i;
    const primerSegmento = this.segmentos.length;
    this.i += largoApertura;
    this.conCwdPropio(() => this.leerLista(true));
    for (const segmento of this.segmentos.slice(primerSegmento)) segmento.anidado = true;
    return this.texto.slice(inicio, this.i);
  }

  leerExpansion(palabra) {
    const expansion = /^\$\{[^{}$`()]*\}/.exec(this.texto.slice(this.i));
    if (!expansion) throw new ErrorDeAnalisis("expansión ${...} no trivial");
    palabra.dinamico = true;
    palabra.valor += expansion[0];
    this.i += expansion[0].length;
  }

  leerBacktick(palabra, lectura, enComillaDoble) {
    const cierre = this.texto.indexOf("`", this.i + 1);
    if (cierre === -1) throw new ErrorDeAnalisis("comilla invertida sin cerrar");
    const interior = this.texto.slice(this.i + 1, cierre);
    if (interior.includes("\\")) throw new ErrorDeAnalisis("comilla invertida con escapes");
    this.anotarExpansion(palabra, lectura, enComillaDoble, () => {
      palabra.dinamico = true;
      palabra.valor += this.texto.slice(this.i, cierre + 1);
      this.i = cierre + 1;
    });
    this.analizarAnidado(interior);
  }

  analizarAnidado(texto) {
    if (this.profundidad >= PROFUNDIDAD_MAXIMA) {
      throw new ErrorDeAnalisis("demasiados niveles de comandos anidados");
    }
    const lector = new Lector(texto, { profundidad: this.profundidad + 1, cwd: this.cwd, raizFija: this.raizFija });
    for (const segmento of lector.leerTodo()) {
      segmento.anidado = true;
      this.segmentos.push(segmento);
    }
  }

  cerrarComando(comando) {
    const palabras = sinPalabrasReservadas(comando.palabras);
    if (palabras.length === 0 && comando.redirecciones.length === 0) return;

    const desenvuelto = desenvolver(palabras);
    const [cabeza, ...args] = desenvuelto.palabras;
    const segmento = {
      nombre: cabeza ? nombreDeComando(cabeza.valor) : null,
      palabras: args,
      args: args.map(({ valor }) => valor),
      dinamico: desenvuelto.conScript || (cabeza !== undefined && palabraDeComandoEsDinamica(cabeza)),
      entorno: desenvuelto.entorno,
      otrasPalabras: cabeza ? [...desenvuelto.otrasPalabras, cabeza] : desenvuelto.otrasPalabras,
      palabrasDeEnvoltorios: desenvuelto.palabrasDeEnvoltorios,
      redirecciones: comando.redirecciones,
      envoltorios: desenvuelto.envoltorios,
      cwd: this.cwd,
      recibePipe: comando.recibePipe,
      anidado: false,
    };
    comando.segmento = segmento;

    if (SHELLS.has(segmento.nombre)) this.resolverShell(segmento, comando);
    if (INTERPRETES.test(segmento.nombre ?? "")) this.resolverInterprete(segmento, comando);
    if (segmento.nombre === "eval") this.resolverEval(segmento);
    if (segmento.nombre === "source" || segmento.nombre === ".") {
      segmento.dinamico ||= esScriptDinamico(segmento.palabras[0]);
    }

    this.segmentos.push(segmento);
    this.actualizarCwd(segmento);
  }

  resolverShell(segmento, { hereString }) {
    const { palabras } = segmento;
    const indiceC = palabras.findIndex(({ valor }) => OPCION_C_DE_SHELL.test(valor));
    if (indiceC >= 0) {
      const script = palabras[indiceC + 1];
      if (script) this.analizarAnidado(script.valor);
      segmento.palabras = palabras.filter((palabra) => palabra !== script);
      segmento.args = segmento.palabras.map(({ valor }) => valor);
    } else if (hereString) {
      this.analizarAnidado(hereString.valor);
    } else if (palabras.length > 0) {
      segmento.dinamico ||= esScriptDinamico(palabras[0]) || /^[-+]/.test(palabras[0].valor);
    } else {
      segmento.dinamico ||= segmento.recibePipe || leeDeRedireccion(segmento);
    }
  }

  resolverInterprete(segmento, { hereString }) {
    if (hereString) segmento.otrasPalabras.push(hereString);
    const leeStdin = segmento.args.every((valor) => valor === "-");
    if (leeStdin && (segmento.recibePipe || leeDeRedireccion(segmento))) segmento.dinamico = true;
  }

  resolverEval(segmento) {
    this.analizarAnidado(segmento.args.join(" "));
    segmento.palabras = [];
    segmento.args = [];
  }

  actualizarCwd({ nombre, palabras }) {
    if (nombre !== "cd" && nombre !== "pushd" && nombre !== "popd") return;
    const destino = palabras[0];
    const literal = nombre !== "popd" && palabras.length === 1 && !destino.dinamico && !/^[-~]/.test(destino.valor);
    if (!literal) this.cwd = null;
    else if (path.posix.isAbsolute(destino.valor) || this.cwd !== null) {
      this.cwd = path.posix.resolve(this.cwd ?? "/", destino.valor);
    }
  }
}

/**
 * @param {unknown} texto
 * @param {{ cwd?: string | null }} [opciones]
 */
export function analizarComando(texto, { cwd = null } = {}) {
  if (typeof texto !== "string") return { ok: false, error: "el comando no es texto" };
  try {
    return { ok: true, segmentos: new Lector(texto, { cwd }).leerTodo() };
  } catch (error) {
    if (error instanceof ErrorDeAnalisis) return { ok: false, error: error.message };
    throw error;
  }
}
