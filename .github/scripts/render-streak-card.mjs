// Generate a static streak card from GitHub's GraphQL contribution calendar.
//
// Replaces DenverCoder1/github-readme-streak-stats: that action boots a
// third-party PHP container on every run and answers an API failure with an
// error *card* rather than a non-zero exit, so a bad run could quietly commit
// "Something went wrong" artwork over profile/streak.svg. Here the calendar is
// read directly, every failure throws, and the card is only written after
// assertCardSvg accepts it.
import { realpathSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { assertCardSvg } from "./verify-cards.mjs";

const LOGIN = "Noah-Gallego";
const OUTPUT = "profile/streak.svg";
const FONT_FAMILY = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Ubuntu, sans-serif";

// Tokyo Night, matching profile/stats.svg and profile/activity.svg.
const COLORS = {
  bg: "#1a1b27",
  ring: "#70a5fd",
  sideNum: "#70a5fd",
  sideLabel: "#38bdae",
  currentNum: "#38bdae",
  currentLabel: "#bf91f3",
  dates: "#8b949e",
  divider: "#30363d",
  fire: "#bf91f3",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const QUERY = `query($login: String!, $from: DateTime!, $to: DateTime!) {
  user(login: $login) {
    contributionsCollection(from: $from, to: $to) {
      contributionCalendar {
        weeks {
          contributionDays {
            date
            contributionCount
          }
        }
      }
    }
  }
}`;

/**
 * UTC window covering the last 365 days, inclusive of today.
 * GitHub rejects a contributionsCollection range longer than one year, so the
 * span is anchored to UTC midnight and kept a day short of the limit.
 * @param {Date} now
 */
export function contributionPeriod(now = new Date()) {
  const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return {
    from: new Date(midnight - 364 * 86_400_000),
    to: now,
    // Calendar weeks can run past `to`; those days are always empty and would
    // read as "today has no contributions", ending a live streak a day early.
    today: new Date(midnight).toISOString().slice(0, 10),
  };
}

/**
 * Fetch contributionDays for `login` over `period`, oldest first.
 * @param {string} token GitHub token; the contributions API rejects anonymous calls.
 * @param {ReturnType<typeof contributionPeriod>} period
 * @param {string} login
 */
export async function fetchContributionDays(token, period, login = LOGIN) {
  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "Noah-Gallego-profile-cards",
    },
    body: JSON.stringify({
      query: QUERY,
      variables: { login, from: period.from.toISOString(), to: period.to.toISOString() },
    }),
  });
  if (!response.ok) {
    throw new Error(`GitHub GraphQL API: HTTP ${response.status} ${response.statusText}`);
  }
  const payload = await response.json();
  if (payload.errors?.length) {
    const detail = payload.errors.map((error) => error?.message ?? "unknown error").join("; ");
    throw new Error(`GitHub GraphQL API: ${detail}`);
  }
  const calendar = payload.data?.user?.contributionsCollection?.contributionCalendar;
  if (!calendar) {
    throw new Error(`GitHub GraphQL API: no contribution calendar in response for ${login}`);
  }
  const days = (calendar.weeks ?? [])
    .flatMap((week) => week?.contributionDays ?? [])
    .map((day) => {
      if (typeof day?.date !== "string" || typeof day?.contributionCount !== "number") {
        throw new Error("GitHub GraphQL API: contribution day missing date or contributionCount");
      }
      return { date: day.date, count: day.contributionCount };
    })
    .filter((day) => day.date <= period.today)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  if (!days.length) {
    throw new Error(`GitHub GraphQL API: empty contribution calendar for ${login}`);
  }
  return days;
}

/**
 * Total contributions plus current and longest streak over `days`.
 * @param {{date: string, count: number}[]} days Ascending contribution days.
 */
export function summarizeStreaks(days) {
  const total = days.reduce((sum, day) => sum + day.count, 0);

  let longest = { length: 0, start: null, end: null };
  let run = 0;
  let runStart = null;
  for (const day of days) {
    if (day.count <= 0) {
      run = 0;
      continue;
    }
    run += 1;
    if (run === 1) runStart = day.date;
    if (run > longest.length) longest = { length: run, start: runStart, end: day.date };
  }

  // Walk back from the newest day. Today being empty does not break a streak
  // that was alive yesterday -- the day is not over yet.
  let index = days.length - 1;
  if (days[index].count <= 0) index -= 1;
  const current = { length: 0, start: null, end: index >= 0 ? days[index].date : null };
  for (; index >= 0 && days[index].count > 0; index -= 1) {
    current.length += 1;
    current.start = days[index].date;
  }
  if (current.length === 0) {
    current.end = null;
  }

  return { total, range: { start: days[0].date, end: days.at(-1).date }, current, longest };
}

/** Render "2025-08-12" as "Aug 12, 2025". */
function formatDate(date) {
  const [year, month, day] = date.split("-");
  return `${MONTHS[Number(month) - 1]} ${Number(day)}, ${year}`;
}

/** Build the card. Values come from summarizeStreaks(). */
export function buildStreakSvg({ total, range, current, longest }) {
  const number = (value) => value.toLocaleString("en-US");
  const [leftX, middleX, rightX] = [82.5, 247.5, 412.5];
  const currentDates = current.length ? `${formatDate(current.start)} - Present` : "\u2014";
  const longestDates = longest.length
    ? `${formatDate(longest.start)} - ${formatDate(longest.end)}`
    : "\u2014";
  const side = (x, value, label, dates) =>
    `<text x="${x}" y="84" fill="${COLORS.sideNum}" font-size="28" font-weight="700">${value}</text>` +
    `<text x="${x}" y="112" fill="${COLORS.sideLabel}" font-size="14" font-weight="600">${label}</text>` +
    `<text x="${x}" y="136" fill="${COLORS.dates}" font-size="12">${dates}</text>`;
  const desc =
    `Total contributions ${number(total)} from ${formatDate(range.start)} to ${formatDate(range.end)}. ` +
    `Current streak ${number(current.length)} days. Longest streak ${number(longest.length)} days.`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="495" height="195" viewBox="0 0 495 195" role="img" aria-labelledby="title desc">
<title id="title">Noah Gallego's GitHub Streak</title>
<desc id="desc">${desc}</desc>
<rect width="100%" height="100%" rx="10" fill="${COLORS.bg}"/>
<g font-family="${FONT_FAMILY}" text-anchor="middle">
<line x1="165" y1="28" x2="165" y2="167" stroke="${COLORS.divider}"/>
<line x1="330" y1="28" x2="330" y2="167" stroke="${COLORS.divider}"/>
${side(leftX, number(total), "Total Contributions", `${formatDate(range.start)} - ${formatDate(range.end)}`)}
<circle cx="${middleX}" cy="82" r="40" fill="none" stroke="${COLORS.ring}" stroke-width="5"/>
<rect x="234" y="20" width="27" height="27" fill="${COLORS.bg}"/>
<g transform="translate(${middleX} 33)">
<path d="M0 -13C3.2 -7.2 8.5 -4.6 8.5 1.6C8.5 7.6 4.7 12 0 12C-4.7 12 -8.5 7.6 -8.5 1.6C-8.5 -2.4 -5.6 -4.6 -4.3 -8.4C-2.8 -5.2 -0.4 -4.8 0.6 -6.9C1.6 -9 0.9 -11.2 0 -13Z" fill="${COLORS.fire}"/>
<path d="M0 -1.5C1.8 1.6 4.6 3.2 4.6 6.1C4.6 9.2 2.5 11.3 0 11.3C-2.5 11.3 -4.6 9.2 -4.6 6.1C-4.6 4 -3 2.6 -2 0.4C-1.2 2 -0.4 1.4 0 -1.5Z" fill="${COLORS.bg}"/>
</g>
<text x="${middleX}" y="92" fill="${COLORS.currentNum}" font-size="28" font-weight="700">${number(current.length)}</text>
<text x="${middleX}" y="140" fill="${COLORS.currentLabel}" font-size="14" font-weight="600">Current Streak</text>
<text x="${middleX}" y="162" fill="${COLORS.dates}" font-size="12">${currentDates}</text>
${side(rightX, number(longest.length), "Longest Streak", longestDates)}
</g>
</svg>`;
}

/** Fetch, render, validate, and write profile/streak.svg. */
export async function renderStreakCard() {
  // Same precedence as the other renderers; GraphQL contributions are not
  // readable anonymously, so a missing token is a hard failure, not a warning.
  const token = process.env.PAT_1 || process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("missing PAT_1 or GITHUB_TOKEN: the GraphQL contributions API requires a token");
  }
  const period = contributionPeriod();
  const days = await fetchContributionDays(token, period);
  const svg = buildStreakSvg(summarizeStreaks(days));
  assertCardSvg(OUTPUT, svg);
  await mkdir("profile", { recursive: true });
  await writeFile(OUTPUT, svg);
  console.log(`wrote ${OUTPUT}`, svg.length, "bytes");
}

// realpathSync: node resolves symlinks in import.meta.url but not in argv[1],
// so a plain comparison would silently skip the render when the checkout sits
// behind a symlinked path.
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  await renderStreakCard();
}
