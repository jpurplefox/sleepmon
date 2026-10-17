// Regenerates the landing's app captures (public/landing/{es,en}/*.jpg) from the real app.
// Needs: the frontend dev server (--app, default http://localhost:5173) and the demo backend:
//   cd backend && PYTHONPATH=. python scripts/landing_demo_server.py
// Chrome: CHROME_PATH, default macOS Google Chrome.
import { mkdtemp, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "landing");
// Where the catch story's pointer, clicks and highlights go, as % of each capture.
const MARKS = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "pages", "landing", "shotMarks.json");
const APP = process.argv.find((a) => a.startsWith("--app="))?.slice(6) ?? "http://localhost:5173";
const DEMO = "http://127.0.0.1:8010";
const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const LANGS = ["es", "en"];
const JPEG = { type: "jpeg", quality: 85 };
// The game screenshots the "catch" scene uploads, and the reading the AI model would return for them.
const INPUT = join(dirname(fileURLToPath(import.meta.url)), "landing-input");
const GAME_SHOTS = ["tyrunt-1.jpg", "tyrunt-2.jpg"].map((f) => join(INPUT, f));
const READING = {
  species: "Tyrunt", level: 16, nature: "Modest", ingredients: ["Bean Sausage", "Fancy Apple", "Bean Sausage"],
  sub_skills: ["Berry Finding S", "Ingredient Finder M", "Helping Speed S", "Inventory Up S", "Ingredient Finder S"],
  skill_level: 1, ribbon: "", versatile_skill: null, unread: [],
};

const BOX = [
  ["Sylveon", 50, "Modest", ["Moomoo Milk", "Soothing Cacao", "Moomoo Milk"], ["Skill Trigger M", "Helping Speed S", "Energy Recovery Bonus", "Inventory Up M"], 4],
  ["Gardevoir", 25, "Bold", ["Fancy Apple", "Greengrass Corn", "Fancy Apple"], ["Skill Trigger M", "Helping Speed S"], 3],
  ["Magnezone", 57, "Adamant", ["Pure Oil", "Fiery Herb", "Pure Oil"], ["Helping Speed M", "Skill Trigger M", "Helping Bonus", "Inventory Up L", "Skill Level Up M"], 4],
  ["Tyranitar", 60, "Adamant", ["Warming Ginger", "Greengrass Soybeans", "Bean Sausage"], ["Ingredient Finder M", "Helping Speed M", "Helping Bonus", "Inventory Up M", "Skill Level Up S"], 3],
  ["Charizard", 52, "Quiet", ["Bean Sausage", "Warming Ginger", "Fiery Herb"], ["Ingredient Finder M", "Helping Speed M", "Inventory Up L", "Ingredient Finder S"], 3],
  ["Pikachu", 38, "Brave", ["Fancy Apple", "Warming Ginger", "Fancy Egg"], ["Berry Finding S", "Helping Speed M", "Skill Trigger S"], 3],
  ["Arcanine", 30, "Brave", ["Fiery Herb", "Bean Sausage", "Fiery Herb"], ["Skill Trigger M", "Ingredient Finder S"], 3],
  // The Box rival the imported Tyrunt is compared with (Charge Strength files it with Sitrus berries).
  // Decent but beatable: the evolved Tyrunt should come out ahead at level 60 on Taupe Hollow.
  ["Sudowoodo", 60, "Bashful", ["Snoozy Tomato", "Greengrass Soybeans", "Tasty Mushroom"], ["Berry Finding S", "Skill Trigger S", "Helping Speed S", "Ingredient Finder S", "Inventory Up M"], 4, "200h"],
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
    if (req.method() === "POST" && req.url().endsWith("/screenshot-import")) {
      return route.fulfill({
        status: 200, contentType: "application/json",
        headers: { "Access-Control-Allow-Origin": new URL(APP).origin, "Access-Control-Allow-Credentials": "true" },
        body: JSON.stringify(READING),
      });
    }
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

// A box as % of the clip it was captured in, rounded to 0.1.
const rel = (box, clip) => {
  const r = (v) => Math.round(v * 1000) / 10;
  return { x: r((box.x - clip.x) / clip.width), y: r((box.y - clip.y) / clip.height), w: r(box.width / clip.width), h: r(box.height / clip.height) };
};

async function capture(browser, dir, lang) {
  const shot = (loc, name, opts = {}) => loc.screenshot({ path: join(dir, `${name}.jpg`), ...JPEG, ...opts });
  const marks = {};

  await scene(browser, lang, async (page) => {
    // The uploaded screenshots themselves, as the tile shows them.
    for (const [i, file] of GAME_SHOTS.entries()) {
      const data = (await readFile(file)).toString("base64");
      await page.setContent(`<body style="margin:0;background:#0e1220"><img id="g" style="display:block;width:291px" src="data:image/${file.endsWith(".png") ? "png" : "jpeg"};base64,${data}"></body>`);
      await shot(page.locator("#g"), `game-${i + 1}`);
    }
    // Step by step, as the catch tile plays it: read, evolve, pick a rival, set island and level, compare.
    await page.goto(`${APP}/compare`);
    await page.getByRole("button", { name: /Desde imágenes|From screenshots/ }).first().click();
    await page.locator('input[type="file"]').setInputFiles(GAME_SHOTS);
    await page.getByRole("button", { name: /Leer imágenes|Read screenshots/ }).click();
    await page.locator(".form-summary").waitFor();
    // The species and level rows, before and after evolving: the step reads as Tyrunt → Tyrantrum.
    const formTop = async (name) => {
      const dialog = await page.getByRole("dialog").boundingBox();
      const top = await page.locator(".form__row").first().boundingBox();
      const level = await page.locator(".level-evolve").first().boundingBox();
      const clip = { x: dialog.x + 12, y: top.y - 12, width: dialog.width - 24, height: level.y + level.height - top.y + 24 };
      await page.screenshot({ path: join(dir, `${name}.jpg`), ...JPEG, clip });
      return clip;
    };
    // Let the dialog's entrance and the sprites settle first.
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1200);
    const beforeClip = await formTop("catch-evolve-before");
    const evolveBtn = page.getByRole("button", { name: /Evolucionar a|Evolve to/ }).first();
    marks.evolve = rel(await evolveBtn.boundingBox(), beforeClip);
    await evolveBtn.click();
    await page.waitForTimeout(600);
    await formTop("catch-evolve-after");
    await page.getByRole("button", { name: /Agregar a la comparación|Add to comparison/ }).click();
    const cards = page.locator(".prod-cards .prod-card:not(.prod-card--add)");
    await cards.first().waitFor();
    await page.locator(".sug-row", { hasText: "Sudowoodo" }).waitFor();
    await page.waitForTimeout(1500);
    // Close-up of the suggestion: it says where the rival comes from.
    const add = await page.locator(".prod-card--add").boundingBox();
    const sug = await page.locator(".sug-row", { hasText: "Sudowoodo" }).boundingBox();
    await page.screenshot({
      path: join(dir, "catch-pick.jpg"), ...JPEG,
      clip: { x: add.x + 8, y: sug.y - 44, width: add.width - 16, height: sug.height + 60 },
    });
    await page.locator(".sug-row", { hasText: "Sudowoodo" }).click();
    await cards.nth(1).waitFor();
    // Taupe Hollow favors Sitrus, the berry both of them gather.
    await page.getByRole("button", { name: /^(Mapa|Map) Greengrass Isle/ }).click();
    const mapDialog = page.getByRole("dialog");
    await mapDialog.getByRole("button", { name: "Greengrass Isle" }).click();
    // The open list of maps, and where each one sits in it, for the pointer to walk down.
    const options = page.getByRole("option");
    await options.first().waitFor();
    await page.waitForTimeout(500);
    const dBox = await mapDialog.boundingBox();
    const oBoxes = await options.evaluateAll((els) => els.map((e) => { const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, width: b.width, height: b.height }; }));
    const listBottom = Math.max(dBox.y + dBox.height, ...oBoxes.map((b) => b.y + b.height + 12));
    const listClip = { x: dBox.x, y: dBox.y, width: dBox.width, height: listBottom - dBox.y };
    await page.screenshot({ path: join(dir, "catch-map-list.jpg"), ...JPEG, clip: listClip });
    const names = await options.allInnerTexts();
    marks.maps = { options: oBoxes.map((b) => rel(b, listClip)), target: names.findIndex((n) => n.startsWith("Taupe Hollow")) };
    await mapDialog.getByRole("option", { name: /^Taupe Hollow/ }).click();
    await page.waitForTimeout(600);
    await shot(mapDialog, "catch-map");
    await page.keyboard.press("Escape");
    await mapDialog.waitFor({ state: "hidden" });
    await page.locator(".ctx-levels .level-chip", { hasText: /^60$/ }).click();
    // Focus rings (map trigger, level chip) don't belong in the pictures.
    await page.evaluate(() => document.activeElement?.blur());
    await page.waitForTimeout(1500);
    const bar = await page.locator(".ctx-bar").first().boundingBox();
    const chip60 = await page.locator(".ctx-levels .level-chip--active").boundingBox();
    await page.screenshot({
      path: join(dir, "catch-settings.jpg"), ...JPEG,
      clip: { x: bar.x - 8, y: bar.y - 8, width: chip60.x + chip60.width + 16 - bar.x, height: bar.height + 16 },
    });
    // Each card on its own, with its strength row: the page lights them up and swaps the two.
    for (const [i, name] of [[0, "catch-card-base"], [1, "catch-card-rival"]]) {
      const card = cards.nth(i);
      const cBox = await card.boundingBox();
      await shot(card, name);
      const row = card.locator('li:has(img[src*="charge-strength"])').first();
      marks[name === "catch-card-base" ? "baseStrength" : "rivalStrength"] = rel(await row.boundingBox(), cBox);
    }
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
  return marks;
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true }).catch((e) => {
  throw new Error(`Could not launch Chrome at ${CHROME} (set CHROME_PATH): ${e.message}`);
});
// Temp dir beside the output so rename() stays on the same filesystem (no EXDEV).
await mkdir(dirname(OUT), { recursive: true });
const tmp = await mkdtemp(join(dirname(OUT), ".landing-shots-"));
try {
  await seed();
  const marks = {};
  for (const lang of LANGS) {
    await mkdir(join(tmp, lang), { recursive: true });
    marks[lang] = await capture(browser, join(tmp, lang), lang);
  }
  await rm(OUT, { recursive: true, force: true });
  await rename(tmp, OUT);
  await writeFile(MARKS, JSON.stringify(marks, null, 2) + "\n");
  console.log(`Wrote captures to ${OUT}`);
} finally {
  await browser.close();
  await rm(tmp, { recursive: true, force: true });
}
