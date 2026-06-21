# Quantum Arc LeadGen

A full-stack SaaS platform for lead generation, email automation, and voice campaign management.

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Requirements](#requirements)
- [Quick Start](#quick-start)
- [Development Guide](#development-guide)
  - [Environment Configuration](#environment-configuration)
  - [Installation](#installation)
  - [Database Setup](#database-setup)
  - [Running the Development Servers](#running-the-development-servers)
- [Production Guide](#production-guide)
  - [Backend Deployment](#backend-deployment)
  - [Frontend Deployment](#frontend-deployment)
  - [PM2 Deployment](#pm2-deployment)
- [Architecture Overview](#architecture-overview)
- [API Reference](#api-reference)
- [Testing](#testing)
- [Integrations](#integrations)
- [Troubleshooting](#troubleshooting)

---

## Overview

Quantum Arc LeadGen is a custom lead-generation SaaS that enables businesses to:

- **Scrape leads** from Google Maps, Yelp, and Yellow Pages
- **Enrich leads** with business email discovery
- **Send outbound emails** via SMTP with mailbox management
- **Sync inbound emails** via IMAP
- **Run voice campaigns** through Vapi integration
- **Manage subscriptions** with Stripe billing

---

## Tech Stack

### Frontend
- **React 18** + **Vite** — Fast development and build
- **TypeScript** — Type safety
- **Tailwind CSS** + **shadcn/ui** — Modern styling
- **React Router v6** — Client-side routing
- **TanStack Query** — Server state management
- **Framer Motion** — Animations

### Backend
- **Node.js 20+** / **Bun** — Runtime
- **Express** — Web framework
- **Prisma 7** — ORM with MariaDB driver adapter
- **MySQL/MariaDB** — Primary database
- **Redis** — Rate limiting and caching
- **JWT** — Authentication with refresh token rotation

### Integrations
- **Stripe** — Billing and subscriptions
- **SMTP/IMAP** — Email sending and syncing
- **Puppeteer/Browserless** — Web scraping
- **Vapi** — Voice AI campaigns

---

## Project Structure

```
.
├── frontend/                 # React + Vite frontend
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   ├── contexts/         # React contexts (Auth, Settings)
│   │   ├── hooks/            # Custom hooks
│   │   ├── lib/              # API client, utilities
│   │   └── pages/            # Route pages
│   ├── public/
│   ├── .env.example
│   └── package.json
│
├── server/                   # Express + Prisma backend
│   ├── src/
│   │   ├── modules/          # Feature modules (auth, leads, email, etc.)
│   │   ├── middleware/       # Express middleware (auth, rbac, plan)
│   │   ├── lib/              # Utilities (prisma, redis, stripe, etc.)
│   │   ├── scripts/          # CLI scripts (seed, tests)
│   │   └── app.ts            # Express app factory
│   ├── prisma/
│   │   └── schema.prisma     # Database schema
│   ├── docs/                 # Internal documentation
│   ├── .env.example
│   └── package.json
│
├── example/                  # Example scraper code
├── dev.sh / dev.bat          # Cross-platform dev scripts
└── README.md                 # This file
```

---

## Requirements

### Required
- **Node.js 20+** or **Bun**
- **MySQL 8+** or **MariaDB 10.5+**
- **npm 10+** or **bun**

### Recommended
- **Redis 7+** — For rate limiting (falls back to in-memory if unavailable)

### Optional (for integrations)
- Stripe account
- SMTP provider (e.g., SendGrid, Mailgun)
- IMAP mailbox
- Browserless account (for cloud scraping)
- Vapi account (for voice campaigns)

---

## Quick Start

```bash
# 1. Clone the repository
git clone <repository-url>
cd quntumarcleadgen-main

# 2. Install frontend dependencies
npm install

# 3. Install backend dependencies
cd server && npm install && cd ..

# 4. Configure environment
cp frontend/.env.example frontend/.env
cp server/.env.example server/.env
# Edit both .env files with your values

# 5. Setup database
cd server
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
cd ..

# 6. Start development servers
npm run dev        # Frontend (port 8080)
npm run dev:server # Backend (port 4000)
```

---

## Development Guide

### Environment Configuration

#### Frontend (`frontend/.env`)

```env
# Required
VITE_API_URL=http://localhost:4000/api
```

#### Backend (`server/.env`)

```env
# === Core (Required) ===
PORT=4000
APP_URL=http://localhost:8080
API_PREFIX=/api
DATABASE_URL=mysql://user:password@localhost:3306/leadgen
JWT_ACCESS_SECRET=replace_with_long_random_secret_min_32_chars
JWT_REFRESH_SECRET=another_long_random_secret_min_32_chars
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL_DAYS=30

# === Bootstrap Admin (Required for seed) ===
BOOTSTRAP_ADMIN_EMAIL=admin@example.com
BOOTSTRAP_ADMIN_PASSWORD=change-me-now

# === Redis (Recommended) ===
REDIS_URL=redis://localhost:6379

# === Stripe (Optional) ===
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_TIER_ONE=price_...
STRIPE_PRICE_TIER_TWO=price_...
STRIPE_PRICE_TIER_THREE=price_...

# === SMTP (Optional - Outbound Email) ===
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_username
SMTP_PASS=your_password
SMTP_FROM=noreply@example.com

# === IMAP (Optional - Inbound Email Sync) ===
IMAP_HOST=imap.example.com
IMAP_PORT=993
IMAP_SECURE=true
IMAP_USER=your_username
IMAP_PASS=your_password

# === Google Maps Scraper (Optional) ===
GOOGLE_MAPS_USE_PROXY=false
GOOGLE_MAPS_HEADLESS=true

# === Browserless (Optional - Cloud Scraping) ===
BROWSERLESS_TOKEN=your_token

# === Vapi (Optional - Voice Campaigns) ===
VAPI_API_KEY=your_api_key
VAPI_WEBHOOK_SECRET=your_webhook_secret
```

### Installation

#### Using npm

```bash
# Frontend (from project root)
npm install

# Backend
cd server && npm install && cd ..
```

#### Using Bun

```bash
# Frontend (from project root)
bun install

# Backend
cd server && bun install && cd ..
```

### Database Setup

#### 1. Create the Database

```sql
CREATE DATABASE leadgen CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

#### 2. Configure DATABASE_URL

Update `server/.env`:

```env
DATABASE_URL=mysql://your_user:your_password@localhost:3306/leadgen
```

#### 3. Run Migrations

```bash
cd server

# Generate Prisma client
npm run prisma:generate

# Apply migrations
npm run prisma:migrate
```

#### 4. Seed the Database

```bash
# Create roles and bootstrap super admin
npm run prisma:seed
```

This creates:
- Default roles: `super_admin`, `tier_one`, `tier_two`, `tier_three`
- Super admin user using `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD`

### Running the Development Servers

#### Option 1: Separate Terminals

```bash
# Terminal 1 - Backend (port 4000)
cd server && npm run dev

# Terminal 2 - Frontend (port 8080)
npm run dev
```

#### Option 2: Using dev scripts

```bash
# macOS/Linux
./dev.sh

# Windows
dev.bat
# or
dev.command
```

#### Verify Servers

- **Backend Health**: http://localhost:4000/api/health → `{"ok":true}`
- **Frontend**: http://localhost:8080

---

## Production Guide

### Backend Deployment

#### Production Checklist

1. **Provision infrastructure**:
   - MySQL/MariaDB database
   - Redis instance (recommended)
   - Node.js 20+ runtime

2. **Set production environment variables** (see [Environment Configuration](#environment-configuration))

3. **Deploy code and install dependencies**:
   ```bash
   cd server
   npm install --production
   ```

4. **Apply database schema**:
   ```bash
   npm run prisma:generate
   npm run prisma:deploy
   npm run prisma:seed
   ```

5. **Build and start**:
   ```bash
   npm run build
   npm run start
   ```

#### Critical Production Env Values

| Variable | Description |
|----------|-------------|
| `APP_URL` | Your production frontend URL |
| `DATABASE_URL` | Production MySQL connection string |
| `JWT_ACCESS_SECRET` | Long random string (32+ chars) |
| `JWT_REFRESH_SECRET` | Different long random string (32+ chars) |
| `STRIPE_WEBHOOK_SECRET` | From Stripe dashboard webhook endpoint |
| `SMTP_*` | Valid SMTP credentials for outbound mail |
| `IMAP_*` | Valid IMAP credentials if inbox sync enabled |

### Frontend Deployment

The frontend is a static Vite build.

#### Build

```bash
npm install
npm run build
```

#### Deploy `dist/` folder to:

- **Vercel**: `vercel --prod`
- **Netlify**: Drag & drop or connect Git
- **Cloudflare Pages**: Connect Git repository
- **Nginx**: Copy `dist/` to web root
- **S3 + CloudFront**: Upload to S3 bucket

#### Required Frontend Env

```env
VITE_API_URL=https://your-api-domain.com/api
```

### PM2 Deployment

#### Backend with PM2

```bash
cd server

# Install dependencies
npm install

# Setup database
npm run prisma:generate
npm run prisma:deploy

# Build
npm run build

# Start with PM2
pm2 start dist/index.js --name leadgen-api

# Save PM2 config
pm2 save
pm2 startup
```

#### PM2 Ecosystem File

Create `server/ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'leadgen-api',
    script: 'dist/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env_production: {
      NODE_ENV: 'production',
      PORT: 4000
    }
  }]
};
```

Start with:

```bash
pm2 start ecosystem.config.js --env production
```

---

## Architecture Overview

### Request Flow

```
Client Request
     │
     ▼
┌─────────────────────────────────────────────────────────┐
│                    Express Server                        │
│  ┌─────────────────────────────────────────────────┐   │
│  │              Middleware Chain                     │   │
│  │  1. CORS                                         │   │
│  │  2. JSON Parser                                  │   │
│  │  3. Rate Limiter (Redis-backed)                  │   │
│  │  4. requireAuth (JWT validation)                 │   │
│  │  5. requireRole (RBAC check)                     │   │
│  │  6. requirePlan (subscription gating)            │   │
│  └─────────────────────────────────────────────────┘   │
│                         │                               │
│                         ▼                               │
│  ┌─────────────────────────────────────────────────┐   │
│  │              Route Handlers                       │   │
│  │  /auth/*    → auth.routes.ts                     │   │
│  │  /leads/*   → leads.routes.ts                    │   │
│  │  /emails/*  → email.routes.ts                    │   │
│  │  /billing/* → billing.routes.ts                  │   │
│  │  /admin/*   → admin.routes.ts                    │   │
│  │  /settings/*→ settings.routes.ts                 │   │
│  │  /voice/*   → voice.routes.ts                    │   │
│  └─────────────────────────────────────────────────┘   │
│                         │                               │
│                         ▼                               │
│  ┌─────────────────────────────────────────────────┐   │
│  │              Prisma ORM                          │   │
│  │  MySQL/MariaDB ←→ Prisma Client                  │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### Authentication Flow

```
1. Login/Register
   POST /auth/login → JWT access + refresh tokens
   ┌─────────────────────────────────────────────────────┐
   │  accessToken: 15min expiry (stored in memory)       │
   │  refreshToken: 30 days (stored hashed in DB)        │
   └─────────────────────────────────────────────────────┘

2. API Requests
   Authorization: Bearer <accessToken>
   ┌─────────────────────────────────────────────────────┐
   │  requireAuth middleware validates JWT               │
   │  Attaches req.user (id, email, roles, plan)        │
   └─────────────────────────────────────────────────────┘

3. Token Refresh
   POST /auth/refresh { refreshToken }
   ┌─────────────────────────────────────────────────────┐
   │  Validates refresh token against DB                 │
   │  Rotates to new refresh token                       │
   │  Returns new access + refresh tokens                │
   └─────────────────────────────────────────────────────┘

4. Logout
   POST /auth/logout { refreshToken }
   ┌─────────────────────────────────────────────────────┐
   │  Deletes refresh token from DB                      │
   └─────────────────────────────────────────────────────┘
```

### Role-Based Access Control (RBAC)

| Role | Access Level |
|------|-------------|
| `super_admin` | Full admin access, user management, settings |
| `tier_one` | Leads access only |
| `tier_two` | Leads + Email access |
| `tier_three` | Leads + Email + Message Automation + Voice |

### Background Jobs

The backend uses `node-cron` for scheduled tasks:

| Job | Schedule | Purpose |
|-----|----------|---------|
| Email Sync | Every 1 minute | Sync IMAP inboxes for reserved mailboxes |
| Lead Scraper | On-demand | Google Maps scraping via Puppeteer |

### Lead Generation Pipeline

```
1. Create Campaign
   POST /leads/campaigns { source, businessType, location, leadCount }
   ┌─────────────────────────────────────────────────────┐
   │  source: google_maps | yelp | yellow_pages          │
   │  Creates LeadCampaign record (status: processing)   │
   └─────────────────────────────────────────────────────┘
                         │
                         ▼
2. Scrape Leads (Background)
   ┌─────────────────────────────────────────────────────┐
   │  Google Maps: Embedded Puppeteer scraper            │
   │  Yelp/Yellow Pages: Webhook to external service     │
   │  Stores leads in Lead table                         │
   └─────────────────────────────────────────────────────┘
                         │
                         ▼
3. Sync Campaign
   POST /leads/campaigns/:id/sync
   ┌─────────────────────────────────────────────────────┐
   │  Returns current status, imported count, leads      │
   └─────────────────────────────────────────────────────┘
                         │
                         ▼
4. Enrich Emails (Optional)
   Business Email Discovery Service
   ┌─────────────────────────────────────────────────────┐
   │  Multi-strategy email finder:                       │
   │  1. Direct static crawl                             │
   │  2. Puppeteer rendered crawl                        │
   │  3. DuckDuckGo search                               │
   │  4. Google dork search                              │
   └─────────────────────────────────────────────────────┘
```

---

## API Reference

For complete API documentation, see [`server/API_GUIDE.md`](server/API_GUIDE.md).

### Quick Reference

| Endpoint | Method | Description | Auth | Plan |
|----------|--------|-------------|------|------|
| `/health` | GET | Health check | ❌ | - |
| `/auth/register` | POST | Create account | ❌ | - |
| `/auth/login` | POST | Login | ❌ | - |
| `/auth/refresh` | POST | Refresh tokens | ❌ | - |
| `/auth/logout` | POST | Logout | ❌ | - |
| `/auth/me` | GET | Current user | ✅ | - |
| `/leads` | GET | List leads | ✅ | tier_one+ |
| `/leads/campaigns` | POST | Create campaign | ✅ | tier_one+ |
| `/emails` | GET | List emails | ✅ | tier_two+ |
| `/emails/send` | POST | Send email | ✅ | tier_two+ |
| `/billing/checkout-session` | POST | Stripe checkout | ✅ | - |
| `/admin/users` | GET | List users | ✅ | super_admin |
| `/settings` | GET/PUT | App settings | ✅ | super_admin |

---

## Testing

### Backend Tests

```bash
cd server

# Run all tests
npm test

# Run with coverage
npm run test:coverage
```

### Frontend Tests

```bash
cd frontend

# Run tests
npm test

# Run with UI
npm run test:ui
```

### Manual Smoke Tests

```bash
# Backend health
curl http://localhost:4000/api/health

# Register user
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","displayName":"Test User"}'

# Login
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

### Stripe Webhook Testing

```bash
# Install Stripe CLI, then:
stripe listen --forward-to http://localhost:4000/api/billing/webhook

# Copy the webhook secret to STRIPE_WEBHOOK_SECRET in .env
```

---

## Integrations

### Stripe Setup

1. Create products and prices in Stripe Dashboard
2. Copy price IDs to environment:
   ```env
   STRIPE_PRICE_TIER_ONE=price_xxx
   STRIPE_PRICE_TIER_TWO=price_xxx
   STRIPE_PRICE_TIER_THREE=price_xxx
   ```
3. Create webhook endpoint: `https://your-api.com/api/billing/webhook`
4. Copy webhook signing secret to `STRIPE_WEBHOOK_SECRET`

### Email Setup

#### SMTP (Outbound)

```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASS=your_sendgrid_api_key
SMTP_FROM=noreply@yourdomain.com
```

#### IMAP (Inbound Sync)

```env
IMAP_HOST=imap.gmail.com
IMAP_PORT=993
IMAP_SECURE=true
IMAP_USER=your_email@gmail.com
IMAP_PASS=your_app_password
```

### Browserless (Cloud Scraping)

```env
BROWSERLESS_TOKEN=your_token
```

Enables cloud-based Puppeteer scraping for Google Maps.

### Vapi (Voice Campaigns)

```env
VAPI_API_KEY=your_api_key
VAPI_WEBHOOK_SECRET=your_webhook_secret
```

---

## Troubleshooting

### Common Issues

#### `DATABASE_URL is required`

**Cause**: `.env` file missing or `DATABASE_URL` not set.

**Fix**:
```bash
cp server/.env.example server/.env
# Edit server/.env with your database credentials
```

#### Prisma Connection Errors

**Cause**: MariaDB/MySQL not running or database doesn't exist.

**Fix**:
```bash
# Start MySQL/MariaDB
mysql.server start  # macOS
sudo systemctl start mariadb  # Linux

# Create database
mysql -u root -p -e "CREATE DATABASE leadgen;"
```

#### Redis Connection Errors

**Cause**: Redis not running.

**Fix**:
```bash
# Start Redis
redis-server

# Or leave REDIS_URL empty for in-memory rate limiting
```

#### Port Conflicts

**Cause**: Port 4000 (backend) or 8080 (frontend) already in use.

**Fix**:
```bash
# Change ports in .env
PORT=4001  # Backend
# Frontend port is configured in vite.config.ts
```

#### JWT Errors

**Cause**: `JWT_ACCESS_SECRET` or `JWT_REFRESH_SECRET` not set or too short.

**Fix**:
```bash
# Generate strong secrets
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

#### Stripe Webhook Fails

**Cause**: `STRIPE_WEBHOOK_SECRET` doesn't match CLI or dashboard.

**Fix**:
```bash
# Local testing
stripe listen --forward-to http://localhost:4000/api/billing/webhook
# Copy the printed webhook secret to STRIPE_WEBHOOK_SECRET
```

### Getting Help

1. Check [`server/README.md`](server/README.md) for backend-specific issues
2. Check [`frontend/README.md`](frontend/README.md) for frontend-specific issues
3. Review [`server/API_GUIDE.md`](server/API_GUIDE.md) for API questions
4. Check server logs: `cd server && npm run dev` shows detailed errors

---

## License

Private — All rights reserved.
