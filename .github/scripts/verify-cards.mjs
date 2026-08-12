// Validation shared by the card renderers and the workflow's verify step.
//
// The upstream renderers answer a failed API call with an error *card* rather
// than a non-zero exit, so an SVG has to be inspected before it is written or
// committed. Without this, a rate-limited run silently replaces the README
// cards with "Something went wrong" artwork.
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export const CARDS = [
  "profile/stats.svg",
  "profile/top-langs.svg",
  "profile/streak.svg",
  "profile/activity.svg",
];

// Strings emitted only by the upstream error paths:
// github-readme-stats src/common/error.js and github-readme-streak-stats
// generateErrorCard() (the "Error lable" comment is upstream's typo).
const ERROR_MARKERS = [
  /Something went wrong/i,
  /Maximum retries exceeded/i,
  /Please try again later/i,
  /env variable called PAT_1/i,
  /no GitHub token/i,
  /Could not (?:fetch|find) a? ?user/i,
  /Bad credentials/i,
  /rate[ -]?limit/i,
  /Error lable/i,
  /No contributions found/i,
  /Invalid username/i,
];

/**
 * Throw unless `svg` is a complete card with no upstream error marker.
 * @param {string} name Card name used in error messages.
 * @param {string} svg Rendered SVG markup.
 */
export function assertCardSvg(name, svg) {
  const body = typeof svg === "string" ? svg.trim() : "";
  if (body.length < 500) {
    throw new Error(`${name}: rendered card is empty or truncated (${body.length} bytes)`);
  }
  if (!/^(?:<\?xml[^>]*\?>\s*)?<svg[\s>]/.test(body) || !body.includes("</svg>")) {
    throw new Error(`${name}: rendered card is not a complete SVG document`);
  }
  const marker = ERROR_MARKERS.find((pattern) => pattern.test(body));
  if (marker) {
    throw new Error(`${name}: rendered card contains provider error marker ${marker}`);
  }
}

/** Validate every committed card on disk. */
export async function verifyCardFiles(paths = CARDS) {
  for (const path of paths) {
    assertCardSvg(path, await readFile(path, "utf8"));
    console.log(`ok ${path}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await verifyCardFiles();
}
