import { getState } from "../lib/store.js";

export default async function handler(req, res) {
  try {
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json(await getState());
  } catch (e) {
    res.status(500).json({ error: "Database not reachable. Check the Upstash Redis setup in Vercel." });
  }
}
