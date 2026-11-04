import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { decidirHerramienta } from "./politica-herramientas.mjs";

const SETTINGS = path.resolve(__dirname, "../../.claude/settings.json");
const { permissions } = JSON.parse(readFileSync(SETTINGS, "utf8")) as { permissions: { allow: string[] } };
const CHG = "CHG-2026-11-008";
const PLACEHOLDERS =
  "NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=placeholder NEXT_TELEMETRY_DISABLED=1";

// Sin `*`, una regla de Claude Code solo cubre el texto idéntico (fabrica-controles.md §3).
function cubre(regla: string, comando: string) {
  return regla === `Bash(${comando})`;
}

function decision(command: string, rama = "feature/x") {
  return decidirHerramienta({
    toolName: "Bash",
    toolInput: { command },
    contexto: { refsProduccion: ["abcdefghijklmnopqrst"], cwd: "/repo", ramaDe: () => rama },
  });
}

// Lo que pasa de verdad: el deny o ask del hook manda; si el hook deja pasar y ninguna regla
// cubre el comando, Claude Code pregunta.
function decisionEfectiva(command: string) {
  const delHook = decision(command).decision;
  if (delHook !== "allow") return delHook;
  return permissions.allow.some((regla) => cubre(regla, command)) ? "allow" : "ask";
}

// Exactamente lo que está en permissions.allow, en el mismo orden.
const USO_DIARIO = [
  "npm run lint",
  "npm run typecheck",
  "npm test",
  "npm run test",
  "npx tsc --noEmit",
  `${PLACEHOLDERS} npm run build`,
  "npm ci",
  "npm ci --prefer-offline --no-audit --no-fund",
  "npm audit --omit=dev",
  "git fetch origin",
  "git branch --show-current",
  "git rev-parse --show-toplevel",
  "git status",
  "git status --short",
  "git diff",
  "git diff --stat",
  "git diff HEAD",
  "git log --oneline -10",
  "git stash list",
];

// El hook los deja pasar y ninguna regla los cubre: Claude Code pregunta. Incluye lo que tuvo
// una regla con `*`, que el hook no puede proteger porque no reproduce la expansión del shell.
const VUELVEN_A_PREGUNTAR = [
  "npm test -- scripts/fabrica",
  "npm run test -- src/lib/money.test.ts",
  "npx vitest run scripts/fabrica",
  "npx eslint scripts/fabrica",
  "git status -- src",
  "git diff HEAD~1",
  "git log --oneline -5",
  "git show HEAD --stat",
  "git show HEAD@{1}",
  "git log @{u}..HEAD",
  "git stash list stash@{0}",
  "git rev-parse --abbrev-ref HEAD",
  "git ls-tree --name-only origin/develop docs/03-history/changes/",
  "git ls-files scripts",
  "git add -A",
  `git commit -m "feat: algo" -m "Change-Id: ${CHG}"`,
  `git commit -F - <<'EOF'\nfeat: algo\n\nChange-Id: ${CHG}\nEOF`,
  "node scripts/fabrica/estado-corrida.mjs ver --dir .claude/fabrica/runs/x",
  'node "$CLAUDE_PROJECT_DIR/scripts/fabrica/estado-corrida.mjs" ver --dir "$CLAUDE_PROJECT_DIR/.claude/fabrica/runs/x"',
  'node "${CLAUDE_PROJECT_DIR}/scripts/fabrica/estado-corrida.mjs" ver --dir .claude/fabrica/runs/x',
  'PATH="/usr/local/bin:/opt/homebrew/bin:$PATH" npm test',
  "ls -la scripts/fabrica",
  "ls src/*",
  "cat docs/README.md",
  "cat docs/*.md",
  "head -n 20 src/proxy.ts",
  "tail -n 20 src/proxy.ts",
  "wc -l scripts/fabrica/comando-shell.mjs",
  "diff a.txt b.txt",
  `git merge --no-ff feature/x -m "Merge feature/x into develop" -m "Change-Id: ${CHG}"`,
  "git worktree add -b feature/x .claude/worktrees/CHG-x origin/develop",
  "git worktree remove .claude/worktrees/CHG-x",
  "git switch feature/x",
  "git checkout -b feature/x",
  "grep -rn process.env src",
  "find src -name '*.test.ts'",
  "sed -n '1,20p' src/proxy.ts",
  "git fetch origin main",
  "git branch -a",
];

// El hook pregunta por su cuenta: el shell puede convertir un argumento en otra palabra.
const ARGUMENTOS_ARMADOS = [
  `git commit -m "$(cat <<'EOF'\nfeat: algo\n\nChange-Id: ${CHG}\nEOF\n)"`,
  "git diff $(git merge-base HEAD origin/develop)",
  "cat $(git ls-files src)",
  "npm test -- {a,b}.test.ts",
  "ls {src,docs}",
  "ls *",
  "for f in a b; do wc -l $f; done",
  'CLAUDE_PROJECT_DIR=/tmp/x; node "$CLAUDE_PROJECT_DIR/scripts/fabrica/estado-corrida.mjs" ver',
  'export CLAUDE_PROJECT_DIR=/tmp/x && node "$CLAUDE_PROJECT_DIR/scripts/fabrica/estado-corrida.mjs" ver',
  'CLAUDE_PROJECT_DIR=/tmp/x node "$CLAUDE_PROJECT_DIR/scripts/fabrica/estado-corrida.mjs" ver',
];

const FUERA_DE_ALLOW = [
  "git push",
  "git push --force origin main",
  "git push origin HEAD:develop",
  "git tag v1.0.0",
  "git stash drop",
  "gh pr merge 1",
  "gh api -X DELETE repos/o/r",
  "vercel --prod",
  "supabase db push",
  "/tmp/supabase-cli/supabase db push",
  "rm -rf node_modules",
  "mv a b",
  "curl https://encaja-app.vercel.app/",
  "npm publish",
  "npm install left-pad",
  "npm run dev",
  "npm run build",
  "npm audit fix --force",
  "npm ci --dry-run",
  "npx supabase db push",
  "npx tsc --outDir /tmp/x",
  "npm test --node-options=x",
  "npm run lint -- --fix",
  "npm run typecheck -- --generateCpuProfile x",
  "node -e 'process.exit(0)'",
  "git checkout -- .",
  "git branch -D main",
  "git merge main",
];

// Comandos que ejecutan otro comando, escriben fuera del árbol, mueven ramas protegidas o leen
// secretos. Ninguno puede quedar en allow: el hook pregunta o niega, o ninguna regla lo cubre.
const PELIGROSOS = [
  "git fetch --upload-pack='supabase db push; git-upload-pack' .",
  "git fetch -u 'touch x; git-upload-pack' .",
  "git diff --output=.claude/settings.json HEAD",
  "git log --output=scripts/fabrica/hook-pre-tool-use.mjs -1",
  "git show --output=x HEAD",
  "sed -n 's/a/b/gw .claude/settings.json' x",
  "sed -n '1wout' x",
  "sed -n 's/x/y/ge' x",
  "git checkout -B main HEAD~5",
  "git switch -C main HEAD~5",
  "git worktree add -B develop /tmp/x HEAD~5",
  "git fetch origin +develop:main",
  "git checkout -- src",
  "git restore -- '*.ts'",
  "git switch --detach v1.8.0",
  "grep -rh '' --include='*.local' .",
  "git -c core.pager='supabase db push' log",
  "GIT_EXTERNAL_DIFF='supabase db push' git diff",
  "find . -exec rm {} ;",
  "npm test --script-shell=/tmp/x.sh",
  "npm test --prefix /tmp/otro",
  "npx eslint --cache --cache-location .claude/settings.json src",
  "npx vitest --config /tmp/x.ts",
  "npm test -- --poolOptions.forks.execArgv=--import=data:text/javascript,x --poolOptions.forks.execArgv=x",
  `git stash list -m --output=/repo/.git/config --format='[core]%n%x09fsmonitor = "supabase db push; false"'`,
  `git log -1 --format='tformat:[core]%n%x09fsmonitor = "touch x; false"' "--$(git log -1 --format=tformat:output)=/Users/x/.gitconfig"`,
  "git log -1 --format='tformat:{}' --*/*",
  "git log -1 ''*/*",
  "ls src(e:'supabase db push':)",
  "X=--output=.claude/settings.json; git log -1 $=X",
  'node "$CLAUDE_PROJECT_DIR/scripts/fabrica/estado-corrida.mjs" ver "--$(git log -1 --format=tformat:reabrir)"',
  'cat ".e$(echo nv).local"',
];

// El hook frena estas variantes por su cuenta. Es una defensa adicional: ninguna depende ya de
// él, porque allow no tiene reglas con argumentos libres.
const VARIANTES_PELIGROSAS: [string, string][] = [
  ["git diff --output=x HEAD", "git-escribe-archivo"],
  ["git diff --output x HEAD", "git-escribe-archivo"],
  ["git log --output-directory=x", "git-escribe-archivo"],
  ["git stash list --output=x", "git-escribe-archivo"],
  ["git stash list -m --output=x", "git-escribe-archivo"],
  ["git stash list -m --output x", "git-escribe-archivo"],
  ["git show --out=x HEAD", "git-escribe-archivo"],
  ["git -c diff.external=x diff", "configuracion-en-linea"],
  ["git --config-env=core.pager=X log", "configuracion-en-linea"],
  ["git --exec-path=/tmp/x status", "configuracion-en-linea"],
  ["GIT_EXTERNAL_DIFF=x git diff", "configuracion-en-linea"],
  ["GIT_PAGER=x git log", "configuracion-en-linea"],
  ["PAGER=x git show", "configuracion-en-linea"],
  ["EDITOR=x git commit", "configuracion-en-linea"],
  ["VISUAL=x git commit", "configuracion-en-linea"],
  ["env GIT_SSH_COMMAND=x git status", "configuracion-en-linea"],
  ["export GIT_PAGER=x; git log", "configuracion-en-linea"],
  ["npx eslint -o .claude/settings.json src", "autoproteccion"],
  ["npx vitest run --outputFile=scripts/fabrica/x.mjs", "autoproteccion"],
  ["npm run lint -- --output-file .claude/settings.json", "autoproteccion"],
  ["npm test --node-options=--import=data:text/javascript,x", "chequeo-con-opciones"],
  ["npm test --script-shell=/tmp/x.sh", "chequeo-con-opciones"],
  ["npm test --prefix /tmp/otro", "chequeo-con-opciones"],
  ["npm test --userconfig /tmp/npmrc", "chequeo-con-opciones"],
  ["npm run test --node-options=x -- a", "chequeo-con-opciones"],
  ["npm test -- --poolOptions.forks.execArgv=x", "chequeo-con-opciones"],
  ["npm run test -- --globalSetup=/tmp/x.ts", "chequeo-con-opciones"],
  ["npx vitest run --poolOptions.forks.execArgv=x", "chequeo-con-opciones"],
  ["npx vitest --config /tmp/x.ts", "chequeo-con-opciones"],
  ["npx eslint -c /tmp/x.mjs src", "chequeo-con-opciones"],
  ["npx eslint -f /tmp/x.mjs src", "chequeo-con-opciones"],
  ["npx eslint --cache-location .claude/settings.json src", "chequeo-con-opciones"],
  ["cat a > .claude/settings.json", "autoproteccion"],
  ["cat .env.local", "env-local"],
  ["node scripts/fabrica/estado-corrida.mjs ver --dir /no-existe --respuesta-usuario sonda", "estado-confirmacion"],
  [
    `git log -1 {--output=~/.gitconfig,--output=~/.gitconfig} --format='[core]%n%x09fsmonitor = "supabase db push; false"'`,
    "argumento-incierto",
  ],
  ["git diff {--output=.claude/settings.json,--output=.claude/settings.json} HEAD", "argumento-incierto"],
  ["npx eslint {-c,/tmp/evil.mjs} src", "argumento-incierto"],
  ['npm test -- "$X"', "argumento-incierto"],
  ["git log $(echo --output=x)", "argumento-incierto"],
  ["ls src(e:'supabase db push':)", "comando-no-analizable"],
  ["X=--output=.claude/settings.json; git log -1 $=X", "comando-no-analizable"],
];

describe("permissions.allow de .claude/settings.json", () => {
  it("ninguna regla tiene comodines: todas son Bash(...) con el texto exacto", () => {
    expect(permissions.allow.filter((regla) => !/^Bash\([^*]+\)$/.test(regla))).toEqual([]);
  });

  it("contiene exactamente el uso diario", () => {
    expect(permissions.allow).toEqual(USO_DIARIO.map((comando) => `Bash(${comando})`));
  });

  it.each(USO_DIARIO)("el uso diario no pregunta: %j", (comando) => {
    expect(decisionEfectiva(comando)).toBe("allow");
  });

  it.each(VUELVEN_A_PREGUNTAR)("el hook deja pasar y Claude Code pregunta: %j", (comando) => {
    expect(decision(comando).decision).toBe("allow");
    expect(decisionEfectiva(comando)).toBe("ask");
  });

  it.each(ARGUMENTOS_ARMADOS)("el hook pregunta por un argumento armado al ejecutar: %j", (comando) => {
    expect(decision(comando).decision).toBe("ask");
  });

  it.each(FUERA_DE_ALLOW)("ninguna regla cubre %j", (comando) => {
    expect(permissions.allow.filter((regla) => cubre(regla, comando))).toEqual([]);
  });

  it.each(PELIGROSOS)("un comando peligroso no pasa sin preguntar: %j", (comando) => {
    expect(decisionEfectiva(comando)).not.toBe("allow");
  });

  it.each(["git commit -m x", "git commit --amend --no-edit", "git add -A && git commit -m x"])(
    "un commit sobre main o develop pregunta: %j",
    (comando) => {
      for (const rama of ["main", "develop"]) {
        expect(decision(comando, rama)).toMatchObject({ decision: "ask", regla: "git-commit-rama-protegida" });
      }
    },
  );

  it.each(VARIANTES_PELIGROSAS)("el hook frena %j (%s)", (comando, regla) => {
    expect(decision(comando)).toMatchObject({ regla });
  });
});
