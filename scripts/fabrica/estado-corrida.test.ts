import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { avanzar, clasificar, iniciar, leerEstado, rerevisionCompleta, revisoresPara, ver } from "./estado-corrida.mjs";

const SCRIPT = path.resolve(__dirname, "estado-corrida.mjs");
const SKILL = path.resolve(__dirname, "../../.claude/skills/fabrica/SKILL.md");
const TODOS = ["fabrica-tester", "fabrica-clean-code", "fabrica-seguridad"];
const DATOS = { chg: "CHG-2026-11-999", slug: "prueba", rama: "feature/prueba", worktree: "/tmp/wt" };
const ALTO = { tamano: "L", riesgo: "alto" };

type Veredicto = "APROBADO" | "CAMBIOS" | "BLOQUEADO";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "fabrica-estado-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function escribir(ciclo: number, archivo: string, contenido: string) {
  mkdirSync(path.join(dir, `ciclo-${ciclo}`), { recursive: true });
  writeFileSync(path.join(dir, `ciclo-${ciclo}`, archivo), contenido);
}

function informe(veredicto: Veredicto) {
  return `## Alcance revisado\nTodo.\n\n## Hallazgos\nNinguno.\n\nVEREDICTO: ${veredicto}\n`;
}

function implementar(ciclo: number) {
  escribir(ciclo, "implementacion.md", "## Cambios\n- algo\n");
}

function informes(ciclo: number, veredictos: Record<string, Veredicto>) {
  for (const [revisor, veredicto] of Object.entries(veredictos)) escribir(ciclo, `${revisor}.md`, informe(veredicto));
}

function todos(ciclo: number, veredicto: Veredicto = "APROBADO") {
  informes(ciclo, Object.fromEntries(TODOS.map((revisor) => [revisor, veredicto])));
}

function testerPideCambios(ciclo: number) {
  informes(ciclo, { "fabrica-tester": "CAMBIOS", "fabrica-clean-code": "APROBADO", "fabrica-seguridad": "APROBADO" });
}

function a(destino: string, respuestaUsuario?: string) {
  return avanzar(dir, { destino, respuestaUsuario });
}

function hastaRevisar(clasificacion: { tamano: string; riesgo: string; ui?: boolean } = ALTO) {
  iniciar(dir, DATOS);
  clasificar(dir, clasificacion);
  a("implementar");
  implementar(0);
  a("revisar");
}

function hastaSegundaRevision() {
  hastaRevisar();
  testerPideCambios(0);
  a("corregir");
  implementar(1);
  a("revisar");
}

function hastaDiagnostico() {
  hastaSegundaRevision();
  testerPideCambios(1);
  a("diagnosticar");
}

function hastaTerceraRevision() {
  hastaDiagnostico();
  escribir(1, "fabrica-diagnostico.md", informe("CAMBIOS"));
  a("corregir");
  implementar(2);
  a("revisar");
}

function llevarA(etapa: string) {
  if (etapa === "planificar") {
    iniciar(dir, DATOS);
    clasificar(dir, { tamano: "S", riesgo: "bajo" });
  } else if (etapa === "implementar") {
    llevarA("planificar");
    a("implementar");
  } else if (etapa === "revisar") {
    hastaRevisar();
  } else if (etapa === "diagnosticar") {
    hastaDiagnostico();
  } else if (etapa === "corregir") {
    hastaRevisar();
    testerPideCambios(0);
    a("corregir");
  } else {
    hastaRevisar();
    todos(0);
    a("entregar");
  }
}

describe("revisoresPara", () => {
  it.each([
    ["S", "bajo", ["fabrica-tester"]],
    ["M", "bajo", ["fabrica-tester", "fabrica-clean-code"]],
    ["L", "bajo", TODOS],
    ["S", "alto", TODOS],
    ["M", "alto", TODOS],
    ["L", "alto", TODOS],
  ])("%s, %s", (tamano, riesgo, esperado) => {
    expect(revisoresPara({ tamano, riesgo })).toEqual(esperado);
    expect(revisoresPara({ tamano, riesgo, ui: true })).toEqual([...esperado, "fabrica-ui"]);
  });

  it("rechaza valores desconocidos", () => {
    expect(() => revisoresPara({ tamano: "XL", riesgo: "bajo" })).toThrow();
    expect(() => revisoresPara({ tamano: "S", riesgo: "medio" })).toThrow();
  });
});

describe("sincronía con la skill", () => {
  const skill = readFileSync(SKILL, "utf8");
  const filas = skill
    .split("\n")
    .filter((linea) => /^\| (S|M|L|S, M o L), (bajo|alto) \|/.test(linea))
    .map((linea) => linea.split("|").map((celda) => celda.trim()).slice(1, 4));

  it("la tabla cubre todas las combinaciones y coincide con revisoresPara y rerevisionCompleta", () => {
    expect(filas.map(([combinacion]) => combinacion)).toEqual(["S, bajo", "M, bajo", "L, bajo", "S, M o L, alto"]);
    for (const [combinacion, revisores, rerevision] of filas) {
      const [tamanos, riesgo] = combinacion.split(/, (?=bajo|alto)/);
      for (const tamano of tamanos.split(/, | o /)) {
        const esperados = revisoresPara({ tamano, riesgo }).map((revisor: string) => revisor.replace("fabrica-", ""));
        expect(revisores.split(", ")).toEqual(esperados);
        expect(rerevision).toBe(rerevisionCompleta({ tamano, riesgo }) ? "todos" : "tester + quien no aprobó");
      }
    }
  });

  it("no documenta git merge con -F", () => {
    expect(skill).not.toContain("merge -F");
  });
});

describe("iniciar", () => {
  it("crea el estado inicial y la carpeta, sin temporales", () => {
    const anidada = path.join(dir, "uno/dos");
    iniciar(anidada, DATOS);
    expect(leerEstado(anidada)).toMatchObject({ version: 1, ...DATOS, etapa: "planificar", correcciones: 0, ciclo: 0 });
    expect(readdirSync(anidada)).toEqual(["estado.json"]);
  });

  it("no pisa una corrida existente", () => {
    iniciar(dir, DATOS);
    expect(() => iniciar(dir, DATOS)).toThrow(/ya existe/);
  });

  it("S7: tras borrar estado.json, no reinicia el tope sin --reabrir, y al reabrir sigue el número de ciclo", () => {
    hastaSegundaRevision();
    rmSync(path.join(dir, "estado.json"));
    expect(() => iniciar(dir, DATOS)).toThrow(/--reabrir/);
    expect(iniciar(dir, { ...DATOS, reabrir: true })).toMatchObject({ ciclo: 2, correcciones: 0 });
  });
});

describe("clasificar", () => {
  beforeEach(() => {
    iniciar(dir, DATOS);
  });

  it("guarda la clasificación y los revisores, y admite subir", () => {
    const estado = clasificar(dir, { tamano: "M", riesgo: "bajo", financiero: true });
    expect(estado.clasificacion).toEqual({ tamano: "M", riesgo: "bajo", ui: false, financiero: true });
    expect(estado.revisoresDelCiclo).toEqual(["fabrica-tester", "fabrica-clean-code"]);
    expect(clasificar(dir, { ...ALTO, ui: true, financiero: true }).revisoresDelCiclo).toEqual([...TODOS, "fabrica-ui"]);
  });

  it.each([
    [{ tamano: "M", riesgo: "bajo" }, { tamano: "S", riesgo: "bajo" }],
    [{ tamano: "S", riesgo: "alto" }, { tamano: "S", riesgo: "bajo" }],
    [{ tamano: "S", riesgo: "bajo", ui: true }, { tamano: "S", riesgo: "bajo" }],
    [{ tamano: "S", riesgo: "bajo", financiero: true }, { tamano: "S", riesgo: "bajo" }],
  ])("no admite bajar de %j a %j", (inicial, nueva) => {
    clasificar(dir, inicial);
    expect(() => clasificar(dir, nueva)).toThrow(/solo puede subir/);
    expect(leerEstado(dir).clasificacion).toMatchObject(inicial);
  });

  it("rechaza valores inválidos y una corrida cerrada", () => {
    expect(() => clasificar(dir, { tamano: "XL", riesgo: "bajo" })).toThrow();
    a("ayuda");
    a("cerrado");
    expect(() => clasificar(dir, { tamano: "S", riesgo: "bajo" })).toThrow(/cerrada/);
  });
});

describe("avanzar: camino completo", () => {
  it("planificar a cerrado sin correcciones, con historial", () => {
    hastaRevisar();
    todos(0);
    a("entregar");
    expect(a("cerrado")).toMatchObject({ etapa: "cerrado", correcciones: 0, ciclo: 0 });
    expect(leerEstado(dir).historial.map(({ etapa }: { etapa: string }) => etapa)).toEqual([
      "planificar",
      "implementar",
      "revisar",
      "entregar",
      "cerrado",
    ]);
  });

  it("dos correcciones, con diagnóstico antes de la segunda, y entrega", () => {
    hastaRevisar();
    testerPideCambios(0);
    expect(a("corregir")).toMatchObject({ correcciones: 1, ciclo: 1 });
    implementar(1);
    a("revisar");
    testerPideCambios(1);
    expect(a("diagnosticar")).toMatchObject({ correcciones: 1, ciclo: 1 });
    escribir(1, "fabrica-diagnostico.md", informe("CAMBIOS"));
    expect(a("corregir")).toMatchObject({ correcciones: 2, ciclo: 2 });
    implementar(2);
    a("revisar");
    todos(2);
    expect(a("entregar").etapa).toBe("entregar");
  });
});

describe("avanzar: transiciones inválidas", () => {
  const CASOS: [string, string[]][] = [
    ["planificar", ["revisar", "diagnosticar", "corregir", "entregar", "cerrado", "planificar"]],
    ["implementar", ["planificar", "diagnosticar", "corregir", "entregar", "cerrado", "implementar"]],
    ["revisar", ["planificar", "implementar", "cerrado", "revisar"]],
    ["diagnosticar", ["planificar", "implementar", "revisar", "entregar", "cerrado", "diagnosticar"]],
    ["corregir", ["planificar", "implementar", "diagnosticar", "entregar", "cerrado", "corregir"]],
    ["entregar", ["planificar", "implementar", "revisar", "diagnosticar", "corregir", "entregar"]],
  ];

  it.each(CASOS)("desde %s rechaza %j y puede ir a ayuda", (desde, destinos) => {
    llevarA(desde);
    for (const destino of destinos) {
      expect(() => a(destino)).toThrow(/Transición inválida/);
      expect(leerEstado(dir).etapa).toBe(desde);
    }
    expect(a("ayuda").etapa).toBe("ayuda");
  });

  it("cerrado no sale a ningún lado, ni siquiera a ayuda", () => {
    iniciar(dir, DATOS);
    a("ayuda");
    a("cerrado");
    for (const destino of ["planificar", "ayuda", "entregar", "cerrado"]) {
      expect(() => a(destino)).toThrow(/Transición inválida/);
    }
  });

  it("rechaza una etapa desconocida y exige clasificación para implementar", () => {
    iniciar(dir, DATOS);
    expect(() => a("publicar")).toThrow(/desconocida/);
    expect(() => a("implementar")).toThrow(/clasificar/);
  });
});

describe("avanzar: tope y diagnóstico", () => {
  it("con una corrección usada exige diagnosticar, y sin correcciones no lo permite", () => {
    hastaSegundaRevision();
    testerPideCambios(1);
    expect(() => a("corregir")).toThrow(/diagnosticar/);
    rmSync(dir, { recursive: true });
    hastaRevisar();
    testerPideCambios(0);
    expect(() => a("diagnosticar")).toThrow(/segunda corrección/);
  });

  it.each(["corregir", "diagnosticar"])("impide una tercera corrección por %s", (destino) => {
    hastaTerceraRevision();
    testerPideCambios(2);
    expect(() => a(destino)).toThrow(/ayuda/);
    expect(leerEstado(dir)).toMatchObject({ etapa: "revisar", correcciones: 2 });
  });

  it.each([
    [null, /Falta el informe/],
    ["BLOQUEADO", /ayuda/],
    ["APROBADO", /CAMBIOS/],
  ] as const)("no corrige con diagnóstico %s", (veredicto, error) => {
    hastaDiagnostico();
    if (veredicto) escribir(1, "fabrica-diagnostico.md", informe(veredicto));
    expect(() => a("corregir")).toThrow(error);
  });
});

describe("avanzar: informes", () => {
  it("implementar y corregir exigen implementacion.md completo de su ciclo", () => {
    llevarA("implementar");
    expect(() => a("revisar")).toThrow(/Falta/);
    escribir(0, "implementacion.md", "Todo listo.\n");
    expect(() => a("revisar")).toThrow(/## Cambios/);
    rmSync(dir, { recursive: true });
    llevarA("corregir");
    expect(() => a("revisar")).toThrow(/Falta/);
  });

  it.each([
    ["", /Falta el informe/],
    ["Sin problemas.\n\nVEREDICTO: APROBADO\n", /## Hallazgos/],
    ["## Hallazgos\nNinguno.\n", /VEREDICTO/],
    ["## Hallazgos\nVEREDICTO: APROBADO\nDespués sigue texto.\n", /VEREDICTO/],
    ["## Hallazgos\nVEREDICTO: APROBADO.\n", /VEREDICTO/],
    ["## Hallazgos\n**VEREDICTO: APROBADO**\n", /VEREDICTO/],
    ["## Hallazgos\nveredicto: aprobado\n", /VEREDICTO/],
  ])("rechaza el informe de seguridad %j", (contenido, error) => {
    hastaRevisar();
    informes(0, { "fabrica-tester": "APROBADO", "fabrica-clean-code": "APROBADO" });
    if (contenido) escribir(0, "fabrica-seguridad.md", contenido);
    expect(() => a("entregar")).toThrow(error);
  });

  it.each([
    ["entregar", { "fabrica-tester": "CAMBIOS" }, /fabrica-tester/],
    ["corregir", { "fabrica-tester": "CAMBIOS", "fabrica-clean-code": "BLOQUEADO" }, /BLOQUEADO/],
    ["corregir", {}, /CAMBIOS/],
  ] as const)("no avanza a %s con %j", (destino, veredictos, error) => {
    hastaRevisar();
    todos(0);
    informes(0, veredictos);
    expect(() => a(destino)).toThrow(error);
  });

  it("solo exige los informes de los revisores del ciclo", () => {
    hastaRevisar({ tamano: "S", riesgo: "bajo" });
    informes(0, { "fabrica-tester": "APROBADO" });
    expect(a("entregar").etapa).toBe("entregar");
  });
});

describe("re-revisión", () => {
  it.each([
    [ALTO, { "fabrica-tester": "CAMBIOS", "fabrica-clean-code": "APROBADO", "fabrica-seguridad": "APROBADO" }, TODOS],
    [{ tamano: "L", riesgo: "bajo" }, { "fabrica-tester": "CAMBIOS", "fabrica-clean-code": "APROBADO", "fabrica-seguridad": "APROBADO" }, TODOS],
    [{ tamano: "M", riesgo: "bajo" }, { "fabrica-tester": "APROBADO", "fabrica-clean-code": "CAMBIOS" }, ["fabrica-tester", "fabrica-clean-code"]],
    [{ tamano: "M", riesgo: "bajo", ui: true }, { "fabrica-tester": "CAMBIOS", "fabrica-clean-code": "APROBADO", "fabrica-ui": "APROBADO" }, ["fabrica-tester"]],
  ] as const)("%j: revisan %j → %j", (clasificacion, veredictos, esperados) => {
    hastaRevisar(clasificacion);
    informes(0, veredictos);
    a("corregir");
    implementar(1);
    expect(a("revisar").revisoresDelCiclo).toEqual(esperados);
  });

  it("si la clasificación sube durante la corrección, repiten todos los de la nueva lista", () => {
    hastaRevisar({ tamano: "M", riesgo: "bajo" });
    informes(0, { "fabrica-tester": "CAMBIOS", "fabrica-clean-code": "APROBADO" });
    a("corregir");
    clasificar(dir, ALTO);
    implementar(1);
    expect(a("revisar").revisoresDelCiclo).toEqual(TODOS);
  });

  it("conserva la re-revisión reducida si la clasificación se repite igual", () => {
    hastaRevisar({ tamano: "M", riesgo: "bajo" });
    informes(0, { "fabrica-tester": "APROBADO", "fabrica-clean-code": "CAMBIOS" });
    a("corregir");
    implementar(1);
    a("revisar");
    expect(clasificar(dir, { tamano: "M", riesgo: "bajo" }).revisoresDelCiclo).toEqual(["fabrica-tester", "fabrica-clean-code"]);
  });
});

describe("ayuda", () => {
  it.each(["planificar", "implementar", "revisar", "corregir", "entregar"])("ir a %s requiere respuesta", (destino) => {
    hastaRevisar();
    a("ayuda");
    expect(() => a(destino)).toThrow(/--respuesta-usuario/);
    expect(() => a(destino, "")).toThrow(/--respuesta-usuario/);
    expect(leerEstado(dir).etapa).toBe("ayuda");
  });

  it("no vuelve a diagnosticar ni a ayuda, y puede cerrar sin respuesta", () => {
    hastaRevisar();
    a("ayuda");
    expect(() => a("diagnosticar", "seguí")).toThrow(/Transición inválida/);
    expect(() => a("ayuda", "seguí")).toThrow(/Transición inválida/);
    expect(a("cerrado").etapa).toBe("cerrado");
  });

  it("reinicia las correcciones, abre un ciclo nuevo y guarda la respuesta", () => {
    hastaTerceraRevision();
    testerPideCambios(2);
    a("ayuda");
    const estado = a("corregir", "probá otro enfoque");
    expect(estado).toMatchObject({ etapa: "corregir", correcciones: 1, ciclo: 3 });
    expect(estado.historial.at(-1)).toMatchObject({ respuestaUsuario: "probá otro enfoque" });
  });

  it.each(["implementar", "revisar", "planificar"])("S8: salir hacia %s abre un ciclo nuevo", (destino) => {
    hastaSegundaRevision();
    a("ayuda");
    expect(a(destino, "seguí")).toMatchObject({ correcciones: 0, ciclo: 2 });
  });

  it("S8: los informes aprobados de un ciclo viejo no sirven para entregar código nuevo", () => {
    hastaRevisar();
    todos(0);
    a("entregar");
    a("ayuda");
    a("implementar", "agregá esto");
    implementar(1);
    a("revisar");
    expect(() => a("entregar")).toThrow(/Falta el informe/);
  });

  it("S7: ayuda → entregar exige las aprobaciones del ciclo vigente", () => {
    hastaRevisar();
    a("ayuda");
    expect(() => a("entregar", "entregá así")).toThrow(/Falta el informe/);
    todos(0);
    expect(a("entregar", "entregá así").etapa).toBe("entregar");
  });

  it("S7: sin revisores en el ciclo no se entrega desde ayuda", () => {
    llevarA("implementar");
    a("ayuda");
    a("implementar", "seguí");
    a("ayuda");
    expect(() => a("entregar", "entregá")).toThrow(/revisores/);
  });

  it("exige clasificación para volver a etapas posteriores a planificar", () => {
    iniciar(dir, DATOS);
    a("ayuda");
    expect(() => a("revisar", "seguí")).toThrow(/clasificar/);
    expect(a("planificar", "replanificá").etapa).toBe("planificar");
  });
});

describe("persistencia y ver", () => {
  it("el contador sobrevive entre lecturas y ver indica dónde retomar", () => {
    hastaSegundaRevision();
    expect(JSON.parse(readFileSync(path.join(dir, "estado.json"), "utf8"))).toMatchObject({ correcciones: 1, ciclo: 1 });
    expect(ver(dir)).toMatchObject({
      chg: DATOS.chg,
      etapa: "revisar",
      ciclo: 1,
      correcciones: 1,
      revisoresDelCiclo: TODOS,
      carpetaDelCiclo: path.join(dir, "ciclo-1"),
      retomar: expect.stringContaining("revisores"),
    });
  });

  it.each([
    ["{ roto", /JSON válido/],
    [JSON.stringify({ version: 99 }), /formato/],
  ])("rechaza un estado inválido: %s", (contenido, error) => {
    writeFileSync(path.join(dir, "estado.json"), contenido);
    expect(() => ver(dir)).toThrow(error);
  });

  it.each(["correcciones", "ciclo"])("S7: rechaza %s negativo", (campo) => {
    iniciar(dir, DATOS);
    const estado = JSON.parse(readFileSync(path.join(dir, "estado.json"), "utf8"));
    writeFileSync(path.join(dir, "estado.json"), JSON.stringify({ ...estado, [campo]: -5 }));
    expect(() => ver(dir)).toThrow(/formato/);
  });

  it("rechaza una corrida inexistente", () => {
    expect(() => ver(dir)).toThrow(/iniciar/);
  });
});

describe("CLI", () => {
  function cli(...args: string[]) {
    return spawnSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8" });
  }

  const iniciarArgs = ["iniciar", "--chg", DATOS.chg, "--slug", DATOS.slug, "--rama", DATOS.rama, "--worktree", DATOS.worktree];

  it("recorre una corrida y sale con 0", () => {
    expect(cli(...iniciarArgs, "--dir", dir).status).toBe(0);
    expect(cli("clasificar", "--dir", dir, "--tamano", "S", "--riesgo", "bajo", "--ui", "--financiero").status).toBe(0);
    expect(cli("avanzar", "--dir", dir, "--a", "ayuda").status).toBe(0);
    expect(cli("avanzar", "--dir", dir, "--a", "implementar", "--respuesta-usuario", "dale").status).toBe(0);

    const { status, stdout } = cli("ver", "--dir", dir);
    expect(status).toBe(0);
    expect(JSON.parse(stdout)).toMatchObject({
      etapa: "implementar",
      clasificacion: { tamano: "S", riesgo: "bajo", ui: true, financiero: true },
    });
  });

  it("sale con 1 si se viola una regla, sin tocar el estado", () => {
    cli(...iniciarArgs, "--dir", dir);
    const antes = readFileSync(path.join(dir, "estado.json"), "utf8");
    const { status, stderr } = cli("avanzar", "--dir", dir, "--a", "entregar");
    expect(status).toBe(1);
    expect(stderr).toContain("Transición inválida");
    expect(readFileSync(path.join(dir, "estado.json"), "utf8")).toBe(antes);
  });

  it("acepta --reabrir y sale con 1 sin ella sobre una carpeta con ciclos", () => {
    mkdirSync(path.join(dir, "ciclo-0"));
    expect(cli(...iniciarArgs, "--dir", dir).status).toBe(1);
    expect(cli(...iniciarArgs, "--dir", dir, "--reabrir").status).toBe(0);
  });

  it.each([
    [[]],
    [["desconocido", "--dir", "/tmp/x"]],
    [["ver"]],
    [["ver", "--dir", "/tmp/x", "--opcion-rara"]],
    [["iniciar", "--dir", "/tmp/x"]],
    [["clasificar", "--dir", "/tmp/x", "--tamano", "S"]],
    [["avanzar", "--dir", "/tmp/x"]],
  ])("sale con 2 ante un uso incorrecto: %j", (args) => {
    const { status, stderr } = cli(...args);
    expect(status).toBe(2);
    expect(stderr).not.toBe("");
  });

  it("sale con 2 ante una etapa o una clasificación desconocida, y con 1 sin corrida", () => {
    expect(cli("ver", "--dir", dir).status).toBe(1);
    cli(...iniciarArgs, "--dir", dir);
    expect(cli("avanzar", "--dir", dir, "--a", "publicar").status).toBe(2);
    expect(cli("clasificar", "--dir", dir, "--tamano", "XL", "--riesgo", "bajo").status).toBe(2);
  });
});
