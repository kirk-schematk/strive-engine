# Xano runbook — onboarding → roadmap → dashboard

XanoScript source of truth for workspace **163196**. These files are **live**:
they were pushed through the Metadata API on 2026-09-08 and verified end to end
with `smoke_test.py` (anonymous ladder incl. all-correct → Director and all-wrong
→ Student, lesson pick, claim, roadmap, confirm, goals, dashboard).

**To change the backend: edit the `.xs` file here, then push it** (never edit in
the Xano UI without copying the result back, or the two will drift):

```bash
$env:XANO_META_TOKEN="<metadata api token>"     # PowerShell; bash: export XANO_META_TOKEN=…
python docs/xano/push.py docs/xano/functions/roadmap_build.xs function 342153
python docs/xano/push.py docs/xano/onboarding/onboarding_answer.xs api 428916 4019192
python docs/xano/smoke_test.py                  # + XANO_AUTH_TOKEN=<member token> for the auth half
```

| Object | Xano id |
|---|---|
| function `roadmap_build` | 342153 |
| function `roadmap_progress` | 342154 |
| Onboarding `onboarding_answer` (POST) | 4019192 |
| Onboarding `onboarding_claim` (POST, auth) | 4019194 |
| Onboarding `onboarding_lesson_pick` (POST) | 4040793 |
| Onboarding `onboarding_lesson_done` (POST) | 4040756 |
| Platform `roadmap_generate` (POST, auth) | 4040757 |
| Platform `roadmap` (GET, auth) | 4040758 |
| Platform `roadmap` (PATCH, auth) | 4040759 |
| Platform `goals` (POST, auth) | 4040760 |
| Platform `goal` (PATCH, auth) | 4040761 |
| Platform `goal` (DELETE, auth) | 4040762 |
| Platform `dashboard` (GET, auth) | 4040763 |
| Platform `lessons` (GET) | 3971069 |
| Platform `course/check_complete` (POST, auth) | 4043102 |
| Platform `course/check_completions` (GET, auth) | 4043103 |

Group ids: Onboarding 428916 (`api:m2bNDxnv`), Platform 417827 (`api:fykJB1SM`).
The manual paste steps below still work as a fallback.

## XanoScript gotchas (all verified live on this instance)

- A bare `||` inside a `db.edit` / `db.add` **object literal** does not evaluate as a boolean OR — `passed: ($row.passed == true || $passed == true)` silently stored `false`. Compute it into a var with a one-line ternary first. (2026-09-09)
- `array.map` is a **no-op** (returns the input unchanged). Use `foreach … each as $x { array.push $out { value = … } }`.
- `|get:key:default` **ignores the default** and returns null for a missing key. Use `|get:key|first_notempty:default`.
- A literal object with numeric-string keys (`{"1": "a"}`) becomes a **0-based list**. Build maps with `{}|set:"1":"a"|set:"2":"b"`.
- `|concat:a:b` is not sequential (`b` is a separator). Chain single-arg concats: `|concat:a|concat:b`.
- Inside an object literal, a filter chain followed by `,` **loses its last argument**. Parenthesize: `key: ($x|concat:"y"),`.
- A ternary must be on **one line**; `// comments` are not allowed inside object literals or after code on the same line.
- Syntax-error line numbers point *after* the real culprit; bisect by pushing growing prefixes.
- `for (\`5\`) { each as $i }` is 0-based. `"now"|to_timestamp:"UTC"` works. `~` string concatenation works in `var` values.

Contract: `docs/onboarding-roadmap-spec.md` (section 2).

## Files

| File | Kind | Group | Verb | Auth | Replaces? |
|---|---|---|---|---|---|
| `functions/roadmap_build.xs` | custom function | Library → Functions | — | — | new |
| `functions/roadmap_progress.xs` | custom function | Library → Functions | — | — | new |
| `onboarding/onboarding_answer.xs` | endpoint | Onboarding (`api:m2bNDxnv`, id 428916) | POST | none | **replaces** existing |
| `onboarding/onboarding_lesson_pick.xs` | endpoint | Onboarding | POST | none | new |
| `onboarding/onboarding_lesson_done.xs` | endpoint | Onboarding | POST | none | new |
| `onboarding/onboarding_claim.xs` | endpoint | Onboarding | POST | **user** | **replaces** existing |
| `platform/roadmap_generate.xs` | endpoint | Platform (`api:fykJB1SM`, id 417827) | POST | **user** | new |
| `platform/roadmap_get.xs` | endpoint | Platform | GET | **user** | new |
| `platform/roadmap_patch.xs` | endpoint | Platform | PATCH | **user** | new |
| `platform/goals_post.xs` | endpoint | Platform | POST | **user** | new |
| `platform/goal_patch.xs` | endpoint | Platform | PATCH | **user** | new |
| `platform/goal_delete.xs` | endpoint | Platform | DELETE | **user** | new |
| `platform/dashboard_get.xs` | endpoint | Platform | GET | **user** | new |
| `platform/lessons_get.xs` | endpoint | Platform | GET | none | **replaces** existing |
| `platform/course_check_complete.xs` | endpoint | Platform | POST | **user** | new |
| `platform/course_check_completions_get.xs` | endpoint | Platform | GET | **user** | new |
| `smoke_test.py` | test | — | — | — | — |

"user" auth = the `user` table (id 848600), same token the front end gets from
`POST /memberstack_auth`.

## Course knowledge checks (2026-09-09)

Per-module checks on a course (`course_json.modules[n].check`, see
`docs/course-knowledge-checks.md`) are graded and stored server-side.

**Table `course_check_completions` (888032) is already created** through the
Metadata API — schema and a btree index on `(user_id, course_id, module_index)`.
One row per (user, course, module): `score`, `total`, `helped`, `attempts`,
`passed` (sticky once true), `completed_at` (kept from the first pass),
plus denormalized `course_id` / `module_title` so reads need no join.

**Both endpoints are live** (4043102 / 4043103, pushed 2026-09-09) and verified
against the live instance: a wrong answer scores 2/3 and does not pass, an empty
answer list and an all-zeros list do not pass, an unknown `course_id` 404s, an
out-of-range `module_index` 400s, `passed` survives a later failed attempt,
`attempts` increments, and `completed_at` keeps the first pass. Both return 401
without a token.

`push.py` now falls back to `XANO_META_TOKEN=…` in a **gitignored `.env`** at the
repo root, which is how these were pushed — a Xano metadata token is ~1.8 kB, well
past the 1024-char limit that silently truncates `setx`:

```bash
python docs/xano/push.py docs/xano/platform/course_check_complete.xs api 417827 4043102
```

To re-verify, `smoke_test.py`'s `course_check_flow()` needs `XANO_AUTH_TOKEN` (a
member token from `POST /memberstack_auth`). `POST /auth/signup` cannot currently
mint one — see BUG-002 in `docs/bugs.md`. The 2026-09-09 verification worked around
that with temporary unauthenticated clones of both endpoints (`_tmpcheck/*`, taking
`user_id` as an input) which were deleted afterwards, along with their rows.

## Step 0 — schema check (already done, verify only)

**2026-09-08:** `user.placement_phase` was recreated (nullable int, range 0–5,
default 0). The old column had `min=1` with default 0, so every new user record
failed validation and `POST /auth/signup` returned 400. Both existing users had a
null value, so nothing was lost. A throwaway test member
`strive-test-20260908@example.com` exists for the smoke test; delete it when done.

Database → confirm: `mini_lessons.phase` populated (1–5, not 0),
`onboarding_sessions.remediation_slug / remediation_reason / remediation_done`,
tables `user_roadmaps` (885209) and `user_goals` (885210). If any lesson still
has `phase = 0` it will simply never be placed in a phase milestone (only in
`m1` gaps).

## Step 1 — custom functions

For each of `roadmap_build.xs` then `roadmap_progress.xs`:

1. Library → **Functions** → **+ Add Function**.
2. Choose **"Use XanoScript"** (or create it blank, then open the `⋯` menu →
   **Edit as XanoScript**).
3. Paste the whole file (the header comment is fine). The declaration line
   `function roadmap_build {` sets the name — keep it exactly, the endpoints
   call `function.run roadmap_build` / `function.run roadmap_progress`.
4. Save. Fix anything the editor underlines — the few remaining unknowns are
   marked `// REVIEW:` (list at the bottom).
5. Quick test: **Run & Debug** `roadmap_build` with
   `{user_id: <your test user id>, source:"self", placement_phase:2,
   goal:"Step up to the next role", discipline:"Architecture"}` → you should get
   `roadmap.milestones` with several `"Modeler: …"` / `"Coordinator: …"`
   entries and 2 `goals_suggested`. It also writes one row into `user_roadmaps`.

## Step 2 — Onboarding group (`api:m2bNDxnv`)

API → **Onboarding** group.

1. **onboarding_answer** — open the existing endpoint → `⋯` → **Edit as
   XanoScript** → select all → paste `onboarding/onboarding_answer.xs` → Save.
   Inputs (`session_token`, `question_id`, `answer_index`) and response shape
   are unchanged; the served-question bug is fixed here.
2. **onboarding_lesson_pick** — **+ Add API Endpoint** → "Use XanoScript" →
   paste. Auth stays *none*.
3. **onboarding_lesson_done** — same as above.
4. **onboarding_claim** — open the existing endpoint → Edit as XanoScript →
   replace with `onboarding/onboarding_claim.xs`. Then in the endpoint
   **Settings** set **Authentication = user** (the file also has
   `auth = "user"`; make sure the UI shows it — the existing endpoint is
   currently public).

Leave `onboarding_start` and `onboarding_teaser` as they are.

## Step 3 — Platform group (`api:fykJB1SM`)

API → **Platform** group. For each file under `platform/`: **+ Add API
Endpoint** → "Use XanoScript" → paste → Save → confirm in Settings that
**Authentication = user** for everything except `lessons`.

- `roadmap_get.xs` and `roadmap_patch.xs` both declare `query roadmap` — that
  is intended: same path `/roadmap`, different verbs (GET / PATCH). Same for
  `goal_patch.xs` / `goal_delete.xs` (`/goal`, PATCH / DELETE).
- **lessons** — open the existing `/lessons` endpoint → Edit as XanoScript →
  replace with `platform/lessons_get.xs`. It rebuilds the same output
  (`_competency` / `_domain` nesting) without addons and adds `phase`.
  If you would rather keep the existing addon-based stack, the only change
  needed is adding `phase` to the `output` list of the `mini_lessons` query.

## Step 4 — publish

Both groups: **Publish** (top right) if the workspace uses branches/drafts.
Then curl:

```
curl -s https://x8ki-letl-twmt.n7.xano.io/api:fykJB1SM/lessons | head -c 400
```

You should see `"phase":` in each item.

## Step 5 — verify

```
python docs/xano/smoke_test.py
```

runs the anonymous flow (start → answer until done → teaser → lesson_pick →
lesson_done) and asserts no `question_id` is served twice.

For the authenticated half, get a user Bearer token (e.g. from the browser:
`POST /memberstack_auth` on the Platform base → `authToken`) and run:

```
set XANO_AUTH_TOKEN=eyJ...          (PowerShell: $env:XANO_AUTH_TOKEN="eyJ...")
python docs/xano/smoke_test.py
```

It then runs claim → GET /roadmap → PATCH /roadmap confirm → POST /goals →
GET /dashboard and prints the shape of each response. It backs off on 429.

Note: the claim step permanently links that assessment session to the token's
user and regenerates the user's roadmap (version+1) — use a test account.

## Response shapes (for cross-checking with `docs/fixtures/*.json`)

- `POST onboarding_answer` → `{correct, feedback, done:false, next_question:{question_id, stem, options:[text]}, progress:{answered, max:8}}` or `{correct, feedback, done:true, session_token, progress}`.
- `POST onboarding_lesson_pick` → `{slug, title, est_minutes, competency, domain, phase, reason, question_stem|null, message}`.
- `POST onboarding_lesson_done` → `{ok:true, matched:bool}`.
- `POST onboarding_claim` → `{results:{archetype, placement_phase, phase_label, discipline, goal, headline, accuracy, questions_answered, questions_correct, phase_correct_counts, domains:[{domain,name,asked,correct}], review:[{question_id, stem, options, answer_index, correct_index, correct, feedback, skill_id, phase, domain, lesson_slug, lesson_title}]}, roadmap, goals_suggested, next_item, stats, remediation:{slug, reason, done}}`.
- `POST roadmap_generate` → `{roadmap, goals_suggested, next_item, stats}`.
- `GET /roadmap` and `PATCH /roadmap` → `{roadmap|null, goals, goals_suggested, next_item|null, stats|null, status, version, confirmed_at}` (`goals_suggested` is read by `strive-roadmap.js` on a `#roadmap` deep link).
- `POST /goals` → `{goals}`; `PATCH /goal` → `{goal}`; `DELETE /goal` → `{ok:true}`.
- `GET /dashboard` → `{user:{…, bio}, roadmap_summary:{status, target_phase, placement_phase, version, summary, phase_labels, totals:{items,minutes,done,minutes_done}, milestones:[{id,title,why,phase,domain,deferred,items_total,items_done,items:[decorated items]}]}|null, next_item:{…, milestone_id, milestone_title}, goals, recent_completions:[{type,slug,title,minutes,completed_at}], stats:{…, lessons_this_week, lessons_done, minutes_learned, goals_done}}`.
- Every goal is returned as `{id, title, description, metric, target_count, due_date, status, sort_order, completed_at, progress:{done, target, percent}, overdue}`.
- `stats` = `{items_total, items_done, minutes_total, minutes_done, percent, completions}`.
- Roadmap JSON is the spec shape plus `goals_suggested` (stored so a re-claim is idempotent) and, after decoration, `items_total`/`items_done` on each milestone and `milestone_id`/`milestone_title` on `next_item`.

## `// REVIEW:` markers — what is confirmed, what is left

Resolved against the XanoScript docs (see `docs/integration-review.md` for the
sources):

- `auth = "user"` inside the `query` block, `$auth.id`, `int? x` (nullable),
  `text x?` (optional), `int[] x?`, `json x?` — documented individually.
  **Correction (2026-09):** `int? x?` (both markers on one input) is not
  documented; changed to `int? placement_override` (nullable, not optional)
  in `roadmap_build` and `roadmap_generate` since every caller always sends
  the key. If you add an input that's genuinely both, pick one marker.

**Paste gotcha (confirmed 2026-09-02):** a trailing `// comment` on the same
line as an `input {}` declaration makes the Xano paste-parser fail with a
misleading `Syntax error: unexpected '<some later token>'` (it blamed
`goal?`, then `comment`). Full-line `//` comments are fine. All inline
trailing comments have been stripped from every `.xs` file here — keep it
that way: put comments on their own line, never after code.

**`data =` must be an object literal (confirmed 2026-09-02):** `db.add` /
`db.edit` reject `data = $row` or `data = $row|set:…` with
`Invalid kind for data - assign:var`. Write the fields inline
(`data = { a: $x, b: "now" }`); variables are fine as *values*. Fixed in
`roadmap_build.xs` (row written out twice) and `goal_patch.xs` (every column
written, omitted inputs keep the stored value).
- `~` text concatenation and `cond ? a : b` — documented expression operators.
- ``for (`5`)`` — the count must be in backticks (fixed in every file).
- Paged `db.query` results are wrapped; records live under `.items`.
- `|in:`, `|slice:`, `|first_notempty:`, `|set_ifnotnull:`, `|has:`, `|unique`,
  `|sort` (numeric), `transform_timestamp:"+N days":"UTC"`, `format_timestamp` — documented.
- `index_by` / `regex_replace` / `%` were removed in favour of `array.find`,
  `|split:": "|last` and `array.find_index`, so those questions no longer arise.

Still to confirm in the editor (search the files for `REVIEW`):

1. **`"now"|to_timestamp:"UTC"`** — the filter is documented for date text
   (`"2025-10-18"|to_timestamp`); "now" as input is not shown. If `$now_ts` is
   null/0 in Run & Debug, switch to the `now` expression variable
   (`roadmap_build`, `roadmap_progress`, `dashboard_get`).
2. **Omitted optional inputs arrive as `null`** — `goal_patch` (`set_ifnotnull`)
   and `roadmap_generate` (`placement_override`) depend on it.
3. **Outer variables inside ``array.filter/find/has … if (`…`)``** (e.g. `$p`,
   `$used_slugs`, `$course_comp_name`) — used throughout; not stated in the docs.
4. **`due_date` (`date` column)** comes back as `"YYYY-MM-DD"` text and accepts
   `null` (`goals_post`, `roadmap_progress` overdue check).
5. **Columns assumed to exist**: `user.bio`, `mini_lesson_completions.slug/passed/
   completed_at/mini_lesson_id`, `courses.status/competency_id/level/duration`,
   `assessment_questions.active/skill_id/question_json.{stem, options[{text,
   correct}], feedback.{correct,incorrect}, source.lesson_slug}`.
