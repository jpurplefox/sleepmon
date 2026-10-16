// Regenerates the landing's app captures (public/landing/{es,en}/*.jpg) from the real app.
// Needs: the frontend dev server (--app, default http://localhost:5173) and the demo backend:
//   cd backend && PYTHONPATH=. python scripts/landing_demo_server.py
// Chrome: CHROME_PATH, default macOS Google Chrome.
import { mkdtemp, mkdir, rename, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "landing");
const APP = process.argv.find((a) => a.startsWith("--app="))?.slice(6) ?? "http://localhost:5173";
const DEMO = "http://127.0.0.1:8010";
const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const LANGS = ["es", "en"];
const JPEG = { type: "jpeg", quality: 85 };

const BOX = [
  ["Sylveon", 22, "Calm", ["Moomoo Milk", "Soothing Cacao", "Bean Sausage"], ["Skill Trigger M", "Helping Speed M"], 3],
  ["Sylveon", 50, "Modest", ["Moomoo Milk", "Soothing Cacao", "Moomoo Milk"], ["Skill Trigger M", "Helping Speed S", "Energy Recovery Bonus", "Inventory Up M"], 4],
  ["Gardevoir", 25, "Bold", ["Fancy Apple", "Greengrass Corn", "Fancy Apple"], ["Skill Trigger M", "Helping Speed S"], 3],
  ["Magnezone", 57, "Adamant", ["Pure Oil", "Fiery Herb", "Pure Oil"], ["Helping Speed M", "Skill Trigger M", "Helping Bonus", "Inventory Up L", "Skill Level Up M"], 4],
  ["Tyranitar", 60, "Adamant", ["Warming Ginger", "Greengrass Soybeans", "Bean Sausage"], ["Ingredient Finder M", "Helping Speed M", "Helping Bonus", "Inventory Up M", "Skill Level Up S"], 3],
  ["Charizard", 52, "Quiet", ["Bean Sausage", "Warming Ginger", "Fiery Herb"], ["Ingredient Finder M", "Helping Speed M", "Inventory Up L", "Ingredient Finder S"], 3],
  ["Pikachu", 38, "Brave", ["Fancy Apple", "Warming Ginger", "Fancy Egg"], ["Berry Finding S", "Helping Speed M", "Skill Trigger S"], 3],
  ["Arcanine", 30, "Brave", ["Fiery Herb", "Bean Sausage", "Fiery Herb"], ["Skill Trigger M", "Ingredient Finder S"], 3],
  // The hero's comparison: Venusaur as base, the two Honey rivals beside it.
  ["Venusaur", 62, "Modest", ["Honey", "Honey", "Honey"], ["Research EXP Bonus", "Dream Shard Bonus", "Ingredient Finder M", "Ingredient Finder S", "Inventory Up L"], 3, "500h"],
  ["Pinsir", 60, "Serious", ["Honey", "Honey", "Honey"], ["Inventory Up S", "Ingredient Finder M", "Skill Level Up M", "Helping Bonus", "Skill Level Up S"], 1],
  ["Ribombee", 60, "Quiet", ["Honey", "Honey", "Honey"], ["Dream Shard Bonus", "Helping Speed M", "Helping Speed S", "Ingredient Finder S", "Inventory Up S"], 7],
];

async function api(path, init = {}, token) {
  const res = await fetch(DEMO + path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path}: ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

async function seed() {
  const { access_token: token } = await api("/auth/google", { method: "POST", body: '{"credential":"demo"}' });
  let box = await api("/team", {}, token);
  if (box.length) return;
  for (const [species, level, nature, ingredients, sub_skills, skill_level, ribbon = ""] of BOX)
    await api("/team", { method: "POST", body: JSON.stringify({ species, level, nature, ingredients, sub_skills, ribbon, skill_level }) }, token);
  box = await api("/team", {}, token);
  const id = (s, lv) => box.find((m) => m.species === s && (!lv || m.level === lv)).id;
  await api("/saved-teams", {
    method: "POST",
    body: JSON.stringify({
      name: "Verdegal", island: "Greengrass Isle", favorite_berries: ["Grepa", "Wiki", "Leppa"], main_favorite: null,
      weekly_bonus: "berry_strength", dish_type: "Curry", meals: ["Beanburger Curry", '"Egg Bomb" Curry', '"Drought" Katsu Curry'],
      slots: [id("Tyranitar"), id("Charizard"), id("Pikachu"), id("Magnezone"), id("Sylveon", 50)].map((m) => ({ members: [m], share: 1 })),
    }),
  }, token);
}

// A fresh signed-in context per scene: the refresh token rotates, so a reused one signs out.
async function scene(browser, lang, run) {
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 1100 }, deviceScaleFactor: 2, colorScheme: "dark" });
  await ctx.addInitScript((l) => { localStorage.setItem("sleepmon.session", "1"); localStorage.setItem("sleepmon.lang", l); }, lang);
  await ctx.route("http://localhost:8000/**", async (route) => {
    const req = route.request();
    if (req.method() === "POST" && req.url().endsWith("/comparison-shares")) {
      const body = JSON.parse(req.postData() ?? "{}");
      return route.fulfill({
        status: 201, contentType: "application/json",
        headers: { "Access-Control-Allow-Origin": new URL(APP).origin, "Access-Control-Allow-Credentials": "true" },
        body: JSON.stringify({ id: "k3f9xq", url: "https://sleepmon.app/c/k3f9xq", ...body }),
      });
    }
    const resp = await route.fetch({ url: req.url().replace("http://localhost:8000", DEMO) });
    return route.fulfill({ response: resp });
  });
  await ctx.request.post("http://localhost:8010/auth/google", { data: { credential: "demo" } });
  const page = await ctx.newPage();
  try {
    await run(page);
  } finally {
    await ctx.close();
  }
}

async function capture(browser, dir, lang) {
  const shot = (loc, name, opts = {}) => loc.screenshot({ path: join(dir, `${name}.jpg`), ...JPEG, ...opts });

  await scene(browser, lang, async (page) => {
    await page.goto(`${APP}/box`);
    const entry = page.locator(".box-entry", { hasText: /(Nv|Lv)\. 22\b/ }).first();
    await entry.locator("button").last().click();
    await page.getByRole("menuitem").first().click();
    await page.locator(".sug-row").first().waitFor();
    const cards = page.locator(".prod-cards .prod-card:not(.prod-card--add)");
    await shot(cards.nth(0), "compare-base");
    const add = page.locator(".prod-card--add");
    const top = (await page.locator(".sug-row").first().boundingBox()).y - 40;
    const last = await add.locator("button").last().boundingBox();
    const box = await add.boundingBox();
    await page.screenshot({ path: join(dir, "compare-suggestions.jpg"), ...JPEG, clip: { x: box.x, y: top, width: box.width, height: last.y + last.height + 16 - top } });
  });

  await scene(browser, lang, async (page) => {
    await page.goto(`${APP}/box`);
    const entry = page.locator(".box-entry", { hasText: "Venusaur" }).first();
    await entry.locator("button").last().click();
    await page.getByRole("menuitem").first().click();
    const cards = page.locator(".prod-cards .prod-card:not(.prod-card--add)");
    for (const rival of ["Pinsir", "Ribombee"]) {
      await page.locator(".sug-row", { hasText: rival }).click();
      await page.waitForTimeout(1500);
    }
    await shot(cards.nth(1), "hero-card-1");
    await shot(cards.nth(0), "hero-card-2");
    await shot(cards.nth(2), "hero-card-3");
    await page.locator(".tool-head").getByRole("button", { name: /Compartir|Share/ }).click();
    await page.getByRole("dialog").locator('input[value="sleepmon.app/c/k3f9xq"], :text("sleepmon.app/c/k3f9xq")').first().waitFor();
    await page.waitForTimeout(800);
    await shot(page.getByRole("dialog"), "share-dialog");
  });

  await scene(browser, lang, async (page) => {
    await page.goto(`${APP}/teams`);
    await page.locator(".team-row button").last().click();
    await page.getByRole("menuitem").first().click();
    await page.locator(".teams-totals").waitFor();
    await page.waitForTimeout(1500);
    const cards = page.locator(".prod-cards .prod-card");
    for (let i = 0; i < 3; i++) await shot(cards.nth(i), `team-card-${i + 1}`);
    await shot(page.locator(".teams-totals"), "team-totals");
  });

  await scene(browser, lang, async (page) => {
    await page.goto(`${APP}/box`);
    const entry = page.locator(".box-entry", { hasText: "Tyranitar" }).first();
    await entry.waitFor();
    await shot(entry, "box-entry");
    await entry.getByText(/60 → 70/).first().hover();
    const tip = entry.locator(".box-entry__levelup .tooltip__bubble:visible").first();
    await tip.waitFor();
    await shot(tip, "levelup-tip");
  });
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true }).catch((e) => {
  throw new Error(`Could not launch Chrome at ${CHROME} (set CHROME_PATH): ${e.message}`);
});
// Temp dir beside the output so rename() stays on the same filesystem (no EXDEV).
await mkdir(dirname(OUT), { recursive: true });
const tmp = await mkdtemp(join(dirname(OUT), ".landing-shots-"));
try {
  await seed();
  for (const lang of LANGS) {
    await mkdir(join(tmp, lang), { recursive: true });
    await capture(browser, join(tmp, lang), lang);
  }
  await rm(OUT, { recursive: true, force: true });
  await rename(tmp, OUT);
  console.log(`Wrote captures to ${OUT}`);
} finally {
  await browser.close();
  await rm(tmp, { recursive: true, force: true });
}
