import { chromium } from "playwright";

const EMAIL = process.env.SHOT_EMAIL;
const PASSWORD = process.env.SHOT_PASSWORD;
if (!EMAIL || !PASSWORD) {
  console.error("Define SHOT_EMAIL y SHOT_PASSWORD en tu entorno (nunca en el repo).");
  process.exit(1);
}

const BASE = process.env.SHOT_BASE ?? "http://localhost:3000";
const ID = "ca5cab27-40aa-48f3-acf7-6ebcc42e0354";

async function shoot(tag, width, height) {
  const browser = await chromium.launch({ headless: true, args: ["--disable-dev-shm-usage"] });
  const page = await browser.newPage({ viewport: { width, height } });
  page.on("pageerror", (e) => console.log(tag, "PAGEERROR:", e.message.slice(0, 160)));
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(4000);

  // Navegación in-app (sin recargas: la sesión se mantiene)
  await page.locator('a[href="/jugadores"]:visible').first().click();
  await page.waitForURL("**/jugadores", { timeout: 30000 });
  await page.waitForTimeout(2000);
  const link = page.locator(`a[href="/jugadores/${ID}"]`).first();
  await link.waitFor({ timeout: 60000 });
  await link.scrollIntoViewIfNeeded();
  await link.click();
  await page.waitForURL(`**/jugadores/${ID}`, { timeout: 30000 });
  // Esperar al hero real (no skeletons ni pantalla anterior): la tarjeta de pareja
  await page.locator("section").first().getByText("PAREJA ACTUAL").waitFor({ timeout: 180000 });
  await page.waitForFunction(
    () => {
      const secs = [...document.querySelectorAll("section")];
      const hero = secs[0];
      if (!hero || !hero.querySelector("h1")) return false;
      // Sin skeletons pendientes en el hero
      return hero.querySelector(".animate-pulse") === null || hero.innerText.length > 200;
    },
    { timeout: 180000, polling: 2000 },
  );
  await page.waitForTimeout(2500);
  console.log(tag, "detalle:", page.url());

  const hero = page.locator("section").first();
  await hero.screenshot({ path: `player-hero-${tag}.png`, timeout: 30000 });
  const statsCard = page.locator("text=Forma reciente").locator("xpath=ancestor::div[contains(@class,'rounded') or contains(@data-slot,'card')][1]");
  try {
    await statsCard.first().screenshot({ path: `player-stats-${tag}.png`, timeout: 30000 });
  } catch (e) {
    console.log(tag, "stats shot falló:", e.message.slice(0, 120));
  }
  console.log(tag, "OK");
  await browser.close();
}

await shoot("desktop", 1280, 900);
await shoot("mobile", 390, 844);
