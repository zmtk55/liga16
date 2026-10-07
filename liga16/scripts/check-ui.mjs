#!/usr/bin/env node
/**
 * Guardia de la capa de componentes.
 *
 * Existe porque el conjunto de `components/ui` y las dependencias de
 * `package.json` se desincronizan solos: alguien borra una dependencia,
 * alguien reintroduce un componente (o al revés) y el build truena con
 * "Cannot find module" en archivos que nadie estaba importando.
 *
 * Cuatro chequeos:
 *   1. ERROR  componente en components/ui que nada alcanza desde las entradas
 *   2. ERROR  import de un paquete que no está en package.json
 *   3. AVISO  dependencia declarada que nada importa
 *   4. ERROR  tamaño de texto inventado por debajo del piso de la escala (12px)
 *
 * Uso: npm run check:ui
 */
import fs from "node:fs";
import path from "node:path";
import { builtinModules } from "node:module";

const root = process.cwd();
const srcRoot = path.join(root, "src");
const uiDir = path.join(srcRoot, "components", "ui");
const CONFIG_FILES = [
  "index.html",
  "vite.config.ts",
  "tailwind.config.js",
  "postcss.config.js",
  "eslint.config.js",
  "tsconfig.json",
  "tsconfig.app.json",
  "tsconfig.node.json",
];

/** "react-dom/client" -> "react-dom"; "@radix-ui/react-slot/dist/x" -> "@radix-ui/react-slot". */
const packageNameOf = (spec) => {
  const parts = spec.split("/");
  return spec.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
};

const walk = (dir, acc = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, acc);
    else if (/\.(tsx?|jsx?)$/.test(entry.name)) acc.push(p);
  }
  return acc;
};

/** Especificadores importados: from "x", import "x", import("x"), require("x"), @import "x". */
const IMPORT_RE =
  /(?:from\s*|import\s*|import\(\s*|require\(\s*)["']([^"']+)["']|@import\s+["']([^"']+)["']/g;

const sources = walk(srcRoot);
const specsOf = new Map(
  sources.map((file) => [
    file,
    [...fs.readFileSync(file, "utf8").matchAll(IMPORT_RE)]
      .map((m) => m[1] ?? m[2])
      .filter(Boolean),
  ]),
);

const resolveFile = (from, spec) => {
  let base;
  if (spec.startsWith("@/")) base = path.join(srcRoot, spec.slice(2));
  else if (spec.startsWith(".")) base = path.resolve(path.dirname(from), spec);
  else return null;
  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, "index.ts"),
    path.join(base, "index.tsx"),
  ]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
};

const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const declared = new Set([
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.devDependencies ?? {}),
]);
const nodeBuiltins = new Set(builtinModules);

// ── 1. Componentes sin uso ────────────────────────────────────────────────
// Un solo punto de entrada: main.tsx. Todo lo que la app no alcanza desde ahí
// no entra al bundle, así que tampoco debería estar en el repo. Usar "cualquier
// archivo de src" como entrada haría que el código muerto se autojustificara.
const entryFile = path.join(srcRoot, "main.tsx");
const entries = fs.existsSync(entryFile) ? [entryFile] : [];
const reachable = new Set();
const queue = [...entries];
while (queue.length) {
  const file = queue.pop();
  if (reachable.has(file) || !fs.existsSync(file)) continue;
  reachable.add(file);
  for (const spec of specsOf.get(file) ?? []) {
    const target = resolveFile(file, spec);
    if (target && !reachable.has(target)) queue.push(target);
  }
}

const uiFiles = fs.existsSync(uiDir) ? fs.readdirSync(uiDir).filter((f) => /\.(tsx?|jsx?)$/.test(f)) : [];
const unused = uiFiles.filter((f) => !reachable.has(path.join(uiDir, f)));

// ── 2 y 3. Paquetes: usados vs declarados ─────────────────────────────────
const importedPackages = new Set();
const missingPackages = new Map();
for (const [file, specs] of specsOf) {
  for (const spec of specs) {
    if (spec.startsWith(".") || spec.startsWith("@/") || spec.startsWith("~/")) continue;
    if (nodeBuiltins.has(spec) || spec.startsWith("node:")) continue;
    const name = packageNameOf(spec);
    importedPackages.add(name);
    if (!declared.has(name) && !fs.existsSync(path.join(root, "node_modules", name, "package.json"))) {
      if (!missingPackages.has(name)) missingPackages.set(name, new Set());
      missingPackages.get(name).add(path.relative(root, file));
    }
  }
}
const configText = CONFIG_FILES.map((f) =>
  fs.existsSync(path.join(root, f)) ? fs.readFileSync(path.join(root, f), "utf8") : "",
).join("\n");
const unusedPackages = [...declared].filter(
  (d) =>
    !d.startsWith("@types/") &&
    !importedPackages.has(d) &&
    !configText.includes(d),
);

// ── 4. Tipografía: el piso de la escala es 12px ──────────────────────────
// La app tiene una escala semántica (text-stat / text-caption / text-xs). Los
// `text-[10px]` escritos a mano la esquivaban: más de cien apariciones que nadie
// podía cambiar de golpe y que nadie leía. Cualquier tamaño inventado por debajo
// de 12px es un error, aunque compile y aunque se vea bien en la máquina de quien
// lo escribió.
const MIN_FONT_PX = 12;
const tinyType = [];
for (const file of sources) {
  const rel = path.relative(root, file);
  fs.readFileSync(file, "utf8").split("\n").forEach((line, i) => {
    for (const m of line.matchAll(/text-\[(\d+(?:\.\d+)?)px\]/g)) {
      if (Number(m[1]) < MIN_FONT_PX) tinyType.push(`${rel}:${i + 1}  text-[${m[1]}px]`);
    }
  });
}

// ── Reporte ───────────────────────────────────────────────────────────────
let errors = 0;
if (unused.length) {
  errors++;
  console.error(`\n✖ ${unused.length} componente(s) en components/ui sin usar:\n`);
  for (const f of unused) console.error(`   ${f}`);
  console.error(`\n   Bórralos, o impórtalos si el trabajo que los necesita aún no existe.\n`);
}
if (missingPackages.size) {
  errors++;
  console.error(`\n✖ ${missingPackages.size} paquete(s) importados y NO declarados en package.json:\n`);
  for (const [name, files] of missingPackages) {
    console.error(`   ${name}`);
    for (const f of [...files].slice(0, 3)) console.error(`      ${f}`);
  }
  console.error(`\n   Instálalos o quita esos imports.\n`);
}
if (tinyType.length) {
  errors++;
  console.error(`\n✖ ${tinyType.length} texto(s) por debajo de ${MIN_FONT_PX}px:\n`);
  for (const t of tinyType.slice(0, 20)) console.error(`   ${t}`);
  if (tinyType.length > 20) console.error(`   … y ${tinyType.length - 20} más`);
  console.error(
    `\n   Usa la escala semántica: text-xs (12px), text-caption para etiquetas\n` +
      `   en versalitas, text-stat para cifras. Cambia --text-caption en index.css\n` +
      `   si de verdad el piso necesita moverse, no cada pantalla por su cuenta.\n`,
  );
}
if (unusedPackages.length) {
  console.warn(`\n⚠ ${unusedPackages.length} dependencia(s) declaradas sin usar:\n`);
  console.warn(`   ${unusedPackages.join(", ")}\n`);
}

if (errors) {
  console.error(`check:ui FALLÓ con ${errors} problema(s).`);
  process.exit(1);
}
console.log(
  `check:ui OK — ${uiFiles.length} componentes en uso, ${importedPackages.size} paquetes importados.`,
);
