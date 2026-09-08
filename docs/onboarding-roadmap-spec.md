# Onboarding → Roadmap → Dashboard: build contract

Status: agreed 2026-09-02 (Kirk). This is the single contract the backend, the three
front-end engines, and the content sync are built against. Change it here first.

## 1. User journey

| Step | Page (Webflow) | Engine (this repo) | Auth |
|---|---|---|---|
| 1 | `/get-started` | `strive-onboard.js/.css` (existing, extended) | none |
| 2 | `/signup` | Memberstack form (existing). **Memberstack must redirect to `/welcome-onboard` after signup.** | Memberstack |
| 3 | `/welcome-onboard` | `strive-roadmap.js/.css` (new) | Memberstack → Xano |
| 4 | `/dashboard` | `strive-dashboard.js/.css` (new) | Memberstack → Xano |
| — | `/lesson?slug=` , `/course?slug=` | existing engines | optional |

### Step 1 — assessment (anonymous)
discipline → goal → concept card → adaptive ladder (6–8 Qs) → **teaser** (archetype,
phase label, accuracy, headline) → **one remediation mini-lesson rendered inline**
("Fix your weakest answer in ~6 minutes") → signup CTA. The CTA is visible from the
teaser onward; the lesson is optional.

- Session token persists in `localStorage['strive_onboard_token']` (existing) **and**
  a cookie `strive_onb=<token>; path=/; max-age=2592000; SameSite=Lax` (new fallback).
- Lesson pick rule (server): first wrong answer's `skill_id` → that mini-lesson
  (`reason:"remediation"`). If no wrong answers: a phase-5 lesson in a domain the
  session never asked about (`reason:"stretch"`).
- The lesson is rendered with the existing lesson engine (`STRIVE.renderLesson`,
  loaded on demand from the CDN), no auth, no completion POST. When the quiz inside
  it is passed, call `onboarding_lesson_done` so the roadmap can mark it done later.

### Step 3 — welcome-onboard (post-signup)
Rail: **Results → Roadmap → Goals → Profile**. On load:

1. Memberstack cookie → `POST /memberstack_auth` → `authToken` (Bearer).
2. Read onboard token (localStorage, then cookie).
3. If token present → `POST /onboarding_claim` (auth). Server links the session,
   writes placement onto the user, generates the roadmap, returns results + roadmap +
   suggested goals. Idempotent.
4. If no token → `GET /roadmap`. If a roadmap exists, skip to Roadmap step. If not,
   show the **quick-start** card: "Take the 6-minute assessment" (→ `/get-started`)
   or "Build from my answers" (discipline, goal, self-rated phase →
   `POST /roadmap_generate` with `source:"self"`).

Screens:
- **Results**: archetype badge, phase, accuracy, headline, domain breakdown
  (asked/correct per domain), question review (stem, your answer, correct, feedback,
  link to the lesson for that skill). Button "Build my roadmap".
- **Roadmap review** with guided prompts, in order:
  1. "Does *{phase label}* feel right?" — Yes / I'm earlier / I'm further along
     → regenerate with `placement_override` ±1.
  2. "Where are you now, where are you headed?" — `current_role`, `target_role`
     (free text, suggestion chips from phase labels).
  3. "Time per week?" — chips 30 / 60 / 120 / 240 minutes (default 60).
  4. "Focus areas" — the five domains as toggles (all on). Any change → regenerate.
  5. The plan: summary paragraph, milestones (collapsible), items with minutes and
     competency; remove item (×), move milestone up/down. "Looks good" →
     `PATCH /roadmap {status:"confirmed", milestones}`.
- **Goals**: suggested goals prefilled (title, description, due date, metric).
  Toggle keep, edit title/date, add custom goal (title + due + either pick lessons
  from the roadmap or "I'll tick this off myself"). Save → `POST /goals`.
- **Profile**: first/last name, location, company, industry (from
  `profile_dropdown_options`), current role (prefilled from prompt 2), photo
  (optional). Save → `PATCH /profile` (+ `POST /profile_photo`). Skip allowed.
  Then redirect `/dashboard`.

### Step 4 — dashboard
One call: `GET /dashboard`. Sections: profile header (photo, name, role, company,
archetype + phase badge), **Next up** card (next roadmap item → Start), roadmap
progress by milestone, goals with progress bars and due/overdue state (manual goals
have a "Done" button), recent completions, links "Edit roadmap" (→
`/welcome-onboard#roadmap`) and "Retake assessment" (→ `/get-started`). Inline
profile edit (`PATCH /profile`).

## 2. Xano changes

Workspace 163196. Onboarding group `api:m2bNDxnv` (id 428916). Platform group
`api:fykJB1SM` (id 417827). All new authenticated endpoints go in **Platform** so the
front end uses one base + one token.

### Schema
- `mini_lessons` (862745): add `phase` int (1–5). Source: Notion Skills DB
  "Career Phase" keyed by `SKL-n` → see `docs/fixtures/skill_phase.json`.
- `onboarding_sessions` (880075): add `remediation_slug` text, `remediation_reason`
  text, `remediation_done` bool.
- **new `user_roadmaps`**: `user_id` int (unique), `onboarding_session_id` int|null,
  `source` enum(assessment, self), `placement_phase` int, `placement_override` int|null,
  `target_phase` int, `goal` text, `discipline` text, `inputs_json` json,
  `roadmap_json` json, `status` enum(proposed, confirmed), `confirmed_at` ts|null,
  `version` int, `updated_at` ts.
- **new `user_goals`**: `user_id` int, `roadmap_id` int, `title` text,
  `description` text, `metric_json` json, `target_count` int, `due_date` date,
  `status` enum(active, done, dropped), `sort_order` int, `completed_at` ts|null.
  Index (user_id).

### Endpoint fixes
- `onboarding_answer`: next-question selection must exclude every `question_id`
  already in `questions_served` (bug: session 5 was served question 15 seven times).
  If the pool for the target phase is exhausted, stop the session (`done:true`).
- `onboarding_claim`: **auth required** (user table). Input `session_token`.
  Behaviour: 404 if unknown; if `status=claimed` by another user → 403; if claimed by
  this user → return current results + roadmap (idempotent). Else set `user_id`,
  `status=claimed`, `claimed_at`; write `user.discipline, goal, placement_phase,
  onboarding_session_id`; run roadmap generation (source `assessment`); return
  `{results, roadmap, goals_suggested}` where `results` =
  `{archetype, placement_phase, phase_label, discipline, goal, headline, accuracy,
  questions_answered, questions_correct, phase_correct_counts,
  domains:[{domain, name, asked, correct}],
  review:[{question_id, stem, options, answer_index, correct_index, correct, feedback,
  skill_id, lesson_slug, lesson_title}]}`.
  (`review` is safe to release post-signup; the teaser stays locked as today.)

### New endpoints — Onboarding group (public)
- `POST /onboarding_lesson_pick {session_token}` →
  `{slug, title, est_minutes, competency, domain, phase, reason:"remediation"|"stretch",
  question_stem|null, message}`. Persists `remediation_slug/reason` on the session.
  Session must be `completed` or `claimed`.
- `POST /onboarding_lesson_done {session_token, slug}` → `{ok:true}`. Sets
  `remediation_done=true` when slug matches.

### New endpoints — Platform group (auth: user)
- `POST /roadmap_generate` body (all optional):
  `{source, placement_phase, placement_override, goal, discipline, current_role,
  target_role, weekly_minutes, focus_domains:[int]}` → upserts `user_roadmaps`
  (status `proposed`, version+1) → `{roadmap, goals_suggested}`.
- `GET /roadmap` → `{roadmap|null, goals:[...], next_item|null, stats}` with per-item
  `done` computed from `mini_lesson_completions` (and, for the remediation lesson,
  the session flag).
- `PATCH /roadmap {status?, inputs?, milestones?}` → same shape as GET. `milestones`
  replaces the milestone array (client may remove items / reorder milestones only;
  server re-validates slugs exist).
- `POST /goals {goals:[{title, description, metric, target_count, due_date}]}` →
  replaces all `active` goals for the user → `{goals}`.
- `PATCH /goal {id, title?, description?, due_date?, status?}` → `{goal}`.
- `DELETE /goal {id}` → `{ok:true}`.
- `GET /dashboard` → `{user:{first_name,last_name,email,location,company,industry,
  current_role,desired_role,profile_photo,discipline,goal,placement_phase,
  phase_label,archetype}, roadmap_summary:{status,target_phase,totals,
  milestones:[{id,title,phase,domain,items_total,items_done}]}, next_item,
  goals:[...with progress], recent_completions:[{slug,title,completed_at}], stats}`.

### Roadmap JSON (stored in `user_roadmaps.roadmap_json`, returned everywhere)
```json
{
  "version": 1, "generated_at": "2026-09-02T14:00:00Z", "source": "assessment",
  "placement_phase": 2, "target_phase": 3,
  "phase_labels": {"1":"Student","2":"Modeler","3":"Coordinator","4":"Project BIM Manager","5":"Director"},
  "archetype": "Builder", "goal": "Step up to the next role", "discipline": "Architecture",
  "inputs": {"current_role":"", "target_role":"", "weekly_minutes":60, "focus_domains":[1,2,3,4,5]},
  "summary": "You placed at Modeler (Builder). …",
  "weak_domains": [{"domain":1,"name":"Technical & Computational Proficiency","asked":3,"wrong":2}],
  "milestones": [
    {"id":"m1","title":"Close the gaps from your assessment","why":"…","phase":2,"domain":null,"deferred":false,
     "items":[{"type":"lesson","slug":"level-of-information-need","title":"…","minutes":6,
               "competency":"Model Authoring","domain":1,"phase":2,"skill_id":"SKL-3","done":false}]}
  ],
  "totals": {"items": 24, "minutes": 150, "done": 0}
}
```
Item `type` is `lesson` or `course`; courses have `slug`, `title`, `minutes` (parsed
from duration), `competency`, `level`.

### Generation rules (server-side function `roadmap_build`, reused by claim + generate)
Inputs: `P` = placement (override wins), `goal`, `discipline`, wrong `skill_id`s and
per-domain asked/wrong from the session (empty for `self`), `weekly_minutes`
(default 60), `focus_domains` (default all).

1. Target phase `T` and domain weights by goal:
   - "Level up in my current role": `T=P`; weights all 1; weak domains first.
   - "Step up to the next role": `T=min(P+1,5)`; phases `P` and `T`.
   - "Move into BIM/digital": `T=max(P,2)`; domains 1,2 weight 2, domain 3 weight 1.5.
   - "Keep my team current": `T=P`; domains 4,5 weight 2 and also include phase
     `min(P+1,5)` for domains 4,5.
2. Discipline nudge (competencies listed first inside a domain):
   Architecture/Engineering → Model Authoring, Data Enrichment; Construction → Clash
   Resolution, BEP Compliance, Model Federation & Validation; Operations & FM →
   Delivery & Handover, Information Specification, CDE Utilization; Client/Owner →
   Information Specification, Strategic Planning, Capability Assessment; Other → none.
3. Milestone `m1` "Close the gaps from your assessment": lessons whose `skill_id` is
   in the wrong set, any phase. Omit if empty.
4. For phase `p` in `P..T`, for domains ordered by weight desc then domain number,
   one milestone per (phase, domain) with ≥1 published lesson where
   `mini_lessons.phase = p` and the lesson's competency belongs to that domain.
   Title `"{phase label}: {domain short name}"` (strip "Domain n: "). Items sorted
   by competency (nudge order, then name) then numeric `SKL-n`. Exclude anything in `m1`.
5. Courses: for each published course whose `competency_id` appears in a milestone
   and whose level maps into `P..T` (Beginner→1–2, Intermediate→3, Advanced/"Advances"→4–5),
   append it as the last item of that milestone.
6. Soft cap 40 lesson items: milestones beyond the cap keep their items but get
   `deferred:true`. Domains not in `focus_domains` are also `deferred:true`.
7. `summary` template: "You placed at {P label} ({archetype}). Your goal is
   '{goal}', so this plan takes you to {T label}. It starts by closing {n} gaps from
   your assessment, then works through {domain names} at {phase label} level. About
   {hours}h of lessons at {weekly} min/week — roughly {weeks} weeks."
8. `goals_suggested` (not persisted until `POST /goals`):
   - "Close my assessment gaps" — metric `{type:"lessons", slugs:[m1 slugs]}`, due +14d (if m1).
   - "Finish {first non-gap milestone title}" — metric its slugs, due `+max(2, ceil(minutes/weekly))` weeks.
   - "Reach {T label} level" — metric all non-deferred slugs, due `+ceil(total_minutes/weekly)` weeks.
   - For "Keep my team current" replace the third with "Complete 3 leadership &
     communication lessons and share one with my team" — metric
     `{type:"lessons", slugs:[domain-5 slugs], count:3}`.
   Goal metric types: `lessons` (progress = completed slugs / target) and `manual`.

## 3. Front-end engine contracts

Repo conventions: each engine is standalone (own namespace, no shared code), files at
repo root, design tokens copied from `strive-onboard.css` (Sora / Manrope /
JetBrains Mono; teal `#006879`, orange `#e28001`, ink `#0b1f2a`), Lucide-style
inline SVG icons (no emoji), retry + backoff on 429/5xx, graceful error card.

- `strive-onboard.js` (extend): after teaser → `onboarding_lesson_pick` → render the
  lesson inline under the results with the CDN lesson engine → `onboarding_lesson_done`
  on quiz pass → CTA `/signup`. Set the cookie. Rail step 4 stays "Sign up".
- `strive-roadmap.js` → `window.STRIVERoadmap.init({ mount:'#strive-roadmap',
  platform:'…/api:fykJB1SM', onboarding:'…/api:m2bNDxnv', afterProfileHref:'/dashboard' })`.
  Scoped `#strive-roadmap .rm-*`. Supports `?mock=1` to render `docs/fixtures/*.json`.
- `strive-dashboard.js` → `window.STRIVEDashboard.init({ mount:'#strive-dashboard',
  platform:'…' })`. Scoped `#strive-dashboard .dsh-*`. Supports `?mock=1`.
- Webflow embeds: `webflow-roadmap-embed.html`, `webflow-dashboard-embed.html`
  (same pattern as the existing embeds: fonts, CDN css/js, mount div, Memberstack →
  Xano token exchange, init call).
- Preview pages: `preview-roadmap.html`, `preview-dashboard.html` load the engine
  with fixtures for local review.

Fixtures (`docs/fixtures/`): `claim_response.json`, `roadmap_get.json`,
`dashboard_get.json`, `lesson_pick.json`, `skill_phase.json`.
