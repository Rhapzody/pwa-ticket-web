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

For a new environment, activate or create the intended Supabase project, then:

1. Copy `.env.example` to `.env.local`.
2. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from the Supabase project.
3. Set `SUPABASE_SERVICE_ROLE_KEY` on the server only. It is used by `/api/purchase` and must never be exposed as a `NEXT_PUBLIC_` variable.
4. Apply `supabase/migrations/20260929000000_ticket_poc.sql` to that project.
   Then apply `supabase/seed.sql` to add all seven sample events.
5. Add `http://localhost:3000/auth/callback` and the deployed `/auth/callback` URL to the Supabase Auth redirect allow list.
6. Create confirmed tester accounts with passwords as described below. Restart the dev server, sign in with the same account on desktop and phone, create a POC ticket on desktop, and let the phone sync before going offline.

## Tester login without email delivery

The login form uses Supabase email/password authentication. It does not send magic links or offer public signup. Passwords are submitted to Supabase Auth and are never saved in the offline ticket cache.

1. Open Supabase Dashboard → Authentication → Users → Add user → Create new user (not Invite user).
2. Enter the tester's email and a unique password. Enable **Auto Confirm User** so the account can log in without a confirmation email.
3. Share the website URL and account credentials privately with that tester. Create a separate account for each tester to keep tickets separate.
4. Log in at `/login`, create a ticket, then log in with the same account on a second device to verify sync.

Existing magic-link users need a password assigned by the administrator before they can use this form. No global email-confirmation setting needs to be disabled. Password recovery for this POC is handled by the administrator.

The migration keeps event reads public, enables RLS on every table, lets each authenticated user read only their own profile/orders/tickets, and reserves order/ticket inserts for the server-side purchase handler. Payment is simulated as confirmed; no payment provider is involved.

The homepage offers seven sample events from `src/lib/event-catalog.mjs`. Select an event, choose one to four tickets, then purchase. Both guest purchases and authenticated purchases use the selected event's date, venue, price, and QR event identifier. The server determines the price from the catalog rather than accepting a price from the browser. Keep `supabase/seed.sql` consistent with the catalog when adding events.

## Deploy

This is a standard Next.js App Router project deployed at https://pwa-ticket-web.vercel.app with source in https://github.com/Rhapzody/pwa-ticket-web. For a new environment, add the same three environment variables to the Vercel project and deploy through the Vercel Git integration or CLI.

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
