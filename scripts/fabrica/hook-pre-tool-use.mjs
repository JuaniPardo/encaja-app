// Adaptador PreToolUse: traduce la entrada del hook a la política.
// Código de salida 2 bloquea la herramienta. La política se importa dentro del try: si falta
// o está rota, este archivo sale con 2. Lo que pasa antes de este código (node ausente, o este
// mismo archivo borrado o con un error de sintaxis) lo cubre el `|| exit 2` del comando en
// .claude/settings.json.

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

function leerRefsProduccion() {
  const ruta = fileURLToPath(new URL("../../supabase/.temp/project-ref", import.meta.url));
  try {
    const ref = readFileSync(ruta, "utf8").trim();
    return ref ? [ref] : [];
  } catch {
    return [];
  }
}

// Con -q, symbolic-ref sale con 1 y sin mensaje solo en HEAD separado. Cualquier otro
// fallo devuelve null: la rama es desconocida, no vacía.
function ramaDe(ruta) {
  const { status, stdout, stderr, error } = spawnSync("git", ["-C", ruta, "symbolic-ref", "--short", "-q", "HEAD"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 3000,
  });
  if (error) return null;
  if (status === 0) return stdout.trim();
  return status === 1 && stderr === "" ? "" : null;
}

function leerEntrada() {
  const entrada = JSON.parse(readFileSync(0, "utf8"));
  if (typeof entrada?.tool_name !== "string") {
    throw new Error("la entrada del hook no trae tool_name");
  }
  return entrada;
}

async function ejecutar() {
  if (process.env.FABRICA_HOOKS_OFF === "1") {
    process.stderr.write("Fábrica: hooks desactivados por FABRICA_HOOKS_OFF=1.\n");
    return;
  }

  const { decidirHerramienta } = await import("./politica-herramientas.mjs");
  const entrada = leerEntrada();
  const { decision, regla, motivo } = decidirHerramienta({
    toolName: entrada.tool_name,
    toolInput: entrada.tool_input,
    contexto: { refsProduccion: leerRefsProduccion(), cwd: entrada.cwd, ramaDe },
  });
  if (decision === "allow") return;

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: decision,
        permissionDecisionReason: `[fábrica:${regla}] ${motivo}`,
      },
    }),
  );
}

try {
  await ejecutar();
} catch (error) {
  process.stderr.write(`Fábrica: el hook falló y bloquea la herramienta: ${error?.message ?? error}\n`);
  process.exitCode = 2;
}
