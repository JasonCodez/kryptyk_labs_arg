Render deployment checklist

This file contains step-by-step commands and notes to deploy this Next.js app to Render with a Render Managed Postgres database.

1) Local validation (switch to PostgreSQL)
- We changed `prisma/schema.prisma` to use `provider = "postgresql"`.
- Start a local Postgres to test locally:
```bash
docker run --name local-postgres -e POSTGRES_PASSWORD=devpass -p 5432:5432 -d postgres:15
export DATABASE_URL='postgresql://postgres:devpass@127.0.0.1:5432/postgres?schema=public'
```
- Generate Prisma client and run migrate+seed locally:
```bash
npx prisma generate
npx prisma migrate dev --name init
npm run seed
```
Fix issues locally until migrations and seed succeed.

2) Commit and push migrations
```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "chore(prisma): switch to postgresql and add migrations"
git push origin main
```

3) Create a Render account and connect your GitHub repo
- Sign in to https://render.com and connect the `JasonCodez/kryptyk_labs_arg` repository.

4) Provision a Render Managed Postgres
- Render → Databases → New Database → Postgres → create a new DB (starter).
- After creation, copy the `DATABASE_URL` from Render (it looks like `postgresql://user:pass@host:5432/dbname`).

5) Create a Web Service on Render
- Render → New → Web Service → Select repo → branch `main`.
- Build Command: `npm ci && npm run build`
- Start Command: `npm run start`
- Environment Variables (set in Render dashboard, do NOT commit to repo):
  - `DATABASE_URL` = Render Postgres URL (from step 4). Add `?schema=public` if missing.
  - `NEXTAUTH_SECRET` = secure random hex (generate locally: `openssl rand -hex 32`).
  - `NEXTAUTH_URL` = `https://<your-render-service-url-or-custom-domain>`
  - `NODE_ENV` = `production`
- Create service and deploy.

6) Run Prisma migrations and seed on Render
- Use Render's Dashboard → Shell for the service, or create and run a one-off Job.
- From shell or job run:
```bash
npx prisma migrate deploy
npm run seed
```
(Render runs these commands using the same environment variables you set in the service.)

7) Add your domain (keep domain at IONOS)
- In Render Service → Settings → Custom Domains → Add domain.
- Render will provide DNS records to add in IONOS (A record or CNAME + TXT for verification).
- In IONOS DNS zone add the records Render shows. Keep MX records unchanged if you use email with IONOS.

8) Final
- Confirm app works at Render URL or your domain.
- Monitor logs and adjust resources if needed.

If you want, I can:
- Prepare a PR that updates `prisma/schema.prisma` (already done) and adds helpful scripts (start already updated).
- Create a Render job YAML for the migrate+seed step (not applied automatically).
- Walk you through the Render UI steps interactively if you paste Render dashboard outputs or allow me to prepare commands for you to paste.

