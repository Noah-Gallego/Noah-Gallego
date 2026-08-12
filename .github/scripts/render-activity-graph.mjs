// Generate a static contribution graph from GitHub's contribution calendar
// (GraphQL). These are the daily totals GitHub itself reports as
// contributions; the public events feed this used to read is a different
// number -- it counts event types that are not contributions (forks, issue
// comments, one entry per push) and omits private work entirely.
// The graph is committed to this profile repository, so README rendering has
// no dependency on a third-party activity-graph service.
import { mkdir, writeFile } from "node:fs/promises";
import { assertCardSvg } from "./verify-cards.mjs";

const username = "Noah-Gallego";

// Build the plotted window first: the calendar query is bounded by exactly the
// days that get rendered.
const today = new Date();
const days = [];
for (let index = 104; index >= 0; index -= 1) {
  const date = new Date(today);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - index);
  const key = date.toISOString().slice(0, 10);
  days.push({ key, count: 0 });
}

// Unlike the REST events feed, GitHub's GraphQL API has no anonymous access,
// so a missing token is a hard failure rather than a degraded run that would
// commit a flat-zero graph.
const token = process.env.PAT_1 || process.env.GITHUB_TOKEN;
if (!token) {
  throw new Error("activity graph: PAT_1 or GITHUB_TOKEN is required; the GitHub GraphQL API rejects unauthenticated requests");
}
const query = `query($login: String!, $from: DateTime!, $to: DateTime!) {
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
const response = await fetch("https://api.github.com/graphql", {
  method: "POST",
  headers: {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "Noah-Gallego-profile-cards",
  },
  body: JSON.stringify({
    query,
    variables: {
      login: username,
      from: `${days[0].key}T00:00:00Z`,
      to: `${days[days.length - 1].key}T23:59:59Z`,
    },
  }),
});
if (!response.ok) {
  throw new Error(`GitHub GraphQL API: HTTP ${response.status} ${response.statusText}`);
}
const payload = await response.json().catch(() => {
  throw new Error("GitHub GraphQL API: response body was not JSON");
});
// GraphQL reports failures as a 200 carrying an `errors` array, so the status
// check above is not enough on its own.
if (payload.errors?.length) {
  throw new Error(`GitHub GraphQL API: ${payload.errors.map((error) => error.message).join("; ")}`);
}
const calendar = payload.data?.user?.contributionsCollection?.contributionCalendar;
if (!calendar) {
  throw new Error(`GitHub GraphQL API: response contained no contribution calendar for ${username}`);
}
// The calendar comes back as whole weeks, so it can overhang either end of the
// window; flatten it and let the lookup drop days outside the plot.
const contributionDays = (calendar.weeks ?? []).flatMap((week) => week.contributionDays ?? []);
if (!contributionDays.length) {
  throw new Error(`GitHub GraphQL API: contribution calendar for ${username} contained no days`);
}
const byDay = new Map(days.map((day) => [day.key, day]));
for (const { date, contributionCount } of contributionDays) {
  const day = byDay.get(date);
  if (day) day.count = contributionCount;
}
const max = Math.max(1, ...days.map((day) => day.count));
const width = 1200;
const height = 320;
const left = 62;
const right = 18;
const top = 58;
const bottom = 46;
const plotWidth = width - left - right;
const plotHeight = height - top - bottom;
const points = days.map((day, index) => {
  const x = left + (index / (days.length - 1)) * plotWidth;
  const y = top + plotHeight - (day.count / max) * plotHeight;
  return `${x.toFixed(1)},${y.toFixed(1)}`;
}).join(" ");
const area = `${left},${top + plotHeight} ${points} ${left + plotWidth},${top + plotHeight}`;
const labels = [0, 1, 2, 3].map((level) => {
  const y = top + plotHeight - (level / 3) * plotHeight;
  const value = Math.round((max * level) / 3);
  return `<line x1="${left}" y1="${y}" x2="${left + plotWidth}" y2="${y}" stroke="#30363d"/><text x="${left - 12}" y="${y + 5}" text-anchor="end" fill="#8b949e" font-size="13">${value}</text>`;
}).join("");
const xLabels = [0, 35, 70, 104].map((index) => {
  const x = left + (index / (days.length - 1)) * plotWidth;
  return `<text x="${x}" y="${height - 14}" text-anchor="middle" fill="#8b949e" font-size="13">${days[index].key.slice(5)}</text>`;
}).join("");
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc"><title id="title">Noah Gallego's Contribution Graph</title><desc id="desc">GitHub contributions over the last 105 days.</desc><rect width="100%" height="100%" rx="10" fill="#1a1b27"/><text x="${width / 2}" y="30" text-anchor="middle" fill="#70a5fd" font-size="20" font-weight="600">Noah Gallego's Contribution Graph</text>${labels}<polygon points="${area}" fill="#70a5fd" fill-opacity=".16"/><polyline points="${points}" fill="none" stroke="#70a5fd" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>${xLabels}<text x="${width / 2}" y="${height - 1}" text-anchor="middle" fill="#8b949e" font-size="13">Days</text></svg>`;
assertCardSvg("profile/activity.svg", svg);
await mkdir("profile", { recursive: true });
await writeFile("profile/activity.svg", svg);
console.log("wrote profile/activity.svg", svg.length, "bytes");
