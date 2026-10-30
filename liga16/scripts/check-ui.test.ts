import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

function check(files: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), "liga16-guard-"));
  try {
    const fixtures = { "package.json": JSON.stringify({ dependencies: { react: "1" } }), "src/main.tsx": 'import "./components/ui/used";', "src/components/ui/used.tsx": 'import "react"; export const Used = 1;', ...files };
    for (const [name, text] of Object.entries(fixtures)) { const file = join(root, name); mkdirSync(resolve(file, ".."), { recursive: true }); writeFileSync(file, text); }
    const result = spawnSync(process.execPath, [resolve("scripts/check-ui.mjs")], { cwd: root, encoding: "utf8" });
    return { status: result.status, text: result.stdout + result.stderr };
  } finally { rmSync(root, { recursive: true, force: true }); }
}
describe("check:ui separa pruebas del grafo productivo", () => {
  it("admite tests sin importarlos al bundle", () => { expect(check({ "src/components/ui/used.test.tsx": 'import "./used";' }).status).toBe(0); });
  it("rechaza un componente alcanzable solo desde un test", () => { const r = check({ "src/components/ui/dead.tsx": "export const Dead = 1;", "src/components/ui/used.test.tsx": 'import "./dead";' }); expect(r.status).toBe(1); expect(r.text).toContain("dead.tsx"); });
  it("sigue comprobando dependencias y tipografía de tests", () => { const r = check({ "src/components/ui/used.spec.tsx": 'import "missing-package"; const style = "text-[9px]";' }); expect(r.status).toBe(1); expect(r.text).toContain("missing-package"); expect(r.text).toContain("text-[9px]"); });
});

