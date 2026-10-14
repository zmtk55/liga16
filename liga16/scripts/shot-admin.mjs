import { chromium } from "playwright";

const BASE = process.env.SHOT_BASE ?? "http://localhost:3000";
const PAGES = ["/admin/jugadores", "/admin/resultados", "/admin/inbox", "/admin/noticias"];

const b = await chromium.launch({ headless: true, args: ["--disable-dev-shm-usage"] });
const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
p.on("pageerror", (e) => console.log("PAGEERROR:", e.message.slice(0, 160)));
await p.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 120000 });
await p.waitForTimeout(2000);
await p.fill('input[type="email"]', "julian.blackflag@gmail.com");
await p.fill('input[type="password"]', "123456");
await p.locator('button[type="submit"]').click();
await p.waitForTimeout(4000);

await p.locator('a[href="/admin"]:visible').first().click();
await p.waitForURL("**/admin", { timeout: 60000 });
await p.waitForTimeout(3000);

for (const url of PAGES) {
  const tag = url.replace("/admin/", "admin-");
  await p.locator(`aside a[href="${url}"]`).first().click();
  await p.waitForURL(`**${url}`, { timeout: 30000 });
  // El toolbar real: input de búsqueda del FilterBar
  await p.locator('input[aria-label^="Buscar"]').first().waitFor({ timeout: 120000 });
  await p.waitForTimeout(2000);
  await p.locator("main").screenshot({ path: `${tag}.png`, timeout: 30000 });
  console.log(tag, "OK", p.url());
}
await b.close();
