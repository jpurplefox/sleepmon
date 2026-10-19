// Post-build: writes the prerendered landing and its FAQ data into dist/index.html (ADR-0013).
import { readFileSync, writeFileSync } from "node:fs";

const INDEX = new URL("../dist/index.html", import.meta.url);
const ROOT = '<div id="root"></div>';
const HEAD_END = "</head>";

function fail(reason) {
  console.error(`prerender failed: ${reason}`);
  process.exit(1);
}

const { render } = await import(new URL("../dist-server/entry-server.js", import.meta.url).href);
const { html, jsonLd } = render();
const page = readFileSync(INDEX, "utf8");
if (!html) fail("the landing rendered empty");
if (!page.includes(ROOT) || !page.includes(HEAD_END)) fail("dist/index.html lacks its empty #root or </head>");

// Replacer functions, so a "$" in the markup is never read as a replacement pattern.
const out = page
  .replace(ROOT, () => `<div id="root">${html}</div>`)
  .replace(HEAD_END, () => `  <script type="application/ld+json">${jsonLd}</script>\n  ${HEAD_END}`);
writeFileSync(INDEX, out);
console.log(`prerendered / (${html.length} chars of HTML)`);
