# Backend Codebase Guide (Where Things Are)

This document explains the backend architecture, where files live, how new features fit in, and how proxy configuration works across the scraping layers.

## 1) High-level structure

- [`server/src/index.ts`](server/src/index.ts) is the entrypoint: creates the app, starts background jobs, and begins listening.
- [`server/src/app.ts`](server/src/app.ts) wires middleware and mounts feature routers.
- [`server/src/modules/*`](server/src/modules) contains feature “vertical slices” (auth, leads, email, billing, settings, voice, admin).
- [`server/src/middleware/*`](server/src/middleware) contains shared Express middleware (auth, rbac, plan gating, error handling).
- [`server/src/lib/*`](server/src/lib) contains shared infrastructure utilities (Prisma client, Redis client, Stripe helper, config, rate limiting, mailer, browserless client, etc.).
- [`server/prisma/*`](server/prisma) is schema + migrations.

## 2) Runtime request path (how Express wires together)

[`server/src/app.ts`](server/src/app.ts:1) mounts routers in this order:

1. Global middleware: CORS, security headers, JSON parser, request logger.
2. Rate-limited auth:
   - `app.use(`${config.API_PREFIX}/auth`, createRateLimiter(...), authRouter)`
3. Feature routers:
   - `/billing` → [`server/src/modules/billing/billing.routes.ts`](server/src/modules/billing/billing.routes.ts)
   - `/leads` → [`server/src/modules/leads/leads.routes.ts`](server/src/modules/leads/leads.routes.ts)
   - `/emails` → [`server/src/modules/email/email.routes.ts`](server/src/modules/email/email.routes.ts)
   - `/admin` → [`server/src/modules/admin/admin.routes.ts`](server/src/modules/admin/admin.routes.ts)
   - `/settings` → [`server/src/modules/settings/settings.routes.ts`](server/src/modules/settings/settings.routes.ts)
   - `/voice` → [`server/src/modules/voice/voice.routes.ts`](server/src/modules/voice/voice.routes.ts)
4. Health + error middleware.

### Middleware chain building blocks

Typical protected route pattern:

- [`server/src/middleware/auth.ts`](server/src/middleware/auth.ts) → validates JWT access token, loads user + roles + current subscription plan, sets `req.auth`.
- [`server/src/middleware/rbac.ts`](server/src/middleware/rbac.ts) → checks `req.auth.roles` against allowed roles.
- [`server/src/middleware/plan.ts`](server/src/middleware/plan.ts) → checks `req.auth.subscriptionPlan` against required plan.
- Route handlers use [`server/src/middleware/async-handler.ts`](server/src/middleware/async-handler.ts) to propagate errors.

Errors:
- [`server/src/middleware/error-handler.ts`](server/src/middleware/error-handler.ts) formats Zod/HttpError/unknown errors.

## 3) Module layout (vertical slice pattern)

Inside a module, you typically see:

- `*.routes.ts` – Express route definitions.
- `*.service.ts` – business logic / orchestration.
- `*.scraper.ts` or automation code – external scraping/sending implementation details.

Example modules:

- Leads:
  - [`server/src/modules/leads/leads.routes.ts`](server/src/modules/leads/leads.routes.ts)
  - services like [`server/src/modules/leads/yelp.service.ts`](server/src/modules/leads/yelp.service.ts)
  - scrapers like [`server/src/modules/leads/yelp.scraper.ts`](server/src/modules/leads/yelp.scraper.ts)
  - shared proxy pool in [`server/src/modules/leads/google-maps.proxy.ts`](server/src/modules/leads/google-maps.proxy.ts)

- Email:
  - [`server/src/modules/email/email.routes.ts`](server/src/modules/email/email.routes.ts)
  - [`server/src/modules/email/email.service.ts`](server/src/modules/email/email.service.ts)
  - auto-reply and IMAP/SMTP logic in the email module.

## 4) Data access (Prisma)

- Shared Prisma client: [`server/src/lib/prisma.ts`](server/src/lib/prisma.ts)
- Entities are defined in [`server/prisma/schema.prisma`](server/prisma/schema.prisma)
- Prisma generated output lives under `server/src/generated/prisma`.

When adding new data:

1. Update [`server/prisma/schema.prisma`](server/prisma/schema.prisma)
2. Run migrations (`npm run prisma:migrate`)
3. Re-generate Prisma client (`npm run prisma:generate`)
4. Update module services/routes to use the new models.

## 5) Background jobs / cron

Background work is started in [`server/src/index.ts`](server/src/index.ts) (e.g. email sync).

Some schedules are implemented via `node-cron` and described conceptually in [`server/docs/email-automation-plan.md`](server/docs/email-automation-plan.md).

If you add a new recurring job:

- Prefer a dedicated service function in `server/src/modules/<feature>/...service.ts`
- Start it from [`server/src/index.ts`](server/src/index.ts) or a similar composition place.
- Keep route handlers thin: trigger jobs; don’t run long loops in the request thread.

## 6) Adding a new API feature (recommended workflow)

1. **Design the route contract**
   - Add/confirm the endpoint shape (request/response JSON).
   - Ensure auth + plan gates are correct.

2. **Create/extend a module**
   - Add a new `*.routes.ts` if the feature is standalone.
   - Add a `*.service.ts` for business logic.

3. **Wire the router in `app.ts`**
   - Mount your router under the correct prefix.

4. **Use existing middleware**
   - Wrap handlers with `asyncHandler`.
   - Apply `requireAuth`, plus `requireRole`/`requirePlan` as needed.

5. **Add Prisma queries in services**
   - Route handlers should call the service and return JSON.

6. **Update documentation**
   - Add the endpoint to [`server/API_GUIDE.md`](server/API_GUIDE.md).

## 7) Common conventions to follow

- Keep names consistent with existing modules: `routes.ts` for HTTP, `service.ts` for logic.
- Prefer shared helpers in `server/src/lib/*` rather than duplicating logic.
- Validate inputs with Zod in services/routes (and rely on [`server/src/middleware/error-handler.ts`](server/src/middleware/error-handler.ts:1) for formatting).

## 8) Proxy configuration for scraping layers

The backend currently has **one shared proxy pool** and **per-scraper overrides**.

### Shared proxy pool

The pool is managed by [`server/src/modules/leads/google-maps.proxy.ts`](server/src/modules/leads/google-maps.proxy.ts).

It:
- downloads free proxy lists from public sources (`socks5`, `socks4`, `http`)
- parses them into a normalized proxy object
- shuffles the pool
- returns proxies in round-robin order with `getNextProxy()`
- builds Puppeteer launch arguments with `getPuppeteerArgs(proxy)`

This shared pool is currently reused by:
- Google Maps scraping: [`server/src/modules/leads/google-maps.scraper.ts`](server/src/modules/leads/google-maps.scraper.ts)
- Yelp scraping: [`server/src/modules/leads/yelp.scraper.ts`](server/src/modules/leads/yelp.scraper.ts)
- Yellow Pages scraping: [`server/src/modules/leads/yellow-pages.scraper.ts`](server/src/modules/leads/yellow-pages.scraper.ts)

### Proxy selection by layer

#### 1. Google Maps

- Controlled by `GOOGLE_MAPS_USE_PROXY` and `GOOGLE_MAPS_HEADLESS` in [`server/src/lib/config.ts`](server/src/lib/config.ts).
- In [`server/src/modules/leads/google-maps.service.ts`](server/src/modules/leads/google-maps.service.ts), the scraper receives:
  - `useProxy: config.GOOGLE_MAPS_USE_PROXY ?? false`
  - `headless: config.GOOGLE_MAPS_HEADLESS ?? true`
- In [`server/src/modules/leads/google-maps.scraper.ts`](server/src/modules/leads/google-maps.scraper.ts), if proxy mode is enabled and the pool is empty, it loads proxies, then uses `googleMapsProxyManager.getNextProxy()`.
- This means each Google Maps campaign can rotate through a different proxy automatically.

#### 2. Yelp

- Controlled by:
  - `YELP_USE_PROXY`
  - `YELP_PROXY_OVERRIDE`
  - `YELP_BROWSERLESS_TIMEOUT_MS`
  - `YELP_BROWSERLESS_WAIT_MS`
  - `YELP_BROWSERLESS_PROXY`
  - `YELP_BROWSERLESS_EXTERNAL_PROXY`
  - `YELP_FORCE_BROWSERLESS`
  - `YELP_HEADLESS`
- In [`server/src/modules/leads/yelp.scraper.ts`](server/src/modules/leads/yelp.scraper.ts), the order is:
  1. Parse `YELP_PROXY_OVERRIDE` if provided.
  2. If proxy mode is enabled and no override exists, load the shared proxy pool.
  3. Use `googleMapsProxyManager.getNextProxy()` for a round-robin proxy.
  4. Fall back to Browserless (`browserless.unblock(...)`) when the search page is blocked or empty and Browserless is configured.
- Yelp can therefore use **three layers** of network strategy:
  - direct Puppeteer
  - shared proxy pool / override proxy
  - Browserless unblock fallback

#### 3. Yellow Pages

- Controlled by:
  - `YELLOW_PAGES_USE_PROXY`
  - `YELLOW_PAGES_PROXY_OVERRIDE`
  - `YELLOW_PAGES_HEADLESS`
- In [`server/src/modules/leads/yellow-pages.scraper.ts`](server/src/modules/leads/yellow-pages.scraper.ts), the flow is:
  1. Parse `YELLOW_PAGES_PROXY_OVERRIDE` if present.
  2. If proxy mode is enabled and no override exists, load the shared proxy pool.
  3. Retry search-page scraping up to 5 times when proxy mode is on.
  4. Rotate through `googleMapsProxyManager.getNextProxy()` on each retry.
- Yellow Pages does **not** currently use Browserless fallback the way Yelp does.

### Important config reference

The base env values are defined in [`server/.env.example`](server/.env.example).
Relevant variables for proxy and scraping:

```env
GOOGLE_MAPS_USE_PROXY=false
GOOGLE_MAPS_HEADLESS=true
YELP_USE_PROXY=false
YELP_PROXY_OVERRIDE=
YELP_BROWSERLESS_TIMEOUT_MS=90000
YELP_BROWSERLESS_WAIT_MS=8000
YELP_BROWSERLESS_PROXY=
YELP_BROWSERLESS_EXTERNAL_PROXY=
YELP_FORCE_BROWSERLESS=false
YELP_HEADLESS=true
YELLOW_PAGES_USE_PROXY=false
YELLOW_PAGES_PROXY_OVERRIDE=
YELLOW_PAGES_HEADLESS=true
BROWSERLESS_TOKEN=
BROWSERLESS_BASE_URL=https://production-sfo.browserless.io
```

### How to add multiple proxies safely

If you want different proxy behavior per scraping layer, the cleanest approach is:

1. **Keep the shared pool** in [`server/src/modules/leads/google-maps.proxy.ts`](server/src/modules/leads/google-maps.proxy.ts) for general round-robin rotation.
2. **Add layer-specific override env vars** for special cases:
   - `GOOGLE_MAPS_PROXY_OVERRIDE`
   - `YELP_PROXY_OVERRIDE`
   - `YELLOW_PAGES_PROXY_OVERRIDE`
3. **Use Browserless only where it makes sense**:
   - Yelp already supports Browserless fallback.
   - Google Maps and Yellow Pages currently rely on Puppeteer + proxies.
4. **Prefer per-layer configuration over one global proxy flag** if you need different routing, since each site has different blocking behavior.

## 9) Testing guidance (where to look)

- The project has a test setup under frontend.
- Backend scripts exist under `server/src/scripts/*` (seed and feature test scripts).

For backend feature verification, start by:

- Running `GET /api/health`.
- Running module-specific scripts if present (e.g. email finder or scraping test scripts).

(For deeper testing framework instructions, see root [`README.md`](README.md#testing).)
