# Mini-lesson authoring standard

How a STRIVE mini-lesson gets from a skill to the live site. Every lesson, from
every author (human or Claude), goes through the same six gates.

- **Framework master:** the Notion Skills DB (STRIVE / Competency Frameworks and
  Tracking / Skills). `content/skills.json` is a read-only snapshot of it. Re-pull,
  never hand-edit.
- **Lesson drafts:** `content/lessons/<slug>.json`, one file per lesson, shape in
  `lesson.schema.json`. Git history is the version history.
- **Published content:** Xano `mini_lessons`. A file is pushed as `draft`, reviewed
  on the real page, then flipped to `published` by an approver.

## Lesson types

| Type | Level taught | Purpose |
|---|---|---|
| `core` | skill target | The concept. The original 200. |
| `apply` | skill target | A realistic project scenario where the learner makes the judgement named in the skill's Acceptance Criteria. |
| `ladder` | below target | A step up to the target for L3/L4 skills. |
| `refresher` | skill target | 2-minute retrieval only, offered 2 to 4 weeks after the core lesson. |

Levels: 1 Awareness, 2 Working, 3 Advanced, 4 Expert. A lesson never teaches above
its skill's target level.

## The six gates

### 1. Brief
One skill, one level, **one objective**. Write the objective from the skill's
Acceptance Criteria, starting with a verb that fits the level (L1 identify/explain,
L2 apply/select, L3 diagnose/configure/prioritise, L4 evaluate/justify/govern).
Name the **misconception** the lesson corrects: distractors are built from it.

### 2. Draft
Format: hero → 2 or 3 short Parts → "Judge it" widget → knowledge check → recap.

- 3 to 7 minutes. Cut anything that does not serve the objective.
- Teach a term before using it (`terms` or `note` block).
- Worked example first, then the learner does one with less support.
- Scenario is a real project situation for the phase's role, with enough detail
  (stage, discipline, deliverable) that the right answer depends on it.
- Knowledge check: apply and ladder lessons need 2+ questions that ask the learner
  to *use* the idea, not recognise a definition. Every wrong option is a real
  misconception. `noFeedback` re-teaches; it never just says "wrong".
- No "all/none of the above". Correct option not always the longest or in the same slot.
- Recap: 3 to 4 takeaways, last one a "try this on your project this week" prompt.
- House rules: percentages not currency, no region call-outs, plain reading level,
  no emoji-only meaning (icons decorate, text carries the point).

### 3. Fact check (independent of the drafting pass)
- **Claim ledger** (`claims[]`): every definition, requirement of a standard,
  statistic and software behaviour, each with `source_ids` and a `locator`.
- **Source ranking:** standards bodies and primary documents (ISO, buildingSMART,
  NRC / national guidance) → peer-reviewed or major industry surveys → vendor
  documentation. Blogs, Wikipedia and social posts never stand alone.
- **Source packs:** `content/sources/<competency-slug>.json` holds sources already
  opened and confirmed, with edition and key passages. Draw on the pack first. A
  source outside the pack gets the full check, then joins the pack, and the lesson
  is flagged for a second look.
- The checker opens each source and sets `claims[].verified`. The drafter never
  sets it. A claim that cannot be verified is rewritten or cut.
- ISO text is paraphrased and cited, never reproduced.

### 4. Alignment check
A reviewer that sees **only the lesson text** picks the skill and level from all
200. Result goes in `review.alignment`. A wrong pick means the lesson is off-target
or overlaps another lesson: fix the lesson, do not overrule the check. Every quiz
question must test the stated objective.

### 5. Learning-design score
`review.pedagogy_score` out of 10, one point each: single objective · terms taught
first · worked example · faded practice · application-level questions ·
misconception-based distractors · re-teaching feedback · authentic scenario ·
transfer prompt · accessible (tap + keyboard, alt text, plain language). Below 8
goes back to draft.

### 6. Validate, stage, approve, publish
```
npm run validate:lessons            # errors block the push
preview-lesson.html?file=<slug>     # reviewer view with the check strip
```
Push as `draft`; an approver reviews on the live lesson page and publishes.
`review.approved_by` / `approved_at` are recorded. Two approvers, split by domain;
10% of each person's approvals get a second look from the other, plus every lesson
with an out-of-pack source, a statistic, or a near-miss alignment result.

## Review dates
`review_due` = 12 months after approval; 6 months for lessons about specific
software versions. Revision of a cited standard triggers review immediately.
The validator warns on anything overdue.
