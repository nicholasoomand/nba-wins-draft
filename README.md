# NBA Wins Draft

Snake-draft NBA teams with friends; the leaderboard tracks whose teams win the most.
Static page (`index.html`) + Vercel Functions (`/api`) + Upstash Redis for storage.

## Deploy (about 5 minutes)

1. **GitHub:** create a new repository (e.g. `nba-wins-draft`) and upload every file in this folder,
   keeping the `api` and `lib` folders.
2. **Vercel:** go to vercel.com → Add New → Project → import that repository.
   Framework preset: **Other**. Leave build settings empty. Click **Deploy**.
3. **Database:** in the project, open **Storage** → **Create Database** → **Upstash (Redis)** → free plan →
   connect it to this project. This adds the database keys automatically.
4. **Passwords:** Settings → **Environment Variables**, add:
   - `LEAGUE_PASSWORD` — the one you give your friends (make picks, start the draft, undo)
   - `ADMIN_PASSWORD` — only for you (reset the league, edit wins by hand)
5. **Redeploy:** Deployments → the latest one → ⋯ → **Redeploy**, so the new settings take effect.
6. **First standings:** open `https://<your-site>.vercel.app/api/cron-standings` once.
   After that it runs automatically every morning (~7 AM Pacific).

Share `https://<your-site>.vercel.app` with your friends. Anyone with the link can watch;
picks need the league password.

## Notes
- Standings come from ESPN's public NBA standings feed. If it ever fails, unlock with the
  admin password and use **All Teams → Edit wins by hand**.
- Next season: set the env var `SEASON` to `2028` and update the `LINE` numbers in `index.html`.
