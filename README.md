# Field Notes Tickets · Phase 1 POC

A small mobile-first PWA for testing one flow: sign in while online, sync account/order/ticket data into IndexedDB, then reopen a ticket and render its QR locally with no connection.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`, choose **Sign in → Continue in demo mode**, and create a ticket from the featured event. Demo data stays in IndexedDB on that browser and device. It is useful for checking the UI and offline app shell; it does not sync from a desktop to a different phone.

Use `/debug/offline` to inspect the service worker and local cache, simulate an API failure while the network stays on, sync again, or clear saved data. On localhost, the service worker can be used for the offline test. On a phone, use an HTTPS deployment and open it once while online before switching on Airplane Mode.

Wait for **Service worker: Active** on the debug page before the first offline test; this means the app shell and its JavaScript/CSS assets were cached. Signing out hides the saved account and tickets. **Clear offline data** also removes their stored copies from this device.

## Connect Supabase for cross-device sync

The available Supabase projects were inactive when this POC was started, so the repository contains the client and migration but no live schema changes. Activate or create the intended project, then:

1. Copy `.env.example` to `.env.local`.
2. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from the Supabase project.
3. Set `SUPABASE_SERVICE_ROLE_KEY` on the server only. It is used by `/api/purchase` and must never be exposed as a `NEXT_PUBLIC_` variable.
4. Apply `supabase/migrations/20260929000000_ticket_poc.sql` to that project.
5. Add `http://localhost:3000/auth/callback` and the deployed `/auth/callback` URL to the Supabase Auth redirect allow list.
6. Restart the dev server, sign in with the same email on desktop and phone, create a POC ticket on desktop, and let the phone sync before going offline.

The migration keeps event reads public, enables RLS on every table, lets each authenticated user read only their own profile/orders/tickets, and reserves order/ticket inserts for the server-side purchase handler. Payment is simulated as confirmed; no payment provider is involved.

## Deploy

This is a standard Next.js App Router project and is Vercel-compatible. No Vercel team or GitHub remote was available in this workspace, so no cloud project has been linked or deployed. After choosing the intended Vercel project/repository, add the same three environment variables to the server runtime and deploy through the normal Vercel Git integration or CLI.

## Checks

```bash
npm run test
npm run lint
npm run typecheck
npm run build
```

## Phase 1 boundaries

- Browser storage is an offline convenience copy, not the source of truth.
- The QR contains an unsigned POC identifier and is not a real entry credential.
- There is no payment gateway, ticket scanner, production validation, signature, replay protection, push notification, or Phase 2 security hardening.
- Offline data remains tied to the browser profile on the device where it was synced.
