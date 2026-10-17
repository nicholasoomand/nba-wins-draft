import { timingSafeEqual } from "node:crypto";
import { redis, getState, saveStandings, TEAM_KEYS } from "../lib/store.js";

const same = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
};
const fail = (res, status, error, extra = {}) => res.status(status).json({ error, ...extra });

export default async function handler(req, res) {
  if (req.method !== "POST") return fail(res, 405, "Use POST.");
  const LP = process.env.LEAGUE_PASSWORD, AP = process.env.ADMIN_PASSWORD;
  if (!LP || !AP) return fail(res, 500, "The site owner needs to set LEAGUE_PASSWORD and ADMIN_PASSWORD in Vercel.");

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const { action, password = "" } = body;
  const role = same(password, AP) ? "admin" : same(password, LP) ? "player" : null;
  if (!role) return fail(res, 401, "Wrong password.");
  if (action === "check") return res.json({ ok: true, role });
  if ((action === "reset" || action === "wins") && role !== "admin") {
    return fail(res, 403, "Only the commissioner can do that.");
  }

  // One change at a time, so two people can't grab the same pick.
  const locked = await redis.set("lock", "1", { nx: true, px: 5000 });
  if (!locked) return fail(res, 409, "Another change is saving. Try again in a second.");
  try {
    let league = await redis.get("league");
    if (typeof league === "string") league = JSON.parse(league);

    if (action === "setup") {
      if (league) return fail(res, 409, "A league already exists.", { state: await getState() });
      const players = (body.players || []).map(p => String(p).trim().slice(0, 24)).filter(Boolean);
      if (players.length < 2 || players.length > 10) return fail(res, 400, "Use 2 to 10 players.");
      if (new Set(players.map(p => p.toLowerCase())).size !== players.length) return fail(res, 400, "Each player needs a different name.");
      const rounds = players.length > 6 ? 3 : 4; // everyone drafts the same number of teams
      await redis.set("league", { players, rounds, picks: [], status: "drafting", season: "2026-27", createdAt: new Date().toISOString() });

    } else if (action === "pick") {
      if (!league || league.status !== "drafting") return fail(res, 409, "The draft isn't open.", { state: await getState() });
      if (body.expected !== league.picks.length) return fail(res, 409, "The board changed. Here's the latest.", { state: await getState() });
      const team = String(body.team || "");
      if (!TEAM_KEYS.includes(team)) return fail(res, 400, "Unknown team.");
      if (league.picks.some(p => p.t === team)) return fail(res, 409, "That team was just taken.", { state: await getState() });
      const n = league.players.length, idx = league.picks.length, round = Math.floor(idx / n), pos = idx % n;
      // Snake with third-round reversal: R1 1→N, R2 N→1, R3 N→1, R4 1→N
      const forward = round === 0 || (round >= 3 && round % 2 === 1);
      const player = forward ? pos : n - 1 - pos;
      league.picks.push({ p: player, t: team, at: new Date().toISOString() });
      league.status = league.picks.length >= n * league.rounds ? "complete" : "drafting";
      await redis.set("league", league);

    } else if (action === "undo") {
      if (!league || !league.picks.length) return fail(res, 409, "There's no pick to undo.", { state: await getState() });
      if (body.expected !== league.picks.length) return fail(res, 409, "The board changed. Here's the latest.", { state: await getState() });
      league.picks.pop();
      league.status = "drafting";
      await redis.set("league", league);

    } else if (action === "reset") {
      await redis.del("league");

    } else if (action === "wins") {
      const date = /^\d{4}-\d{2}-\d{2}$/.test(body.date || "") ? body.date : new Date().toISOString().slice(0, 10);
      const teams = {};
      for (const k of TEAM_KEYS) {
        const w = +body.teams?.[k]?.w, l = +body.teams?.[k]?.l;
        if (!Number.isInteger(w) || !Number.isInteger(l) || w < 0 || l < 0 || w + l > 82) return fail(res, 400, `Check the record for ${k}.`);
        teams[k] = { w, l };
      }
      await saveStandings(teams, date, "manual");

    } else {
      return fail(res, 400, "Unknown action.");
    }
    return res.json({ ok: true, role, state: await getState() });
  } catch (e) {
    return fail(res, 500, "Couldn't save. Try again.");
  } finally {
    await redis.del("lock");
  }
}
