# Browser tests

Each file in `tests/` drives the real app in Chromium and checks the database
and outbox afterwards. CI runs them all on every push
(`.github/workflows/e2e.yml`); to run them locally:

```bash
# Throwaway services (once)
docker run -d --name dailyos-pg -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=dailyos -p 54329:5432 postgres:17-alpine
docker run -d --name dailyos-mongo -p 27019:27017 mongo:7.0.14
docker run -d --name dailyos-mail -p 1025:1025 -p 8025:8025 axllent/mailpit:v1.21
```

`.env.local` pointing at them:

```bash
DATABASE_URL="postgresql://postgres:dev@localhost:54329/dailyos"
AUTH_SECRET="local-dev-secret-not-for-production-0123456789"
NEXT_PUBLIC_APP_URL="http://localhost:3100"
CRON_SECRET="local-cron"
SCHEDULER_SECRET="scheduler-test"
MONGODB_URI="mongodb://localhost:27019/dailyos"
SMTP_HOST="localhost"
SMTP_PORT="1025"
SMTP_SECURE="false"
SMTP_USER="test"
SMTP_PASSWORD="test"
```

Then:

```bash
npx prisma migrate deploy
npx next build && npx next start -p 3100   # in one terminal
npm run test:e2e                            # in another; or: node e2e/run.mjs tasks note-sharing
```

The harness refuses hosted database URLs, and the tests never clean up after
themselves: use a database you can throw away. Failure screenshots go to
`e2e/.artifacts/`.

Not covered here:

- **Push notifications** need a real (headed) Chrome profile to register with
  Google's push service, which CI can't provide. Test by hand in Settings ›
  Preferences.
- **Claude** (`tests/claude-provider.mjs`) skips itself unless the app was
  started against `mock-claude.mjs`; see the comment at the top of that file.
