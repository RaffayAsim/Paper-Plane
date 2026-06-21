# Quantum Arc LeadGen

Custom lead-generation SaaS with:

- React + Vite frontend
- Node.js + Express backend
- MySQL + Prisma
- JWT auth with RBAC
- Redis-backed rate limiting/cache support
- SMTP outbound email
- IMAP inbound email sync
- Stripe billing and subscription role mapping

## Project Structure

```text
.
├── src/            # Frontend app
├── server/         # Express + Prisma backend
├── public/
└── package.json    # Frontend scripts
```

## Requirements

- Node.js 20+
- npm 10+
- MySQL 8+
- Redis 7+ recommended

Optional integrations:

- Stripe
- SMTP provider
- IMAP mailbox

## Local Development

### Frontend API configuration

Copy the frontend env example before starting Vite:

```sh
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Set the backend URL in `frontend/.env`:

```env
VITE_API_URL=http://localhost:4000/api
```

This is the base URL used by the frontend auth client for:

- `POST /auth/login`
- `POST /auth/register`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me`

### 1. Install frontend dependencies

From the project root:

```sh
npm install
```

### 2. Install backend dependencies

From the `server` folder:

```sh
cd server
npm install
```

### 3. Create backend environment file

Copy the example file:

```sh
cp .env.example .env
```

The backend reads config from [server/.env.example](/Users/faiez/development/web/nodejs/quntumarcleadgen-main/server/.env.example) and validates it in [server/src/lib/config.ts](/Users/faiez/development/web/nodejs/quntumarcleadgen-main/server/src/lib/config.ts).

Minimum required values for backend boot:

```env
PORT=4000
APP_URL=http://localhost:8080
API_PREFIX=/api
DATABASE_URL=mysql://user:password@localhost:3306/leadgen
JWT_ACCESS_SECRET=replace_with_long_random_secret
JWT_REFRESH_SECRET=replace_with_long_random_secret
BOOTSTRAP_ADMIN_EMAIL=admin@example.com
BOOTSTRAP_ADMIN_PASSWORD=change-me-now
```

Recommended for full functionality:

```env
REDIS_URL=redis://localhost:6379

STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_TIER_ONE=
STRIPE_PRICE_TIER_TWO=
STRIPE_PRICE_TIER_THREE=

SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM=

IMAP_HOST=
IMAP_PORT=993
IMAP_SECURE=true
IMAP_USER=
IMAP_PASS=
```

### 4. Create the database

Create a MySQL database manually, for example:

```sql
CREATE DATABASE leadgen;
```

Then make sure `DATABASE_URL` points to it.

### 5. Run Prisma setup

From `server/`:

```sh
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

What these do:

- `prisma:generate`: generates the Prisma client
- `prisma:migrate`: creates/applies the database schema
- `prisma:seed`: seeds roles and the bootstrap super admin user

Prisma note:

- this backend is now aligned with Prisma 7
- the datasource URL is configured in [server/prisma.config.ts](/Users/faiez/development/web/nodejs/quntumarcleadgen-main/server/prisma.config.ts)
- the generated client is written to `server/src/generated/prisma`
- runtime DB access uses the MariaDB driver adapter

### 6. Point the frontend at the backend

In the project root `.env`, add:

```env
VITE_API_URL=http://localhost:4000/api
```

The frontend API client lives in [src/lib/api.ts](/Users/faiez/development/web/nodejs/quntumarcleadgen-main/src/lib/api.ts).

### 7. Start the backend

From the root:

```sh
npm run dev:server
```

Or from `server/`:

```sh
npm run dev
```

Default backend URL:

```text
http://localhost:4000/api
```

Health check:

```text
GET /api/health
```

### 8. Start the frontend

From the root:

```sh
npm run dev
```

Default frontend URL:

```text
http://localhost:8080
```

## Useful Scripts

### Frontend

From the root:

```sh
npm run dev
npm run dev:client
npm run build
```

### Backend

From `server/`:

```sh
npm run dev
npm run build
npm run start
npm run prisma:generate
npm run prisma:migrate
npm run prisma:deploy
npm run prisma:seed
```

Or from root for the backend build:

```sh
npm run build:server
```

## First Login

After running the seed script, log in with:

- email: `BOOTSTRAP_ADMIN_EMAIL`
- password: `BOOTSTRAP_ADMIN_PASSWORD`

This user gets the `super_admin` role.

## Main Backend Features

The backend currently includes:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `GET /api/auth/me`
- `GET /api/leads`
- `GET /api/leads/:id`
- `PATCH /api/leads/:id`
- `POST /api/leads/campaigns`
- `POST /api/leads/messages`
- `GET /api/emails`
- `GET /api/emails/:id`
- `POST /api/emails/send`
- `PATCH /api/emails/:id/read`
- `DELETE /api/emails/:id`
- `POST /api/emails/sync`
- `GET /api/admin/users`
- `PATCH /api/admin/users/:id/role`
- `PATCH /api/admin/users/:id/status`
- `DELETE /api/admin/users/:id`
- `GET /api/settings`
- `PUT /api/settings`
- Stripe checkout / portal / webhook endpoints under `/api/billing`

## Deployment Guide

## Backend Deployment

You can deploy the backend to any Node-friendly platform:

- VPS + PM2
- Railway
- Render
- Fly.io
- DigitalOcean App Platform

### Production backend checklist

1. Provision:
   - MySQL
   - Redis
   - Node runtime
2. Set production environment variables in the host.
3. Install dependencies:

```sh
cd server
npm install
```

4. Apply schema:

```sh
npm run prisma:generate
npm run prisma:deploy
npm run prisma:seed
```

5. Build and start:

```sh
npm run build
npm run start
```

### PM2 example

From `server/`:

```sh
npm install
npm run prisma:generate
npm run prisma:deploy
npm run build
pm2 start dist/index.js --name leadgen-api
```

### Important production env values

- `APP_URL` must be your real frontend URL
- `DATABASE_URL` must point to production MySQL
- `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` must be long random values
- `STRIPE_WEBHOOK_SECRET` must match your Stripe endpoint
- `SMTP_*` must be valid for outbound mail
- `IMAP_*` must be valid if inbox sync is enabled

## Frontend Deployment

The frontend is a static Vite build.

Build it from the root:

```sh
npm install
npm run build
```

Deploy the generated `dist/` folder to:

- Vercel
- Netlify
- Cloudflare Pages
- Nginx static hosting
- S3 + CloudFront

Required frontend env:

```env
VITE_API_URL=https://your-api-domain.com/api
```

## Stripe Setup

For Stripe-powered role upgrades:

1. Create recurring Stripe prices for each tier.
2. Set:
   - `STRIPE_PRICE_TIER_ONE`
   - `STRIPE_PRICE_TIER_TWO`
   - `STRIPE_PRICE_TIER_THREE`
3. Point Stripe webhooks to:

```text
POST https://your-api-domain.com/api/billing/webhook
```

4. Add the returned signing secret to `STRIPE_WEBHOOK_SECRET`.

## Email Setup

### Outbound email

Set:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`

### Inbound email sync

Set:

- `IMAP_HOST`
- `IMAP_PORT`
- `IMAP_SECURE`
- `IMAP_USER`
- `IMAP_PASS`

The frontend calls the backend sync endpoint:

```text
POST /api/emails/sync
```

## Notes

- The old Supabase/Google Sheets flow has been replaced in the application code with the custom backend architecture.
- Lead campaigns now go through backend APIs and backend-managed settings instead of direct frontend-to-Supabase or frontend-to-Sheets logic.
- Some legacy frontend dependencies may still exist in `package.json`; those can be removed in a cleanup pass if you want.
