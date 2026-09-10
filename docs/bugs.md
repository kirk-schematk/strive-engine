# Known bugs

One entry per bug. Newest first. Move to a "Fixed" section (with the commit) when closed.

## Open

### BUG-002 — Only one user can exist without a memberstack_id, so /auth/signup 500s

- **Reported:** 2026-09-09 (hit while smoke-testing the course-check endpoints)
- **Status:** Open, reproduced
- **Area:** Xano `user` table (848600), Auth group `api:4Ck9STs1` `POST /auth/signup`

**Symptom.** `POST /auth/signup` with a brand-new email returns
`500 {"code":"ERROR_FATAL","message":"Duplicate record detected."}`.

**Cause.** `user.memberstack_id` carries a **unique** index (id `78d801b2`) and
defaults to `""`. One row already holds `""`, so every later signup that doesn't
set a memberstack_id collides on it. The email is not the duplicate — that index
(`1ebc7987`) is fine.

**Blast radius.** The live path is Memberstack → `POST /memberstack_auth`, which
sets a real memberstack_id, so ordinary members are probably unaffected — worth
confirming that endpoint always writes one before dismissing this. It does block
`/auth/signup` outright, which is what test tooling and the smoke test use.

**Fix options.** Make `memberstack_id` nullable and let the unique index ignore
NULLs (Xano's unique index treats NULLs as distinct, `""` as one value), or have
signup write a placeholder such as `pending_<uuid>`. The leftover throwaway member
from 2026-09-08 is likely the row squatting on `""`; deleting it frees exactly one
signup, which is a workaround, not a fix.


### BUG-001 — Existing user logs in, lands on /dashboard, sees the login card and loops

- **Reported:** 2026-09-08 (existing member, reported to Kirk)
- **Status:** Open, not reproduced yet
- **Area:** `webflow-dashboard-embed.html` (auth bootstrap), `strive-dashboard.js` (`renderLogin`, `errorCard`), Xano `POST /memberstack_auth`

**Symptom.** An existing member logged in through the Memberstack modal. Memberstack's
post-login redirect sent them to `/dashboard`, but the page rendered the "Log in to see your
dashboard" card instead of the dashboard. Clicking Log in put them back on `/dashboard` with
the same card. They never reached the dashboard.

**Expected.** A member who is logged in to Memberstack sees their dashboard on `/dashboard`.

**Where the login card can come from** (read from the code, none confirmed yet):

1. `getAuth()` in the dashboard embed returns `null` when the Xano token exchange
   (`POST /memberstack_auth`) answers with any non-OK, non-5xx status (400/401/404).
   `postJSON` swallows the status, so an existing Memberstack member with no matching Xano
   user, or a stale/invalid `ms_token`, is treated as "logged out". Memberstack still says
   logged in, so the Log in button cannot change anything. This is the most likely cause.
2. `watchLogin(false)` is armed when `getAuth()` fails. If Memberstack's `onAuthChange`
   fires with the current member on subscribe (it does on some SDK versions), `now` is
   `true`, `loggedIn` is `false`, and the embed calls `location.reload()` on every load.
   That would look like a page that keeps looping on its own.
3. `boot()` gives up after 10 s if `$memberstackDom` has not appeared and shows the login
   card without ever checking auth. A slow Memberstack script load on the redirect page
   would hit this.
4. `postJSON` retries 3 times on 429. The roadmap/onboard embeds call Xano on the same
   pages, so a rate-limit burst right after login can exhaust the retries and yield `null`.
5. `GET /dashboard` returning 401/403 renders the "Please log in again" card, which links
   to the same login modal. If the exchanged token is rejected, the user loops between
   modal and 401.

**To reproduce / diagnose.**

- Get the member's email and check they exist in the Xano `user` table with a Memberstack id.
- On `/dashboard` as that member, open devtools Network: note the status of
  `POST /memberstack_auth` and `GET /dashboard`. A 4xx on the exchange confirms cause 1.
- Check the Console for repeated page loads (cause 2) or `[STRIVEDashboard]` warnings.
- Confirm whether the loop is user-driven (click Log in → same card) or automatic reloads.

**Fix ideas.**

- Distinguish "logged out" from "exchange failed" in `getAuth()`: when Memberstack has a
  member but the exchange fails, show an error card with the status, not the login card.
- Only arm `watchLogin` reloads on an actual state flip after the first callback.
- Log the exchange status to the console so support can read it off a screenshot.

## Fixed

_None yet._
