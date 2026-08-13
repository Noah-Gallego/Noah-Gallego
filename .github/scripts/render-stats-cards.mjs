// Renders Noah's GitHub stats + top-languages cards as static SVGs using the
// anuraghazra/github-readme-stats source checked out at GRS_DIR (/tmp/grs in
// CI). The cards are committed to this repository, so the README never depends
// on a third-party image host at render time.
// The token comes from PAT_1, the env var github-readme-stats' retryer reads.
import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { assertCardSvg } from "./verify-cards.mjs";

const grsDir = process.env.GRS_DIR ?? "/tmp/grs";
// file:// URLs: the correct way to import by absolute path across platforms.
const grs = (file) => pathToFileURL(`${grsDir}/${file}`).href;

const { fetchStats } = await import(grs("src/fetchers/stats.js"));
const { fetchTopLanguages } = await import(grs("src/fetchers/top-languages.js"));
const { renderStatsCard } = await import(grs("src/cards/stats.js"));
const { renderTopLanguages } = await import(grs("src/cards/top-languages.js"));

const username = "noah-gallego";
const FONT_FAMILY = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Ubuntu, sans-serif";
const normalizeCardFonts = (svg) => svg.replace(
  /(?:'Segoe UI'|"Segoe UI"),\s*Ubuntu,\s*(?:(?:'Helvetica Neue'|"Helvetica Neue"),\s*)?Sans-Serif/g,
  FONT_FAMILY,
);

const stats = await fetchStats(username);
const statsSvg = normalizeCardFonts(renderStatsCard(stats, {
  show_icons: true,
  theme: "tokyonight",
  hide_border: true,
}));

// (username, exclude_repo, size_weight, count_weight) -- the weights are
// numbers; passing arrays makes every language weigh exactly 1.
const langs = await fetchTopLanguages(username, [], 1, 0);
const langsSvg = normalizeCardFonts(renderTopLanguages(langs, {
  layout: "compact",
  theme: "tokyonight",
  hide_border: true,
  langs_count: 8,
}));

// Validate both cards before writing either, so a failed fetch can never
// leave a half-refreshed pair on disk for the commit step to pick up.
assertCardSvg("profile/stats.svg", statsSvg);
assertCardSvg("profile/top-langs.svg", langsSvg);

await mkdir("profile", { recursive: true });
await writeFile("profile/stats.svg", statsSvg);
console.log("wrote profile/stats.svg", statsSvg.length, "bytes");
await writeFile("profile/top-langs.svg", langsSvg);
console.log("wrote profile/top-langs.svg", langsSvg.length, "bytes");
