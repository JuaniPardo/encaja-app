import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

const HOOK = path.resolve(__dirname, "hook-pre-tool-use.mjs");
const REPO = path.resolve(__dirname, "../..");

function ejecutarHook(entrada: string, { hook = HOOK, env = {} }: { hook?: string; env?: Record<string, string> } = {}) {
  return spawnSync(process.execPath, [hook], {
    input: entrada,
    encoding: "utf8",
    env: { ...process.env, FABRICA_HOOKS_OFF: "", ...env },
  });
}

function usarHerramienta(toolName: string, toolInput: unknown) {
  return ejecutarHook(JSON.stringify({ tool_name: toolName, tool_input: toolInput, cwd: REPO }));
}

function usarBash(command: string) {
  return usarHerramienta("Bash", { command });
}

describe("hook-pre-tool-use", () => {
  const temporales: string[] = [];

  afterEach(() => {
    for (const carpeta of temporales.splice(0)) rmSync(carpeta, { recursive: true, force: true });
  });

  it("imprime deny con el motivo", () => {
    const { status, stdout } = usarBash("supabase db push");
    expect(status).toBe(0);
    const { hookSpecificOutput } = JSON.parse(stdout);
    expect(hookSpecificOutput.hookEventName).toBe("PreToolUse");
    expect(hookSpecificOutput.permissionDecision).toBe("deny");
    expect(hookSpecificOutput.permissionDecisionReason).toContain("supabase-escritura");
  });

  it("imprime ask", () => {
    const { status, stdout } = usarBash("git push");
    expect(status).toBe(0);
    expect(JSON.parse(stdout).hookSpecificOutput.permissionDecision).toBe("ask");
  });

  it("no imprime nada en allow", () => {
    const { status, stdout, stderr } = usarBash("git status --short");
    expect(status).toBe(0);
    expect(stdout).toBe("");
    expect(stderr).toBe("");
  });

  it("niega Read de .env.local con ruta absoluta", () => {
    const { stdout } = usarHerramienta("Read", { file_path: path.join(REPO, ".env.local") });
    expect(JSON.parse(stdout).hookSpecificOutput.permissionDecision).toBe("deny");
  });

  it("deja pasar Read de .env.example con ruta absoluta", () => {
    const { status, stdout } = usarHerramienta("Read", { file_path: path.join(REPO, ".env.example") });
    expect(status).toBe(0);
    expect(stdout).toBe("");
  });

  it("carga el ref desde supabase/.temp, relativo al propio hook", () => {
    const carpeta = mkdtempSync(path.join(tmpdir(), "fabrica-hook-ref-"));
    temporales.push(carpeta);
    const destino = path.join(carpeta, "scripts/fabrica");
    mkdirSync(destino, { recursive: true });
    for (const archivo of ["hook-pre-tool-use.mjs", "politica-herramientas.mjs", "comando-shell.mjs"]) {
      copyFileSync(path.join(__dirname, archivo), path.join(destino, archivo));
    }
    mkdirSync(path.join(carpeta, "supabase/.temp"), { recursive: true });
    writeFileSync(path.join(carpeta, "supabase/.temp/project-ref"), "reffalsodeprueba\n");

    const entrada = JSON.stringify({ tool_name: "Bash", tool_input: { command: "echo reffalsodeprueba" } });
    const { stdout } = ejecutarHook(entrada, { hook: path.join(destino, "hook-pre-tool-use.mjs") });
    expect(JSON.parse(stdout).hookSpecificOutput.permissionDecisionReason).toContain("ref-produccion");
  });

  it.each(["no es json", "", "null", "[]", "{}", '{"tool_name":1}'])("bloquea con código 2 ante la entrada %j", (entrada) => {
    const { status, stdout, stderr } = ejecutarHook(entrada);
    expect(status).toBe(2);
    expect(stdout).toBe("");
    expect(stderr).toContain("bloquea");
  });

  it("bloquea con código 2 si falta la política", () => {
    const carpeta = mkdtempSync(path.join(tmpdir(), "fabrica-hook-"));
    temporales.push(carpeta);
    const hook = path.join(carpeta, "hook-pre-tool-use.mjs");
    copyFileSync(HOOK, hook);

    const { status, stderr } = ejecutarHook(JSON.stringify({ tool_name: "Bash", tool_input: { command: "ls" } }), { hook });
    expect(status).toBe(2);
    expect(stderr).toContain("bloquea");
  });

  it("S6: el comando de settings.json bloquea con código 2 si falta el propio adaptador", () => {
    const settings = JSON.parse(readFileSync(path.join(REPO, ".claude/settings.json"), "utf8"));
    const [{ hooks }] = settings.hooks.PreToolUse;
    expect(hooks[0].onFailure).toBe("block");

    const carpeta = mkdtempSync(path.join(tmpdir(), "fabrica-hook-sin-archivo-"));
    temporales.push(carpeta);
    const { status } = spawnSync("sh", ["-c", hooks[0].command], {
      input: JSON.stringify({ tool_name: "Bash", tool_input: { command: "ls" } }),
      env: { ...process.env, CLAUDE_PROJECT_DIR: carpeta, FABRICA_HOOKS_OFF: "" },
    });
    expect(status).toBe(2);
  });

  it("con FABRICA_HOOKS_OFF=1 en su entorno sale con 0 y avisa", () => {
    const { status, stdout, stderr } = ejecutarHook(
      JSON.stringify({ tool_name: "Bash", tool_input: { command: "supabase db push" } }),
      { env: { FABRICA_HOOKS_OFF: "1" } },
    );
    expect(status).toBe(0);
    expect(stdout).toBe("");
    expect(stderr).toContain("FABRICA_HOOKS_OFF");
  });

  it("FABRICA_HOOKS_OFF con otro valor no desactiva nada", () => {
    const { stdout } = ejecutarHook(
      JSON.stringify({ tool_name: "Bash", tool_input: { command: "supabase db push" } }),
      { env: { FABRICA_HOOKS_OFF: "0" } },
    );
    expect(JSON.parse(stdout).hookSpecificOutput.permissionDecision).toBe("deny");
  });

  function repoTemporal() {
    const carpeta = mkdtempSync(path.join(tmpdir(), "fabrica-hook-git-"));
    temporales.push(carpeta);
    expect(spawnSync("git", ["-C", carpeta, "init", "-q", "-b", "main"]).status).toBe(0);
    return carpeta;
  }

  function mergeEn(cwd: string, env: Record<string, string> = {}) {
    const entrada = JSON.stringify({ tool_name: "Bash", tool_input: { command: "git merge x" }, cwd });
    const { stdout } = ejecutarHook(entrada, { env });
    return stdout === "" ? "allow" : JSON.parse(stdout).hookSpecificOutput.permissionDecision;
  }

  it("detecta el merge a main con la rama real de la carpeta", () => {
    expect(mergeEn(repoTemporal())).toBe("ask");
  });

  it("S9: con HEAD separado real, deja pasar el merge", () => {
    const carpeta = repoTemporal();
    const git = (...args: string[]) => spawnSync("git", ["-C", carpeta, "-c", "user.name=x", "-c", "user.email=x@x", ...args]);
    expect(git("commit", "-q", "--allow-empty", "-m", "x").status).toBe(0);
    expect(git("checkout", "-q", "--detach").status).toBe(0);
    expect(mergeEn(carpeta)).toBe("allow");
  });

  it("S9: si git falla, pregunta en vez de dejar pasar", () => {
    expect(mergeEn(path.join(tmpdir(), "fabrica-carpeta-inexistente"))).toBe("ask");
    expect(mergeEn(repoTemporal(), { PATH: "" })).toBe("ask");
  });

  it("S1: evalúa Monitor como Bash", () => {
    const { stdout } = usarHerramienta("Monitor", { command: "supabase db push" });
    expect(JSON.parse(stdout).hookSpecificOutput.permissionDecision).toBe("deny");
  });
});
