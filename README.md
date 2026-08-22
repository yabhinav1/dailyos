# DailyOS

**A personal productivity OS — [dailyos.dpdns.org](https://dailyos.dpdns.org)**

Notes, tasks, projects, calendar, habits, goals, study tracking, analytics, a
focus timer, a doodle canvas and a developer log. Eleven modules over **34
Prisma models in one schema**, so a task can come out of a note and a habit can
roll into a goal without an integration sitting between them.

![Next.js](https://img.shields.io/badge/next.js-16-black)
![React](https://img.shields.io/badge/react-19-black)
![Postgres](https://img.shields.io/badge/db-postgres%20%2F%20neon-black)
![Auth](https://img.shields.io/badge/auth-auth.js%20v5-black)

## What's in it

- **Notes** — folders, search, tags, pinning, full-screen editing and revision
  snapshots. Three editing modes share one note: rich text, a sketch pad, and a
  freeform canvas where you double-click anywhere to drop a text block and drag
  it where you want it.
- **Tasks** — list and kanban views, filters, priorities, due dates.
- **Projects** — per-project workspaces with file attachments.
- **Habits & goals** — streaks and logs that feed the analytics page.
- **Study** — subjects, topics, sessions, and a pomodoro timer with a custom
  alarm sound.
- **Calendar** — month view over events and deadlines.
- **Developer mode** — code snippets with syntax highlighting and an HTTP
  request playground.
- **Music player** — uploaded tracks over GridFS plus Spotify search, with
  Lavalink node management behind an admin role.
- **Guest mode** — notes and doodles that live in `localStorage` until you sign
  in, then migrate into the account.
- **Command palette** — `Cmd`/`Ctrl + K` to move between pages.

Accounts can request a full JSON export by email, to their own address or
another one, and can schedule deletion with a 24-hour window to change their
mind. Signing in during that window blocks the workspace until the choice is
made either way.

## Stack

Next.js 16 (App Router, server actions) · React 19 · TypeScript · Tailwind v4 ·
shadcn/ui · Framer Motion · Zustand · Tiptap · Prisma 7 over Postgres (Neon) ·
MongoDB GridFS for file bytes · Auth.js v5 · nodemailer over ZeptoMail ·
deployed on Vercel behind Cloudflare.

Files live in GridFS rather than Postgres so a large PDF doesn't sit in the row
you query on every page load. Everything else is relational.

## Running it locally

Requires Node 20+, a Postgres database, and a MongoDB cluster if you want file
uploads to work.

```bash
npm install --legacy-peer-deps
cp .env.example .env.local     # then fill it in
npx prisma db push             # create the tables
npm run dev
```

`.env.local` rather than `.env` — `prisma.config.ts` loads that file
explicitly, matching the Next.js convention. Every variable is documented in
`.env.example`; at minimum you need `DATABASE_URL` and `AUTH_SECRET`
(`openssl rand -base64 32`).

Sign-in works three ways — Google, GitHub, or email and password with a
six-digit verification code. The OAuth providers each need a callback URL of
`<NEXT_PUBLIC_APP_URL>/api/auth/callback/<provider>`, and the whole app runs
fine with neither of them configured.

### Checks

No test runner. Three scripts cover the logic where being wrong is expensive:

```bash
node scripts/test-otp.mjs              # code generation and comparison
node scripts/test-freeform-blocks.mjs  # canvas serialisation
node scripts/test-avatar-data-url.mjs  # avatar data-URL parsing
```

## Deploying

Import to Vercel, set the variables from `.env.example`, deploy.

Two that are easy to miss:

- **`CRON_SECRET`** — `vercel.json` schedules `/api/cron/purge-accounts` daily
  to remove accounts past their deletion deadline. Without this the route
  refuses to run rather than running unauthenticated, so nothing is purged.
- **`sslmode=verify-full`** in `DATABASE_URL` — Neon hands you `sslmode=require`
  when you copy a connection string, and `pg` v9 will reinterpret that with
  weaker guarantees. Neon presents a publicly trusted certificate, so
  verify-full works as-is.

## Notes for anyone reading the code

Data loading sits inside the effect that needs it, with a cancelled flag
guarding every `setState` after the await, and a reload token instead of a
callable fetcher. That is what stops a slow response landing after a newer one
on the pages where filters change mid-request.

Auth is layered on purpose. `proxy.ts` does an optimistic session-cookie check
to keep prefetches off the database, and the `(dashboard)` layout resolves the
real session before any page renders, so a forged cookie that gets past the
proxy still gets nothing.
