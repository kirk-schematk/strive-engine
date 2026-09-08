# Integration review — onboarding → roadmap → dashboard

> **Update 2026-09-08 — backend pushed and verified live.** All `.xs` files were pushed through the
> Metadata API and exercised with `docs/xano/smoke_test.py` (anonymous ladder: all-correct → Director,
> all-wrong → Student, no repeats, text-only options; claim → roadmap → confirm → goals → dashboard).
> The remaining uncertainties below were resolved by live tests; the dialect rules that mattered are in
> `docs/xano/README.md` ("XanoScript gotchas"): `array.map` is a no-op, `|get:k:default` ignores the
> default, literal numeric-key objects become lists, multi-arg `concat` is not sequential, and a filtered
> value inside an object literal must be parenthesized when followed by a comma.

Reviewed 2026-09-02 against `docs/onboarding-roadmap-spec.md`. Scope: every
endpoint's request/response vs. what the three engines actually send/read, the
onboarding lesson-slug chain, auth, `roadmap_build` spec compliance, and the
XanoScript in `docs/xano/` against the XanoScript docs
(`xanoscript/key-concepts`, `api`, `custom-functions`,
`function-reference/database-operations|utility-functions|data-manipulation/*`,
`filter-reference/array|manipulation|text|timestamp|transform|comparison|math`,
`the-function-stack/data-types/expression`).

Legend — **Fixed**: changed in this pass (files listed). **Engine**: needs a
change in `strive-roadmap.js` (not edited here). **Owner**: confirm in the Xano
editor / database.

## Findings

| # | Sev | Where | What | Fix |
|---|---|---|---|---|
| 1 | High | `strive-roadmap.js` `doClaim()` | `request('POST','/onboarding_claim',…)` is sent to the **Platform** base (no `{base:'onboarding'}`), but the endpoint lives in the Onboarding group (`api:m2bNDxnv`). Xano answers 404 → the engine clears the onboard token and falls back to `GET /roadmap` → assessment results are never claimed and the Results screen never shows. | **Fixed** in `strive-roadmap.js` `doClaim()`: now passes `{base:'onboarding'}`. |
| 2 | High | `strive-dashboard.js` goals vs `roadmap_progress.xs` | Server returns `progress:{done,target,percent}`; renderer reads `progress.total` / `progress.pct` (only computed when `progress` is absent) → "2 of undefined lessons", `width:undefined%`. | **Fixed** in `strive-dashboard.js` `normalize()`: aliases `total←target`, `pct←percent` when missing. `docs/fixtures/dashboard_get.json` now carries the server shape. |
| 3 | High | `roadmap_progress.xs` | Auto-completed "lessons" goals returned the literal text `"now"` as `completed_at`. Dashboard does `fmtDate(parseDate(goal.completed_at))` → `parseDate("now")` is `null` → `null.getMonth()` throws and the whole dashboard fails to render. | **Fixed**: `completed_at` now comes from the `db.edit` result (`$g_saved.completed_at`). |
| 4 | High | `roadmap_generate.xs`, `roadmap_patch.xs` | `db.edit user { data = { placement_confirmed: … } }` — `placement_confirmed` is not in the spec schema nor in the runbook's schema check; editing an unknown column fails the request. | **Fixed**: the write removed. Re-add only if the column exists. |
| 5 | High | `roadmap_build.xs`, `onboarding_claim.xs` | `db.query domains { sort = {domains.sort_order: "asc"} }` — no `sort_order` column in the spec; an unknown sort column errors. | **Fixed**: sort by `domains.id` (ids 1–5 = domain numbers used by `assessment_questions.domain`). |
| 6 | High | 4 `.xs` files | `for (5) { each as $i … }` — docs require the count in backticks: ``for (`10`)``. | **Fixed** in `onboarding_answer`, `onboarding_lesson_pick`, `roadmap_generate`, `roadmap_build`. |
| 7 | Med | `roadmap_get.xs`, `roadmap_patch.xs` vs `strive-roadmap.js` | Engine reads `d.goals_suggested` after `GET /roadmap` (deep link `#roadmap`) and after `PATCH`; neither returned it → the Goals step shows no suggestions. `goals_suggested` is already persisted inside `roadmap_json`. | **Fixed**: both endpoints now return `goals_suggested: roadmap_json.goals_suggested` (`[]` when no roadmap). |
| 8 | Med | `dashboard_get.xs` vs `strive-dashboard.js` | Engine reads `stats.lessons_done`, `stats.minutes_learned`, `stats.goals_done`, `user.bio`, `roadmap_summary.phase_labels`, `roadmap_summary.totals.minutes_done`, `milestones[].why`, `recent_completions[].minutes/type`. Server had none of them (engine fell back to roadmap-only counts, `bio` edit field was blank). | **Fixed**: added all of them (`lessons_done` = passed completions, `minutes_learned` = roadmap minutes done, `goals_done` = goals with status done; `bio` via `$u\|get:"bio":""` so a missing column is harmless). |
| 9 | Med | `roadmap_build.xs` rule 5 | Course attachment matched on a `courses.competency` **text** column; spec keys courses by `competency_id`. If the text column is absent/blank no course is ever attached (silently). | **Fixed**: name resolved from `competency_id` via the competencies list; `"competency"` dropped from the query `output`. |
| 10 | Med | `roadmap_build.xs` rules 3/4 | Items were picked with `array.find` on `skill_num`; two lessons sharing a `skill_id` produced a duplicate of the first and dropped the second. | **Fixed**: iterate `unique\|sort`ed numbers and take every lesson with that number. |
| 11 | Med | `roadmap_build.xs` rule 6 | Milestones parked by `focus_domains` still counted toward the 40-lesson soft cap, so an in-focus milestone could be deferred because of out-of-focus lessons. | **Fixed**: only in-focus milestones increment the cap counter. |
| 12 | Med | `strive-roadmap.js` `doClaim()` | Only 403/404 clear the stale token. `onboarding_claim` answers **400** when the session is still `in_progress` (user left before the teaser) → the engine shows an error card with a Retry that can never succeed. | **Fixed** in `strive-roadmap.js`: 400 now clears the token and falls back like 404/403. |
| 13 | Med | `strive-roadmap.js` profile vs `strive-dashboard.js` | Roadmap sends `user_current_industry` as the numeric `id` from `profile_dropdown_options`; dashboard sends the `label` (and the dashboard fixture has `industry:"Architecture"`). One of them is wrong for the legacy `PATCH /profile`. | **Fixed**: roadmap engine now sends the industry **label** (option values are labels), matching the dashboard; `user.industry` is a text column. |
| 14 | Med | Legacy `PATCH /profile` | Both engines send only `Authorization: Bearer <xano token>`; `ms_token` is sent only in the `POST /profile_photo` form. If `PATCH /profile` also expects `ms_token` in the body, every profile save fails. | **Owner**: confirm the legacy endpoint's auth. If it needs `ms_token`, add it to the JSON body in both engines. |
| 15 | Med | `strive-roadmap.js` `regenerate()` | Sends `placement_override: null` explicitly. Works because `roadmap_generate` declares `int? placement_override?` (nullable + optional, documented) and treats null as "keep the existing override". Note the engine sends an **absolute** phase (eff±1), not ±1 as the spec wording says; backend treats it as absolute — consistent, spec wording is just loose. | Info. Optional hardening: omit the key when null. |
| 16 | Med | `onboarding_answer.xs` | Spec: "if the pool for the target phase is exhausted, stop the session". Implementation tries the adjacent phases first and only stops when nothing is left. More lenient than the spec; question-repeat bug is fixed as required. | Accepted deviation — note in spec if kept. |
| 17 | Low | `roadmap_build.xs`, `lessons_get.xs` | `index_by:"id"` + `get:($id\|to_text)` — key type unknowable from the docs (REVIEW 3). | **Fixed**: replaced with `array.find (…) if (\`$this.id == …\`)`; the question no longer exists. |
| 18 | Low | `roadmap_build.xs`, `onboarding_claim.xs`, `onboarding_lesson_pick.xs` | `regex_replace:"/^Domain \d+: /"` — docs show the pattern both with and without delimiters. | **Fixed**: `$d.name\|split:": "\|last` (no regex). |
| 19 | Low | `roadmap_build.xs` | `$k % 100` — `%` is not in the expression operator list. | **Fixed**: domain recovered with `array.find_index` on the unsorted key list. |
| 20 | Low | `roadmap_build.xs` | `foreach ($gap_nums\|sort)` — an expression inside `foreach (…)` is not shown in the docs. | **Fixed**: sorted list assigned to a variable first. |
| 21 | Low | `docs/fixtures/roadmap_get.json` | Had `status/id/user_id/confirmed_at/updated_at` inside `roadmap` and `stats.lessons_completed_total`; server puts `status/version/confirmed_at` top-level, uses `stats.completions`, and returns `goals_suggested`. | **Fixed**: fixture reshaped to the server response. |
| 22 | Low | `docs/fixtures/claim_response.json` | `roadmap.status` / `roadmap.placement_override` keys are not produced by the server; `review[]` lacks `phase`/`domain` that the server adds. Engine ignores all of these. | Left as is. |
| 23 | Low | `docs/xano/README.md` | REVIEW list and response shapes were stale after the fixes above. | **Fixed**. |
| 24 | Info | `strive-roadmap.js` `GET /profile_dropdown_options` | Called with `auth:false`; endpoint is public. OK. | — |
| 25 | Info | `strive-onboard.js` | `onboarding_lesson_done` is fire-and-forget without retry; acceptable (the roadmap only loses the pre-signup tick on a 429). | — |

Counts: High 6 · Medium 10 · Low 7 · Info 2. Fixed here: 17 (1 engine file,
10 `.xs`, 2 fixtures, README). Roadmap-engine changes required: #1, #12, #13
(and optionally #15). Owner checks: #13, #14 and the "Remaining uncertainties"
below.

## 1. Request contracts (engine → `input {}`)

| Endpoint | Engine sends | `.xs` input | Result |
|---|---|---|---|
| `POST onboarding_start` | `{discipline, goal}` | existing endpoint (unchanged) | n/a |
| `POST onboarding_answer` | `{session_token, question_id:int, answer_index:int}` | `text session_token, int question_id, int answer_index` | OK |
| `GET onboarding_teaser` | `?session_token=` | existing (unchanged) | n/a |
| `POST onboarding_lesson_pick` | `{session_token}` | `text session_token` | OK |
| `POST onboarding_lesson_done` | `{session_token, slug}` (slug = pick's `slug`) | `text session_token, text slug filters=trim` | OK |
| `GET /mini_lesson?slug=` (Platform, existing) | `slug` = pick's `slug` (mini_lessons.slug) | existing | OK — see §3 |
| `POST onboarding_claim` | `{session_token}` + Bearer | `auth="user"`, `text session_token` | **#1** wrong base in the roadmap engine |
| `POST roadmap_generate` | `{source, placement_override:int\|null, current_role, target_role, weekly_minutes:int, focus_domains:int[]}` (+ `goal, discipline, placement_phase` for `self`) | `text source?, int placement_phase?, int? placement_override?, text goal?, text discipline?, text current_role?, text target_role?, int weekly_minutes?, int[] focus_domains?` | OK (#15) |
| `GET /roadmap` | none + Bearer | none | OK |
| `PATCH /roadmap` | `{status:"confirmed", milestones:[…], inputs:{current_role,target_role,weekly_minutes,focus_domains}}` | `text status?, json inputs?, json milestones?` | OK — server re-validates items by `type:slug`, takes its own copy |
| `POST /goals` | `{goals:[{title,description,metric,target_count,due_date}]}` | `json goals` | OK |
| `PATCH /goal` (dashboard) | `{id, status:"done"}` | `int id, text title?, text description?, text due_date?, text status?` | OK |
| `DELETE /goal` | not called by any engine | `int id` | — |
| `GET /dashboard` | none + Bearer | none | OK |
| `PATCH /profile`, `POST /profile_photo`, `GET /profile_dropdown_options` | legacy | not in this drop | **#13, #14** |

## 2. Response contracts (`response` → engine reads)

- **`onboarding_answer`** → engine reads `correct, feedback, done, next_question.{question_id, stem, options[]}, session_token`. All returned. ✔
- **`onboarding_lesson_pick`** → engine reads `slug, title, est_minutes, competency, reason, question_stem, message`. All returned. ✔
- **`onboarding_claim`** → engine reads `results.{archetype, phase_label, placement_phase, accuracy, questions_correct, questions_answered, discipline, headline, domains[].{name, domain, asked, correct}, review[].{stem, options, answer_index, correct_index, correct, feedback, lesson_slug, lesson_title}}`, `roadmap`, `goals_suggested`. All returned. ✔ (extra `next_item, stats, remediation` unused)
- **`roadmap_generate`** → `roadmap`, `goals_suggested`. ✔
- **`GET/PATCH /roadmap`** → `roadmap`, `goals`, `goals_suggested` (#7 fixed). ✔
- **Roadmap JSON** read by the engine: `placement_phase, target_phase, phase_labels, goal, discipline, source, inputs.{current_role,target_role,weekly_minutes,focus_domains}, summary, totals.{items,done}, milestones[].{id,title,why,phase,domain,deferred,items[].{type,slug,title,minutes,competency,level,done}}`. All produced by `roadmap_build` + `roadmap_progress`. ✔
- **`POST /goals`** → `goals` (stored only). ✔  **`PATCH /goal`** → `goal.completed_at`, `goal.status`. ✔
- **`GET /dashboard`** → `user.{first_name,last_name,email,location,company,industry,current_role,desired_role,profile_photo,bio,archetype,phase_label,placement_phase}`, `roadmap_summary.{status,placement_phase,target_phase,phase_labels,totals.{items,minutes,done,minutes_done},milestones[].{id,title,why,phase,domain,deferred,items_total,items_done,items[]}}`, `next_item.{type,slug,title,minutes,competency,level,milestone_id,milestone_title}`, `goals[].{id,title,description,metric.{type,slugs,count},target_count,due_date,status,completed_at,progress}`, `recent_completions[].{slug,title,minutes,completed_at,type}`, `stats.{lessons_this_week,lessons_done,minutes_learned,goals_done}`. All returned after #2/#8. ✔

## 3. Onboarding lesson-slug chain

`onboarding_lesson_pick` returns `slug = mini_lessons.slug` and stores the same
value in `onboarding_sessions.remediation_slug`. `strive-onboard.js` uses that
one value everywhere: `GET /mini_lesson?slug=<slug>`, `STRIVE.renderLesson(lesson,
'strive-lesson', {slug:<slug>, …})` and `POST onboarding_lesson_done {slug:<slug>}`.
The lesson JSON's inner `slug` (e.g. `d1-author-apply-loin` in
`mini_lesson_sample.json`) is never sent back. `onboarding_lesson_done.xs`
compares `$input.slug` with `$session.remediation_slug` (both mini_lessons.slug)
— correct. Downstream, `roadmap_progress.xs` adds `remediation_slug` to the
done-set and roadmap items use `mini_lessons.slug`, and the `/lesson?slug=` page
posts completions with the URL slug (`webflow-lesson-embed.html` → `slug: slug`),
so `mini_lesson_completions.slug` is also `mini_lessons.slug`. Consistent end to end.

## 4. Auth

- `onboarding_claim.xs`: `auth = "user"` (documented form, placed before
  `input {}` exactly as in the docs' example) and every user reference is
  `$auth.id`. The runbook also tells the owner to flip the endpoint's
  Authentication setting in the UI.
- `strive-roadmap.js` `request()` adds `Authorization: Bearer <authToken>` to
  every call unless `auth:false`; it would do so for the claim too once #1 is
  fixed. `strive-dashboard.js` adds it to every call. The Memberstack token is
  only put in the `profile_photo` multipart body (`ms_token`) in both engines.
  Both embeds do cookie → `POST /memberstack_auth {ms_token}` → `authToken` and
  never pass the Memberstack token to the engines except as `msToken`.
- Xano auth tokens are issued against the `user` table and are accepted by any
  API group in the workspace, so one token serves both bases.

## 5. `roadmap_build.xs` vs generation rules

| Rule | Status |
|---|---|
| 1 target phase / weights | ✔ Level-up `T=P`, weak domains first; Step-up `T=min(P+1,5)`; Move-into `T=max(P,2)`, weights 2/2/1.5; Keep-team `T=P`, weights 4,5→2, extra phase `min(P+1,5)` for domains 4–5 only (skipped when it equals `P`). Unknown goal → Level-up. |
| 2 discipline nudge | ✔ Map matches the spec; nudge competencies first in nudge order, then the rest by name. |
| 3 `m1` | ✔ Any phase, sorted by `SKL-n`, omitted when empty. (#10 fixed duplicates.) |
| 4 phase×domain milestones | ✔ Phases `P..T` outer, domains by weight desc → (level-up) wrong desc → domain asc inner; title `"{phase label}: {short domain}"`; items by competency then `SKL-n`; `m1` items excluded via `$used_slugs`. Milestones are numbered `m2…` in creation order. |
| 5 courses | ✔ after #9. Level map Beginner→1–2, Intermediate→3, Advanced/"Advances"→4–5; appended to the first non-`m1` milestone containing that competency; minutes parsed from `"~2h 00m"` / `"45m"`, default 60. |
| 6 soft cap / focus | ✔ after #11. `deferred` set before the milestone is pushed; totals exclude deferred. |
| 7 summary | ✔ Exact template; `{n} gaps` clause dropped when `m1` is empty ("It works through …"); hours rounded to 1 dp; weeks `ceil(total/weekly)`, min 1. |
| 8 goals_suggested | ✔ Gaps (+14 d, only with `m1`); "Finish {first non-deferred non-m1 milestone}" (+max(2, ceil(min/weekly)) weeks, lesson slugs only); "Reach {T} level" (all non-deferred lesson slugs, +ceil weeks) or the Keep-team variant with `{type:"lessons", slugs:[domain-5 slugs], count:3}`. Not persisted until `POST /goals`; also stored in `roadmap_json.goals_suggested` for idempotent re-claim (extension). |

Deviations worth a spec note: courses attach by `competency_id` name-resolution
(spec: `competency_id` — same intent); `weak_domains` only lists domains with
`wrong > 0`; `placement_override` is an absolute phase.

## 6. XanoScript — resolved `// REVIEW:` markers

| Marker | Verdict | Source |
|---|---|---|
| 1 `~` concatenation | Documented operator (`a ~ b`). Kept. | expression data-type page |
| 2 date chain | `transform_timestamp:"+14 days":"UTC"`, `format_timestamp:"Y-m-d":"UTC"` documented; `to_timestamp:timezone?` documented for date text. Only `"now"` as its input is unverified → remains as REVIEW. | filter-reference/timestamp, transform |
| 3 `index_by` key type | Removed (#17). | — |
| 4 omitted optional = null | Not stated in the docs. `int? x?` (nullable + optional) and `set_ifnotnull` are documented. Remains as REVIEW (one Run & Debug call settles it). | key-concepts input options |
| 5 paged query `.items` | Confirmed: paged `list` results are wrapped and fields are addressed as `items.field`. Guard kept, marker removed. | database-operations |
| 6 element by index | `slice:offset:length` + `first` documented; bracket/dot index also documented. Kept `slice`. | filter-reference/array, expression page |
| 7 ternary / `$this` with outer vars | Ternary documented (`1 < 2 ? 3 : 4`, and used in the docs' own custom-function example). Outer variables inside `array.* if (\`…\`)` are not addressed by the docs → remains as REVIEW. | expression page, custom-functions |
| `auth = "user"` | Documented (key-concepts "API with authentication"). | key-concepts |
| `for (5)` | Must be ``for (`5`)`` — fixed (#6). | loops |
| `int[]`, `json`, `int?` inputs | Documented. | key-concepts, field-type-reference |
| `|in:`, `|is_empty`, `|is_array`, `|first_notempty`, `|has`, `|unique`, `|sort`, `|min/max/round/ceil`, `|split/last/trim/replace/contains/starts_with/to_lower`, `|set/get/unset/merge` | Documented. | filter references |
| `precondition` `error_type` values | Docs show `notfound`, `accessdenied`; `badrequest`, `inputerror`, `unauthorized` match Xano's precondition error-type list. Low risk. | utility-functions |

## Remaining uncertainties for the owner (check in the editor)

1. `"now"|to_timestamp:"UTC"` (`roadmap_build`, `roadmap_progress`, `dashboard_get`) — if it yields null/0, use the `now` expression variable instead.
2. Omitted optional inputs arrive as `null` (`goal_patch`, `roadmap_generate.placement_override`).
3. Outer variables referenced inside `array.filter/find/has/filter_count … if (…)` conditions.
4. `user_goals.due_date` (`date`) comes back as `"YYYY-MM-DD"` text and accepts `null`.
5. Column existence: `user.bio` (harmless if absent), `mini_lesson_completions.slug/passed/completed_at/mini_lesson_id`, `courses.status/competency_id/level/duration`, `assessment_questions.active/skill_id/question_json.{stem, options[{text,correct}], feedback.{correct,incorrect}, source.lesson_slug}`.
6. `db.query … return={type:"single"}` returns `null` (not an error) when nothing matches — assumed throughout.
7. Legacy `PATCH /profile`: auth mechanism (#14) and the `user_current_industry` type (#13).

## Files changed in this pass

- `docs/xano/functions/roadmap_build.xs` — #5, #6, #9, #10, #11, #17, #18, #19, #20, REVIEW notes.
- `docs/xano/functions/roadmap_progress.xs` — #3.
- `docs/xano/onboarding/onboarding_answer.xs` — #6, REVIEW 6 note.
- `docs/xano/onboarding/onboarding_lesson_pick.xs` — #6, #18.
- `docs/xano/onboarding/onboarding_claim.xs` — #5, #18.
- `docs/xano/platform/roadmap_generate.xs` — #4, #6, REVIEW 4 note.
- `docs/xano/platform/roadmap_patch.xs` — #4, #7.
- `docs/xano/platform/roadmap_get.xs` — #7.
- `docs/xano/platform/dashboard_get.xs` — #8, REVIEW 5 resolved.
- `docs/xano/platform/lessons_get.xs` — #17.
- `docs/xano/platform/goal_patch.xs` — REVIEW note only.
- `docs/xano/README.md` — #23.
- `docs/fixtures/dashboard_get.json`, `docs/fixtures/roadmap_get.json` — #2, #21.
- `strive-dashboard.js` — #2 (`normalize()` progress aliasing; no other change).
- Not edited: `strive-roadmap.js` / `.css` (#1, #12, #13, #15 listed above), `strive-onboard.js` (no mismatch found).
