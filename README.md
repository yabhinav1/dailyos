# DailyOS

**A personal productivity OS — [dailyos.dpdns.org](https://dailyos.dpdns.org)**

Notes, tasks, projects, calendar, habits, goals, study tracking, analytics, a
focus timer, a doodle canvas and a developer log. Twelve modules over **35
Prisma models in one schema**, so a task can come out of a note and a habit can
roll into a goal without an integration sitting between them.

![Next.js](https://img.shields.io/badge/next.js-16-black)
![React](https://img.shields.io/badge/react-19-black)
![Postgres](https://img.shields.io/badge/db-postgres%20%2F%20neon-black)
![Auth](https://img.shields.io/badge/auth-auth.js%20v5-black)

## What's in it

- **Today** — the signed-in home: tasks due and overdue, habits to tick,
  today's events, focus minutes and the goals closest to their deadline.
- **Notes** — folders, search, #hashtags, pinning, full-screen editing,
  images and voice notes (kept in file storage), and version history with
  who changed what. Three editing modes share one
  note: rich text, a sketch pad, and a freeform canvas where you double-click
  anywhere to drop a text block. "Turn into Tasks" pulls action items out of a
  note for review, using Claude (or OpenAI) when a key is configured.
- **Sharing** — notes and projects, Google Docs-style: invite people by email
  as viewers or editors, or open the link to anyone. Note edits sync between
  open copies within a few seconds and simultaneous edits ask before
  overwriting; a shared project's editors can tick and add its tasks.
- **Tasks** — list and kanban views, filters, tags, priorities, due dates,
  subtasks, comments, and repeats (daily, weekdays, weekly, monthly, yearly).
- **Projects** — per-project workspaces with file attachments.
- **Habits & goals** — daily, weekly or monthly habits with streaks counted in
  your own time zone; goals that track their linked tasks automatically.
- **Study** — subjects, topics, sessions, and a pomodoro timer with a custom
  alarm sound.
- **Calendar** — month and week views over events and task due dates,
  repeating events, and an .ics export for Google Calendar, Outlook or Apple.
- **Developer mode** — coding projects with an issue tracker and release log,
  code snippets with syntax highlighting, and an HTTP request playground.
- **Reminders** — at 8am in your own time zone, an email, an in-app
  notification and (if you turn it on) a phone or desktop push notification
  with what's due, overdue and on the calendar.
- **Trash** — deleted notes, tasks and projects stay restorable for 30 days.
- **Music player** — uploaded tracks over GridFS plus Spotify search, with
  Lavalink node management behind an admin role.
- **Guest mode** — notes and doodles that live in `localStorage` until you sign
  in, then migrate into the account.
- **Command palette** — `Cmd`/`Ctrl + K` searches everything and jumps
  between pages.
- **Offline** — installable; saves made offline go through on reconnect.

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
npx prisma migrate deploy      # create the tables
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

`npm test` runs the scripts that cover the logic where being wrong is
expensive, and CI (`.github/workflows/ci.yml`) runs them with the type-check,
lint and a build on every push:

```bash
node scripts/test-otp.mjs              # code generation and comparison
node scripts/test-freeform-blocks.mjs  # canvas serialisation
node scripts/test-avatar-data-url.mjs  # avatar data-URL parsing
node scripts/test-dates.mjs            # time zones, streaks, recurrence
```

`npm run test:e2e` drives the real app in Chromium through 17 scenarios
(sharing, media, reminders, offline, phone layout and the rest); `.github/workflows/e2e.yml`
runs them on every push against throwaway Postgres, MongoDB and Mailpit. See
`e2e/README.md` to run them locally.

## Deploying

Import to Vercel, set the variables from `.env.example`, deploy.

Worth knowing:

- **Schema changes ship as migrations** in `prisma/migrations/`. Production
  deploys run `prisma migrate deploy` before building (`vercel.json`), using
  `DIRECT_URL`: Neon's non-pooled endpoint, since migrations take locks the
  pooler won't grant. Preview deploys never migrate. Make a new one with
  `npx prisma migrate dev --name <what>` against a local database.
- **`CRON_SECRET`** — `vercel.json` schedules two daily jobs:
  `/api/cron/purge-accounts` (accounts past their deletion deadline, and trash
  older than 30 days) and `/api/cron/reminders`. Without the secret both
  refuse to run rather than running unauthenticated.
- **Reminders at 8am local time** need `.github/workflows/reminders.yml`,
  which calls the reminders endpoint hourly: set the same random
  `SCHEDULER_SECRET` in Vercel and as a GitHub repository secret. Without it
  the daily Vercel cron still sends them, at 8am India time.
- **Push notifications** need `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and
  `VAPID_PRIVATE_KEY` (`npx web-push generate-vapid-keys`).
- **`sslmode=verify-full`** in `DATABASE_URL` — Neon hands you `sslmode=require`
  when you copy a connection string, and `pg` v9 will reinterpret that with
  weaker guarantees. Neon presents a publicly trusted certificate, so
  verify-full works as-is.

## Notes for anyone reading the code

Data loading sits inside the effect that needs it, with a cancelled flag
guarding every `setState` after the await, and a reload token instead of a
callable fetcher. That is what stops a slow response landing after a newer one
on the pages where filters change mid-request.

Dates that mean a whole day (due dates, habit check-ins) are stored as UTC
midnight of that day and compared as `YYYY-MM-DD` keys in the user's own zone
(`src/lib/dates.ts`); the server runs in UTC, so `new Date()` there is the
wrong day for half the planet for part of every day.

Auth is layered on purpose. `proxy.ts` does an optimistic session-cookie check
to keep prefetches off the database, and the `(dashboard)` layout resolves the
real session before any page renders, so a forged cookie that gets past the
proxy still gets nothing.
