import { describe, expect, it } from "vitest";

import { analizarComando, opcionesYPosicionales } from "./comando-shell.mjs";

type Segmento = {
  nombre: string | null;
  args: string[];
  dinamico: boolean;
  entorno: Record<string, string>;
  envoltorios: string[];
  cwd: string | null;
  anidado: boolean;
  palabras: { valor: string; incierta: boolean }[];
  palabrasDeEnvoltorios: { valor: string; incierta: boolean }[];
  otrasPalabras: { valor: string }[];
  redirecciones: { destino: { valor: string }; escribe: boolean }[];
};

function segmentos(texto: string, opciones?: { cwd?: string }): Segmento[] {
  const resultado = analizarComando(texto, opciones);
  if (!resultado.ok) throw new Error(`no se pudo analizar: ${resultado.error}`);
  return resultado.segmentos as Segmento[];
}

function nombres(texto: string) {
  return segmentos(texto)
    .map(({ nombre }) => nombre)
    .sort();
}

function algunoDinamico(texto: string) {
  return segmentos(texto).some(({ dinamico }) => dinamico);
}

describe("analizarComando", () => {
  it.each([
    ["a && b || c; d | e |& f & g\nh", ["a", "b", "c", "d", "e", "f", "g", "h"]],
    ["(a; b)", ["a", "b"]],
    ["if a; then b; fi", ["a", "b"]],
    ["for x in 1 2; do b; done", ["b", "for"]],
    ["{ a; b; }", ["a", "b"]],
    ["! a", ["a"]],
    ["a # b && c", ["a"]],
    [`git commit -m "uno && dos; tres"`, ["git"]],
    ["/tmp/supabase-cli/supabase db push", ["supabase"]],
    ["GIT status", ["git"]],
  ])("separa %j", (texto, esperado) => {
    expect(nombres(texto)).toEqual(esperado);
  });

  it("une comillas, escapes y líneas continuadas en palabras", () => {
    const [segmento] = segmentos(`g"i"t \\\n pu\\sh 'a b' "c d"`);
    expect(segmento).toMatchObject({ nombre: "git", args: ["push", "a b", "c d"] });
  });

  it("guarda las asignaciones de entorno y una asignación sin comando", () => {
    expect(segmentos("A=1 B='dos tres' npm test")[0]).toMatchObject({ nombre: "npm", entorno: { A: "1", B: "dos tres" } });
    expect(segmentos("X=1")[0]).toMatchObject({ nombre: null, entorno: { X: "1" } });
  });

  it("registra redirecciones y si escriben", () => {
    const [segmento] = segmentos("cat a > b 2>&1 < c");
    expect(segmento.args).toEqual(["a"]);
    expect(segmento.redirecciones.map(({ destino, escribe }) => [destino.valor, escribe])).toEqual([
      ["b", true],
      ["1", false],
      ["c", false],
    ]);
  });

  it.each([
    ["echo $(git push)", ["echo", "git"]],
    ["echo `git push`", ["echo", "git"]],
    ['echo "$(echo $(git push))"', ["echo", "echo", "git"]],
    ["diff <(git show a) <(git show b)", ["diff", "git", "git"]],
    ["echo '$(git push)'", ["echo"]],
  ])("analiza las sustituciones de %j", (texto, esperado) => {
    expect(nombres(texto)).toEqual(esperado);
  });

  it("marca como anidados los segmentos de una sustitución", () => {
    const lista = segmentos("echo $(git push)");
    expect(lista.map(({ nombre, anidado }) => [nombre, anidado])).toEqual([
      ["git", true],
      ["echo", false],
    ]);
  });

  describe("heredocs", () => {
    it("descarta el cuerpo con comillas que no ejecuta nadie", () => {
      expect(nombres("cat <<'EOF'\ngit push --force\nEOF\necho fin")).toEqual(["cat", "echo"]);
      expect(nombres("cat <<-EOF\n\tcuerpo\n\tEOF\necho fin")).toEqual(["cat", "echo"]);
      expect(nombres(`git commit -m "$(cat <<'EOF'\nit's (raro\nEOF\n)"`)).toEqual(["cat", "git"]);
    });

    it.each(["bash <<EOF\ngit push\nEOF", "bash <<EOF && echo fin\ngit push\nEOF", `bash <<< "git push"`])(
      "analiza el cuerpo que alimenta a un shell: %j",
      (texto) => {
        expect(nombres(texto)).toContain("git");
      },
    );

    it("suma como palabra el código que alimenta a un intérprete", () => {
      const [python] = segmentos("python3 - <<'PY'\nprint(1)\nPY");
      expect(python.otrasPalabras.map(({ valor }) => valor)).toContain("print(1)");
      const [node] = segmentos(`node <<< "console.log(1)"`);
      expect(node.otrasPalabras.map(({ valor }) => valor)).toContain("console.log(1)");
    });
  });

  describe("shells y eval", () => {
    it.each([
      `bash -c "git push"`,
      `sh -c 'git push'`,
      `dash -c 'git push'`,
      `bash -lc 'git push'`,
      `bash -o pipefail -c 'git push'`,
      `bash --rcfile x -c 'git push'`,
      `eval "git push"`,
    ])("analiza el script de %j sin dejarlo como argumento", (texto) => {
      const lista = segmentos(texto);
      expect(lista.find(({ nombre }) => nombre === "git")?.args).toEqual(["push"]);
      expect(lista.find(({ nombre }) => nombre !== "git")?.args).not.toContain("git push");
    });

    it("recorre hasta 3 niveles y rechaza más", () => {
      expect(nombres(`bash -c "bash -c 'eval git push'"`)).toContain("git");
      expect(analizarComando(`eval "eval \\"eval 'eval git push'\\""`).ok).toBe(false);
    });

    it("no marca como dinámico un shell que ejecuta un archivo", () => {
      expect(segmentos("bash scripts/x.sh --apply")[0]).toMatchObject({ nombre: "bash", dinamico: false });
    });
  });

  describe("palabra de comando o script que no se pueden evaluar", () => {
    it.each([
      "$X db push",
      '"$X" db push',
      "${X} db push",
      "{supabase,db,push}",
      "=supabase db push",
      "su?abase db push",
      `bash -c "$X"`,
      "eval $X",
      "cat x | bash",
      "cat x | (bash)",
      "bash < x",
      "bash -s",
      "bash <(echo x)",
      "source <(echo x)",
      ". /dev/stdin <<< x",
      "source /dev/stdin",
      "cat x | python3",
      "node < x",
      `env -S "git push"`,
      `npx -c "git push"`,
      `npm exec -c "git push"`,
    ])("marca como dinámico %j", (texto) => {
      expect(algunoDinamico(texto)).toBe(true);
    });

    it.each(["git status", "[ -f x ]", "source scripts/x.sh", "cat x.json | python3 -m json.tool"])(
      "no marca como dinámico %j",
      (texto) => {
        expect(algunoDinamico(texto)).toBe(false);
      },
    );
  });

  describe("envoltorios", () => {
    it.each([
      ["env -u X A=1 git push", ["env"]],
      ["sudo -u root git push", ["sudo"]],
      ["command git push", ["command"]],
      ["exec -a nombre git push", ["exec"]],
      ["time nohup git push", ["time", "nohup"]],
      ["nice -n 5 git push", ["nice"]],
      ["timeout -k 5 10 git push", ["timeout"]],
      ["xargs -n 1 git push", ["xargs"]],
      ["xargs -I{} git push", ["xargs"]],
      ["npx -p x git push", ["npx"]],
      ["bunx git push", ["bunx"]],
      ["npm exec -- git push", ["npm"]],
      ["npm x git push", ["npm"]],
      ["pnpm exec git push", ["pnpm"]],
      ["yarn dlx git push", ["yarn"]],
      ["yarn git push", ["yarn"]],
      ["pnpm run git push", ["pnpm"]],
      ["sudo env A=1 nohup git push", ["sudo", "env", "nohup"]],
    ])("desenvuelve %j", (texto, envoltorios) => {
      expect(segmentos(texto)[0]).toMatchObject({ nombre: "git", args: ["push"], envoltorios });
    });

    it("reconoce versiones en npx y toma las asignaciones de env", () => {
      expect(segmentos("npx supabase@latest db push")[0].nombre).toBe("supabase");
      expect(segmentos("env A=1 npm test")[0].entorno).toEqual({ A: "1" });
    });

    it.each([
      ["command -v supabase", "command"],
      ["npm run lint", "npm"],
      ["yarn install", "yarn"],
      ["pnpm add -D x", "pnpm"],
      ["constructor x", "constructor"],
    ])("no desenvuelve %j", (texto, nombre) => {
      expect(segmentos(texto)[0].nombre).toBe(nombre);
    });
  });

  describe("cd", () => {
    const cwd = "/repo";

    it("aplica el cd a lo que sigue", () => {
      const lista = segmentos("cd a && git status && cd ../b && git status", { cwd });
      expect(lista.filter(({ nombre }) => nombre === "git").map((segmento) => segmento.cwd)).toEqual([
        "/repo/a",
        "/repo/b",
      ]);
      expect(segmentos("cd /otro && git status")[1].cwd).toBe("/otro");
    });

    it.each(["cd $X", "cd -", "cd", "cd ~/x", "popd"])("pierde el cwd con %j", (cd) => {
      expect(segmentos(`${cd} && git status`, { cwd })[1].cwd).toBeNull();
    });

    it("limita el cd al subshell y a la sustitución", () => {
      expect(segmentos("(cd a); git status", { cwd }).at(-1)?.cwd).toBe("/repo");
      expect(segmentos("echo $(cd a); git status", { cwd }).at(-1)?.cwd).toBe("/repo");
    });
  });

  describe("construcciones no triviales y entrada inválida", () => {
    it.each([
      `echo "sin cerrar`,
      "echo 'sin cerrar",
      "echo `sin cerrar",
      "echo $(sin cerrar",
      "echo ${sin cerrar",
      "(sin cerrar",
      "sin abrir)",
      "cat >",
      "echo \\",
      "cat <<EOF\ncuerpo",
      "git reset $'--hard'",
      `echo $"x"`,
      'echo "${X:-`git push`}"',
      "echo ${X:-$(git push)}",
      "echo `echo \\`git push\\``",
      "cat <<EOF\n$(git push)\nEOF",
      "cat <<EOF\n`git push`\nEOF",
    ])("informa error en %j", (texto) => {
      expect(analizarComando(texto).ok).toBe(false);
    });

    it.each([
      "ls src(e:'supabase db push':)",
      "ls src/*(e:'touch x':)",
      'ls "$CLAUDE_PROJECT_DIR"/x(e:y:)',
      "git log(x)",
      "(a)(b)",
    ])("informa error si un paréntesis va pegado a una palabra: %j", (texto) => {
      expect(analizarComando(texto).ok).toBe(false);
    });

    it.each(["(git status)", "git status;(ls)", "a&&(b)", "a|(b)", "echo $((1+2))", "cat <(ls)", "echo $(ls)"])(
      "acepta un paréntesis que abre un subshell o una sustitución: %j",
      (texto) => {
        expect(analizarComando(texto).ok).toBe(true);
      },
    );

    it.each(["git log $=X", "git log $~X", "git log $^X", "git log --o$=X", "ls $/", "ls $+X"])(
      "informa error ante un $ sin comillas que zsh puede expandir: %j",
      (texto) => {
        expect(analizarComando(texto).ok).toBe(false);
      },
    );

    it.each(["echo $", "echo a$ b", "echo $;ls", 'echo "$=X"', "echo '$=X'", "echo \\$=X"])(
      "acepta un $ literal: %j",
      (texto) => {
        expect(analizarComando(texto).ok).toBe(true);
      },
    );

    it.each([undefined, null, 1, {}])("rechaza una entrada que no es texto: %s", (texto) => {
      expect(analizarComando(texto).ok).toBe(false);
    });

    it("acepta el comando vacío", () => {
      expect(segmentos("   \n  ")).toEqual([]);
    });
  });
});

describe("analizarComando: palabras inciertas", () => {
  const inciertas = (texto: string) =>
    segmentos(texto)
      .filter(({ anidado }) => !anidado)
      .flatMap(({ palabras }) => palabras)
      .filter(({ incierta }) => incierta)
      .map(({ valor }) => valor);

  it.each([
    ["git log {--output=x,--output=x}", "{--output=x,--output=x}"],
    ["npm test -- {a,--config=x}", "{a,--config=x}"],
    ["ls a{1..3}", "a{1..3}"],
    [`ls {"a",b}`, "{a,b}"],
    ["npm test -- $X", "$X"],
    ["npm test -- ${X}", "${X}"],
    ["npm test -- a$X", "a$X"],
    [`npm test -- "$X"`, "$X"],
    [`npm test -- "$X/a"`, "$X/a"],
    [`npm test -- ""$X`, "$X"],
    ["npm test -- $(echo --config=x)", "$(echo --config=x)"],
    [`npm test -- "$(echo --config=x)"`, "$(echo --config=x)"],
    ["npm test -- `echo --config=x`", "`echo --config=x`"],
    ["diff <(echo a) b", "<(echo a)"],
    ["ls *", "*"],
    ["ls ?x", "?x"],
    ["ls [ab]x", "[ab]x"],
  ])("marca incierta la palabra de %j", (texto, palabra) => {
    expect(inciertas(texto)).toEqual([palabra]);
  });

  it.each([
    "git show HEAD@{1}",
    "git stash show stash@{0}",
    "git log @{u}..HEAD",
    `ls "{a,b}"`,
    "ls '{a,b}'",
    "ls \\{a,b}",
    "ls {a\\,b}",
    "ls src/*",
    "ls '*'",
    `npm test -- "a$X"`,
    `git commit -m "a $(date)"`,
    "find . -exec rm {} ;",
    'node "$CLAUDE_PROJECT_DIR/scripts/fabrica/estado-corrida.mjs" ver --dir "$CLAUDE_PROJECT_DIR/.claude/fabrica/runs/x"',
    "ls ${CLAUDE_PROJECT_DIR}/src",
    "ls $CLAUDE_PROJECT_DIR/src/*",
  ])("no marca incierta ninguna palabra de %j", (texto) => {
    expect(inciertas(texto)).toEqual([]);
  });

  it.each([
    'CLAUDE_PROJECT_DIR=/tmp; ls "$CLAUDE_PROJECT_DIR/x"',
    'export CLAUDE_PROJECT_DIR=/tmp && ls "$CLAUDE_PROJECT_DIR/x"',
    'read CLAUDE_PROJECT_DIR; ls "$CLAUDE_PROJECT_DIR/x"',
    'echo "${CLAUDE_PROJECT_DIR:=/tmp}"; ls "$CLAUDE_PROJECT_DIR/x"',
    'ls "$CLAUDE_PROJECT_DIR/$X"',
    "ls $CLAUDE_PROJECT_DIR/{a,b}",
    'ls "$CLAUDE_PROJECT_DIRX/a"',
    "IFS=a; ls $CLAUDE_PROJECT_DIR/x",
    "export IFS=/ && ls $CLAUDE_PROJECT_DIR/x",
  ])("la raíz del proyecto deja de ser segura en %j", (texto) => {
    expect(inciertas(texto).some((valor) => valor.includes("CLAUDE_PROJECT_DIR"))).toBe(true);
  });

  it("marca las palabras de los envoltorios, no las asignaciones", () => {
    const [segmento] = segmentos(`PATH="/usr/local/bin:$PATH" A=$B timeout $T npm test`);
    expect(segmento.palabrasDeEnvoltorios.filter(({ incierta }) => incierta).map(({ valor }) => valor)).toEqual(["$T"]);
    expect(segmento.palabras.some(({ incierta }) => incierta)).toBe(false);
  });
});

describe("opcionesYPosicionales", () => {
  const palabras = (...valores: string[]) => valores.map((valor) => ({ valor }));

  it("separa opciones, sus valores y lo que sigue a --", () => {
    const { opciones, posicionales } = opcionesYPosicionales(palabras("-p", "x", "a", "--", "-b"), ["-p"]);
    expect(opciones).toEqual(["-p"]);
    expect(posicionales.map(({ valor }) => valor)).toEqual(["a", "-b"]);
  });

  it("corta en el límite de posicionales y devuelve el resto", () => {
    const { posicionales, resto } = opcionesYPosicionales(palabras("10", "git", "push"), [], 1);
    expect(posicionales.map(({ valor }) => valor)).toEqual(["10"]);
    expect(resto.map(({ valor }) => valor)).toEqual(["git", "push"]);
  });
});
