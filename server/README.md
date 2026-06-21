# Server Development Guide

This backend runs in watch mode with `tsx` and serves the API at `http://localhost:4000/api` by default.

## Prerequisites

- Node.js 20+ or Bun
- MariaDB running locally
- Redis running locally if you want rate limiting backed by Redis

## 1. Install dependencies

Use one package manager only:

```bash
npm install
```

or

```bash
bun install
```

## 2. Configure environment variables

Copy the example env file if you have not created one yet:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Important values in `.env`:

- `PORT=4000`
- `APP_URL=http://localhost:8080`
- `API_PREFIX=/api`
- `DATABASE_URL=mysql://user:password@localhost:3306/leadgen`
- `REDIS_URL=redis://localhost:6379`
- `JWT_ACCESS_SECRET=replace_me`
- `JWT_REFRESH_SECRET=replace_me`
- `BOOTSTRAP_ADMIN_EMAIL=admin@example.com`
- `BOOTSTRAP_ADMIN_PASSWORD=change-me-now`

Minimum setup for local development:

- Make sure `DATABASE_URL` points to a real MariaDB database.
- Set real values for `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`.
- Set an admin email and password you can use locally.
- If Redis is not running, you can leave `REDIS_URL` empty to fall back to in-memory rate limiting.

## 3. Prepare the database

Generate the Prisma client:

```bash
npm run prisma:generate
```

or

```bash
bun run prisma:generate
```

Run development migrations:

```bash
npm run prisma:migrate
```

or

```bash
bun run prisma:migrate
```

If you want seed data:

```bash
npm run prisma:seed
```

or

```bash
bun run prisma:seed
```

That seed command also creates or updates the default super admin using these `.env` values:

- `BOOTSTRAP_ADMIN_EMAIL`
- `BOOTSTRAP_ADMIN_PASSWORD`

## 4. Start the development server

```bash
npm run dev
```

or

```bash
bun run dev
```

That starts:

```bash
tsx watch src/index.ts
```

When the server is up, it listens on:

```text
http://localhost:4000/api
```

## 5. Verify it is running

Open the health route in your browser or API client:

```text
http://localhost:4000/api/health

```

## Stripe 

```text
./stripe.exe listen --forward-to http://localhost:4000/api/billing/webhook
```
copy paste the token u get into .env
```
STRIPE_WEBHOOK_SECRET=token_you_get_from_it
```

## Email Sync

- Reserved mailbox syncing now runs in the backend automatically every minute with `node-cron`.
- Shared mailboxes are auto-reserved to users on first use so replies can be mapped back to the right inbox.
- The rollout plan for the email ownership and quota system is documented in `server/docs/email-automation-plan.md`.

## Useful scripts

- `npm run dev` / `bun run dev` - start the server in watch mode
- `npm run build` / `bun run build` - compile TypeScript to `dist`
- `npm start` / `bun run start` - run the compiled server
- `npm run prisma:generate` / `bun run prisma:generate` - generate Prisma client
- `npm run prisma:migrate` / `bun run prisma:migrate` - create and apply a development migration
- `npm run prisma:deploy` / `bun run prisma:deploy` - apply existing migrations
- `npm run prisma:seed` / `bun run prisma:seed` - seed local data

## Common issues

- `DATABASE_URL is required`: check that `.env` exists and has a valid MariaDB connection string.
- Prisma connection errors: make sure MariaDB is running and the target database exists.
- Redis connection errors: either start Redis locally or clear `REDIS_URL` for local development.
- Port conflicts on `4000`: change `PORT` in `.env` and restart the server.
