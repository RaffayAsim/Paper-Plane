# Email Automation Plan

This document captures the agreed first-stage email workflow.

## Goals

1. Run email sync in the background every 1 minute with `node-cron`.
2. Ensure sent, received, and reply emails are visible only to the owning user.
3. Auto-select an available mailbox when a user sends email.
4. Limit each mailbox to 50 sent emails per day.
5. Limit Tier 2 users to 500 sent emails per day.
6. Limit Tier 3 users to 500 sent emails per day for now.
7. Reserve a mailbox to the first user who starts using it so it is not shared with another user.

## Agreed Behavior

- Admin adds SMTP/IMAP mailboxes into the shared pool.
- The system automatically reserves a free mailbox for a user when needed.
- A reserved mailbox stays tied to that user until changed by future management tooling.
- If a reserved mailbox reaches its daily cap, the system should move to another free mailbox reserved for the same user.
- Replies imported from IMAP are assigned to the user who owns that mailbox.
- Email inbox and sent views must be filtered by the logged-in user.

## First Implementation Stage

- Replace the background interval loop with `node-cron` every minute.
- Extend stored mailbox configs with reservation metadata.
- Make email sends select from the user's reserved mailbox pool or reserve a free one.
- Enforce 50/day per mailbox and 500/day per Tier 2 or Tier 3 user.
- Sync inboxes per reserved mailbox and assign imported messages back to the owning user.
- Filter email APIs so users only see their own messages.

## Later Enhancements

- Let users connect their own SMTP/IMAP accounts.
- Add admin tooling for mailbox reassignment and health status.
- Improve thread matching using `In-Reply-To` and `References`.
- Add richer delivery and bounce tracking.
