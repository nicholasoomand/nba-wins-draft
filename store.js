import { Redis } from "@upstash/redis";

// Works with the env var names from either the Upstash or the older Vercel KV integration.
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN,
});

export const TEAM_KEYS = ["ATL","BOS","BKN","CHA","CHI","CLE","DET","IND","MIA","MIL","NYK","ORL","PHI","TOR","WAS",
  "DAL","DEN","GSW","HOU","LAC","LAL","MEM","MIN","NOP","OKC","PHX","POR","SAC","SAS","UTA"];

const parse = v => (typeof v === "string" ? JSON.parse(v) : v);

export async function getState() {
  const [league, standings, hist] = await Promise.all([
    redis.get("league"), redis.get("standings"), redis.hgetall("history"),
  ]);
  const history = Object.values(hist || {}).map(parse)
    .sort((a, b) => (a.date < b.date ? -1 : 1)).slice(-60);
  return { league: parse(league) || null, standings: parse(standings) || null, history };
}

export async function saveStandings(teams, date, source) {
  await redis.set("standings", { asOf: date, updatedAt: new Date().toISOString(), source, teams });
  await redis.hset("history", { [date]: JSON.stringify({ date, teams }) });
}

export function todayPacific() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date());
}

// Pulls regular-season W-L for all 30 teams from ESPN's public standings feed.
export async function fetchStandings() {
  const season = process.env.SEASON || "2027"; // ESPN names a season by its ending year: 2027 = 2026-27
  const r = await fetch(`https://site.api.espn.com/apis/v2/sports/basketball/nba/standings?season=${season}&seasontype=2`);
  if (!r.ok) throw new Error(`ESPN returned ${r.status}`);
  const j = await r.json();
  const MAP = { GS: "GSW", NO: "NOP", NY: "NYK", SA: "SAS", UTAH: "UTA", WSH: "WAS" };
  const teams = {};
  for (const conf of j.children || []) {
    for (const e of conf.standings?.entries || []) {
      const ab = MAP[e.team?.abbreviation] || e.team?.abbreviation;
      const stat = n => Math.round(+(e.stats?.find(s => s.name === n)?.value || 0));
      if (TEAM_KEYS.includes(ab)) teams[ab] = { w: stat("wins"), l: stat("losses") };
    }
  }
  const missing = TEAM_KEYS.filter(k => !teams[k]);
  if (missing.length) throw new Error("Standings feed is missing: " + missing.join(", "));
  return teams;
}
