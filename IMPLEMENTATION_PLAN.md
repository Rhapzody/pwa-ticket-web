# Phase 1 implementation plan

## Goal

Prove that a user can sign in online, create or receive a ticket, sync account/order/ticket data to IndexedDB, then reopen the ticket and render its QR code after going offline.

## Scope

- Next.js App Router, TypeScript, and a small mobile-first ticket UI.
- Supabase Auth and Postgres integration, with a local demo mode when Supabase credentials are unavailable.
- IndexedDB cache for profile, orders, tickets, and sync metadata.
- A lightweight service worker for the app shell, previously visited routes, and offline fallback.
- `/debug/offline` to inspect cache state, force sync, simulate API errors, and clear local data.
- Supabase migration and setup instructions for a later active project; no cloud schema changes or deployment while the available project is inactive and no Vercel team/repository is attached.

## Steps

1. Scaffold the runnable Next.js app, visual shell, and route structure.
2. Add Supabase browser/server clients, OTP login, a server-side demo-purchase route, and a minimal RLS-protected schema.
3. Add IndexedDB repositories and automatic sync on login, app start, and reconnect.
4. Add installable PWA metadata, the service worker, offline routes, and locally rendered ticket QR codes.
5. Add offline diagnostics, demo mode, environment examples, and setup documentation.
6. Install pinned dependencies, run type/build checks, and inspect the running app in a browser.

## Phase 1 boundaries

No payment gateway, production ticket verification, scanner, signed QR, anti-replay logic, push notifications, or Phase 2 security hardening. The displayed QR is a POC identifier only. Browser storage is a convenience cache, not a source of truth.
