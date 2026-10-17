import { fetchStandings, saveStandings, todayPacific } from "../lib/store.js";

// Runs daily from vercel.json. Safe to open by hand too: it only refreshes win totals.
export default async function handler(req, res) {
  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const teams = await fetchStandings();
    const date = todayPacific();
    await saveStandings(teams, date, "auto");
    res.status(200).json({ ok: true, date, teams });
  } catch (e) {
    res.status(502).json({ error: String(e.message || e) });
  }
}
