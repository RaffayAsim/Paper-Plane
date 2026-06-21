# Backend API Guide

This guide documents the current Express API in [server/src/app.ts](/Users/faiez/development/web/nodejs/quntumarcleadgen-main/server/src/app.ts).

Base URL by default:

```text
http://localhost:4000/api
```

## Overview

Stack:

- Node.js + Express
- MySQL + Prisma
- JWT auth
- Subscription plan gating
- `super_admin` admin role
- Stripe billing
- SMTP email sending
- IMAP inbox sync
- Embedded Google Maps scraper for lead generation

## Auth Model

The API uses Bearer access tokens for protected routes.

Header format:

```http
Authorization: Bearer <access_token>
```

Tokens:

- `accessToken`: short-lived JWT
- `refreshToken`: long-lived JWT stored hashed in the database

Auth response shape:

```json
{
  "accessToken": "jwt-access-token",
  "refreshToken": "jwt-refresh-token",
  "user": {
    "id": "clx...",
    "email": "user@example.com",
    "displayName": "John Doe",
    "roles": ["super_admin"],
    "subscriptionPlan": "tier_one"
  }
}
```

## Roles And Plans

Admin role:

- `super_admin`

Subscription plans:

- `tier_one`
- `tier_two`
- `tier_three`

Access rules:

- `tier_one`: leads access
- `tier_two`: leads + email
- `tier_three`: leads + email + message automation endpoint
- `super_admin`: admin/settings access regardless of plan

## Common Responses

Success:

- `200 OK` for standard fetch/update
- `201 Created` for create
- `204 No Content` for delete/logout/reset operations

Common error shape:

```json
{
  "message": "Something went wrong"
}
```

Common auth errors:

- `401 Missing bearer token`
- `401 Invalid or expired token`
- `401 User not found or inactive`
- `403 Forbidden`
- `403 This feature requires the tier_two subscription plan`

## Health

### `GET /health`

Checks database and Redis connectivity.

Response:

```json
{
  "ok": true
}
```

## Auth Endpoints

### `POST /auth/register`

Creates a new user and returns a session.

Body:

```json
{
  "email": "user@example.com",
  "password": "strongpassword",
  "displayName": "John Doe"
}
```

Notes:

- password must be at least 8 chars
- new users get default subscription plan `tier_one`

Response:

```json
{
  "accessToken": "jwt",
  "refreshToken": "jwt",
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "displayName": "John Doe",
    "roles": [],
    "subscriptionPlan": "tier_one"
  }
}
```

### `POST /auth/login`

Logs in a user.

Body:

```json
{
  "email": "user@example.com",
  "password": "strongpassword"
}
```

Response:

```json
{
  "accessToken": "jwt",
  "refreshToken": "jwt",
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "displayName": "John Doe",
    "roles": [],
    "subscriptionPlan": "tier_two"
  }
}
```

### `POST /auth/refresh`

Rotates refresh token and returns a new session.

Body:

```json
{
  "refreshToken": "refresh-jwt"
}
```

Response:

```json
{
  "accessToken": "new-jwt",
  "refreshToken": "new-refresh-jwt",
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "displayName": "John Doe",
    "roles": [],
    "subscriptionPlan": "tier_one"
  }
}
```

### `POST /auth/logout`

Revokes the refresh token.

Body:

```json
{
  "refreshToken": "refresh-jwt"
}
```

Response:

- `204 No Content`

### `POST /auth/forgot-password`

Generates a reset token.

Body:

```json
{
  "email": "user@example.com"
}
```

Response:

```json
{
  "message": "If the email exists, a reset token has been generated.",
  "resetToken": "plain-reset-token-or-null"
}
```

Important:

- this currently returns the token directly in the response
- this is okay for development, but for production you should email the token or reset link instead

### `POST /auth/reset-password`

Resets the password and revokes active refresh tokens.

Body:

```json
{
  "token": "reset-token",
  "password": "newstrongpassword"
}
```

Response:

- `204 No Content`

### `GET /auth/me`

Requires auth.

Response:

```json
{
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "displayName": "John Doe",
    "isActive": true,
    "roles": [],
    "subscriptionPlan": "tier_one"
  }
}
```

## Billing Endpoints

These endpoints use Stripe when configured.

Stripe env mapping:

- `STRIPE_PRICE_TIER_ONE`
- `STRIPE_PRICE_TIER_TWO`
- `STRIPE_PRICE_TIER_THREE`

Those Stripe price IDs are mapped to subscription plans in [billing.service.ts](/Users/faiez/development/web/nodejs/quntumarcleadgen-main/server/src/modules/billing/billing.service.ts).

### `POST /billing/checkout-session`

Requires auth.

Creates a Stripe Checkout session for a subscription.

Body:

```json
{
  "priceId": "price_123"
}
```

Response:

```json
{
  "url": "https://checkout.stripe.com/..."
}
```

### `POST /billing/portal-session`

Requires auth.

Creates a Stripe billing portal session.

Response:

```json
{
  "url": "https://billing.stripe.com/..."
}
```

### `POST /billing/webhook`

Stripe webhook endpoint.

Header:

```http
stripe-signature: <signature>
```

Handled Stripe events:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Response:

```json
{
  "received": true
}
```

## Lead Endpoints

All lead routes require auth.

Lead sources:

- `google_maps`
- `yelp`
- `yellow_pages`
- `custom`

Lead statuses:

- `new`
- `contacted`
- `qualified`
- `enriched`
- `converted`
- `archived`

Campaign statuses:

- `pending`
- `processing`
- `completed`
- `failed`

### `GET /leads`

Lists leads with filters and pagination.

Query params:

- `search`
- `source`
- `status`
- `page`
- `pageSize`

Example:

```http
GET /api/leads?source=google_maps&status=new&page=1&pageSize=25
```

Response:

```json
{
  "items": [
    {
      "id": "lead_id",
      "campaignId": "campaign_id",
      "source": "google_maps",
      "name": "Acme Dental",
      "business": "Acme Dental",
      "email": null,
      "phone": "+1 555 111 2222",
      "website": "https://example.com",
      "industry": "Dentist",
      "location": "New York, NY",
      "status": "new",
      "outreachEnabled": false,
      "metadata": {
        "reviewsCount": 12
      },
      "createdAt": "2026-03-19T12:00:00.000Z",
      "updatedAt": "2026-03-19T12:00:00.000Z"
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 25
}
```

### `GET /leads/meta/dashboard`

Returns dashboard-ready lead and campaign summary data.

Response:

```json
{
  "items": [],
  "campaigns": [
    {
      "status": "processing",
      "_count": {
        "_all": 3
      }
    }
  ]
}
```

### `GET /leads/campaigns/list`

Returns all lead campaigns.

Response:

```json
{
  "items": [
    {
      "id": "campaign_id",
      "source": "google_maps",
      "businessType": "Dentists",
      "location": "New York",
      "leadCount": 50,
      "status": "processing",
      "externalRequestUrl": null,
      "externalResponse": {
        "job_id": "uuid",
        "status": "processing",
        "found_count": 10
      },
      "errorMessage": null,
      "createdById": "user_id",
      "createdAt": "2026-03-19T12:00:00.000Z",
      "updatedAt": "2026-03-19T12:05:00.000Z"
    }
  ]
}
```

### `POST /leads/campaigns`

Requires at least `tier_one`.

Creates a lead campaign.

Body:

```json
{
  "source": "google_maps",
  "businessType": "Dentists",
  "location": "New York",
  "leadCount": 50
}
```

Behavior:

- `google_maps`: starts the embedded Puppeteer scraper in the background
- other sources: forwards to configured webhook URLs from settings

Response:

```json
{
  "item": {
    "id": "campaign_id",
    "source": "google_maps",
    "businessType": "Dentists",
    "location": "New York",
    "leadCount": 50,
    "status": "processing",
    "externalRequestUrl": null,
    "externalResponse": {
      "success": true,
      "job_id": "uuid",
      "status": "processing",
      "message": "Google Maps scraping started in background",
      "use_proxy": false
    },
    "errorMessage": null,
    "createdById": "user_id",
    "createdAt": "2026-03-19T12:00:00.000Z",
    "updatedAt": "2026-03-19T12:00:00.000Z"
  }
}
```

### `POST /leads/campaigns/:id/sync`

Requires at least `tier_one`.

For `google_maps`, returns the latest imported lead state for the campaign.

Response:

```json
{
  "campaignStatus": "processing",
  "imported": 12,
  "foundCount": 12,
  "leads": [],
  "externalResponse": {
    "job_id": "uuid",
    "status": "processing",
    "found_count": 12
  }
}
```

### `POST /leads/messages`

Requires `tier_three`.

Sends a message automation payload to the configured message webhook for a source.

Body:

```json
{
  "source": "google_maps",
  "message": "Write and send a contextual first outreach email"
}
```

Response:

```json
{
  "success": true,
  "response": "raw webhook response text"
}
```

Possible errors:

- `400 No message webhook configured for this source`
- `502 Message webhook failed`

### `GET /leads/:id`

Fetch one lead by ID.

Response:

```json
{
  "item": {
    "id": "lead_id",
    "source": "google_maps",
    "name": "Acme Dental"
  }
}
```

### `PATCH /leads/:id`

Updates lead status, outreach flag, and editable lead details.

Body:

```json
{
  "name": "Acme Dental Center",
  "business": "Acme Dental",
  "status": "qualified",
  "outreachEnabled": true,
  "email": "owner@example.com",
  "phone": "+1 555 123 4567",
  "website": "https://acmedental.com",
  "industry": "Dental",
  "location": "Dallas, TX"
}
```

Response:

```json
{
  "item": {
    "id": "lead_id",
    "status": "qualified",
    "outreachEnabled": true
  }
}
```

## Email Endpoints

All email routes:

- require auth
- require subscription plan `tier_two` or `tier_three`

Folders:

- `inbox`
- `sent`

### `GET /emails`

Query params:

- `folder=inbox|sent`
- `search`

Example:

```http
GET /api/emails?folder=inbox&search=acme
```

Response:

```json
{
  "items": [
    {
      "id": "email_id",
      "threadId": "thread_id",
      "sentByUserId": null,
      "subject": "Hello",
      "body": "Email body",
      "fromEmail": "from@example.com",
      "toEmail": "to@example.com",
      "direction": "incoming",
      "isRead": false,
      "providerMessageId": "<message-id>",
      "inReplyTo": null,
      "createdAt": "2026-03-19T12:00:00.000Z",
      "updatedAt": "2026-03-19T12:00:00.000Z"
    }
  ]
}
```

### `GET /emails/:id`

Fetch one email by ID.

Response:

```json
{
  "item": {
    "id": "email_id",
    "subject": "Hello"
  }
}
```

### `POST /emails/send`

Sends an SMTP email and stores it in MySQL.

Body:

```json
{
  "toEmail": "lead@example.com",
  "subject": "Quick introduction",
  "body": "Hi, I wanted to reach out..."
}
```

Response:

```json
{
  "item": {
    "id": "email_id",
    "subject": "Quick introduction",
    "direction": "outgoing",
    "isRead": true
  }
}
```

### `PATCH /emails/:id/read`

Marks an email as read or unread.

Body:

```json
{
  "isRead": true
}
```

Response:

```json
{
  "item": {
    "id": "email_id",
    "isRead": true
  }
}
```

### `DELETE /emails/:id`

Deletes an email.

Response:

- `204 No Content`

### `POST /emails/sync`

Runs IMAP inbox sync and imports new emails.

Response:

```json
{
  "imported": 4
}
```

Possible error:

- `500 IMAP is not configured`

## Admin Endpoints

All admin routes:

- require auth
- require `super_admin`

### `GET /admin/users`

Returns users with current subscription plan and admin roles.

Response:

```json
{
  "items": [
    {
      "id": "user_id",
      "email": "user@example.com",
      "displayName": "John Doe",
      "isActive": true,
      "createdAt": "2026-03-19T12:00:00.000Z",
      "roles": ["super_admin"],
      "subscriptionPlan": "tier_two",
      "subscription": {
        "id": "subscription_id",
        "status": "active",
        "planName": "tier_two",
        "stripePriceId": "price_123"
      }
    }
  ]
}
```

### `PATCH /admin/users/:id/role`

Sets the admin role.

Body:

```json
{
  "role": "super_admin"
}
```

Or clear role:

```json
{
  "role": "none"
}
```

Response:

- `204 No Content`

### `PATCH /admin/users/:id/status`

Activates or deactivates a user.

Body:

```json
{
  "isActive": false
}
```

Response:

- `204 No Content`

### `DELETE /admin/users/:id`

Deletes a user.

Rules:

- a super admin cannot delete their own account through this endpoint

Response:

- `204 No Content`

Possible error:

- `400 You cannot delete your own user`

## Settings Endpoints

All settings routes:

- require auth
- require `super_admin`

Important:

- the settings model still contains some legacy field names like `airtable*` and `mapTable`
- these are persisted as app settings, but some are transitional and not fully used by the new backend flow

### `GET /settings`

Response:

```json
{
  "app": {
    "leadCampaignWebhook": "",
    "airtableApiKey": "",
    "airtableBaseId": "",
    "airtableTableName": "Leads"
  },
  "webhooks": {
    "mapLeads": "",
    "yelpLeads": "",
    "yellowPageLeads": "",
    "mapMessage": "",
    "yelpMessage": "",
    "yellowPageMessage": "",
    "mapTable": "",
    "yelpTable": "",
    "yellowPageTable": "",
    "dynamicButtons": []
  }
}
```

### `PUT /settings`

Stores app and integration settings.

Body:

```json
{
  "app": {
    "leadCampaignWebhook": "",
    "airtableApiKey": "",
    "airtableBaseId": "",
    "airtableTableName": "Leads"
  },
  "webhooks": {
    "mapLeads": "",
    "yelpLeads": "https://example.com/yelp-webhook",
    "yellowPageLeads": "",
    "mapMessage": "",
    "yelpMessage": "",
    "yellowPageMessage": "",
    "mapTable": "",
    "yelpTable": "",
    "yellowPageTable": "",
    "dynamicButtons": [
      {
        "name": "Open CRM",
        "url": "https://example.com"
      }
    ]
  }
}
```

Response:

- same shape as `GET /settings`

## Google Maps Embedded Scraper

Google Maps scraping is now embedded in this backend.

Used by:

- `POST /leads/campaigns` when `source = "google_maps"`
- `POST /leads/campaigns/:id/sync`

Relevant env vars:

```env
GOOGLE_MAPS_USE_PROXY=false
GOOGLE_MAPS_HEADLESS=true
```

Notes:

- scraping runs in the background inside the backend process
- the campaign row stores scrape progress in `externalResponse`
- imported leads are written directly to the `Lead` table
- deduplication tries to reuse recent Google Maps leads from the last 30 days

## Rate Limiting

Auth routes are rate limited in [app.ts](/Users/faiez/development/web/nodejs/quntumarcleadgen-main/server/src/app.ts):

- window: 15 minutes
- max requests: 100

Applied to:

- `/api/auth/*`

## Environment Variables

Core:

```env
PORT=4000
APP_URL=http://localhost:8080
API_PREFIX=/api
DATABASE_URL=mysql://user:password@localhost:3306/leadgen
REDIS_URL=redis://localhost:6379
JWT_ACCESS_SECRET=replace_me
JWT_REFRESH_SECRET=replace_me
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL_DAYS=30
BOOTSTRAP_ADMIN_EMAIL=admin@example.com
BOOTSTRAP_ADMIN_PASSWORD=change-me-now
```

Stripe:

```env
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_TIER_ONE=
STRIPE_PRICE_TIER_TWO=
STRIPE_PRICE_TIER_THREE=
```

Email:

```env
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

Google Maps:

```env
GOOGLE_MAPS_USE_PROXY=false
GOOGLE_MAPS_HEADLESS=true
```

## Notes And Current Caveats

- `forgot-password` currently returns the reset token directly
- settings still include some transitional legacy field names
- email access starts at `tier_two`
- `leads/messages` is currently webhook-driven and intended for `tier_three`
- Google Maps scraping depends on Puppeteer and a browser-compatible server/runtime environment
