# Course knowledge checks

Per-module formative checks rendered by the course engine (`strive-course.js`
/ `strive-course.css`, v1.2.0+). Content is data: a module gains a check by
carrying a `check` object in `course_json`. A module without one renders
exactly as before — the feature is additive and no existing course changes.

## How it behaves

- One question at a time, inside the module (after **Try it**, before the
  paid **Learn more** card).
- **Right answer** → confirmation feedback → *Next question*.
- **Wrong answer** → the chosen option turns orange, the correct one is
  revealed, and a **mini-lesson** opens: a short card in the mini-lesson
  engine's styling (eyebrow, title, body, key points, a "remember" note, and
  an optional button that jumps the module video back to the relevant
  timestamp). The only way on is *Try this question again* — the check exists
  to close the gap, not to score.
- Finishing all questions marks the check passed, stores that in
  `localStorage` under `strive_check_<courseId>_m<n>`, and ticks the module in
  the paged-mode stepper. A passed check re-opens in its completed state and
  offers *Retake the check*.
- A pass is recorded in Xano when the page has a member token (see
  **Tracking** below), so it follows the member across devices. Signed out,
  the check still works and remembers itself locally.

## Tracking

Passing a check writes to Xano, and grading happens **there** — the client
sends which option it picked per question, and the server re-grades against
the check stored in `course_json`. A client cannot mark its own check
complete. Same rule as the mini-lesson quiz.

| Piece | Where |
|---|---|
| Table `course_check_completions` (888032) | one row per (user, course, module): `score`, `total`, `helped`, `attempts`, `passed` (sticky), `completed_at` (first pass), denormalized `course_id` / `module_title` |
| `POST /course/check_complete` (auth) | `{course_id, module_index, answers:[int], helped}` → `{ok, passed, score, total}`; upserts the row |
| `GET /course/check_completions?course_id=` (auth) | `{items:[…], passed_modules:[int]}` — omit `course_id` for every course |
| XanoScript | `docs/xano/platform/course_check_complete.xs`, `…/course_check_completions_get.xs` |

The engine takes it through `opts.checks`:

```js
STRIVECourse.load({
  mount: '#strive-course',
  data: course,
  checks: {
    completeUrl: XANO + '/course/check_complete',
    courseId:    course.courseId,
    authToken:   memberToken,   // null when signed out → local-only
    completions: items,         // from GET /course/check_completions
    onCheckPass: function (res) {}   // optional
  }
});
```

`webflow-course-embed.html` already does the Memberstack → Xano token
exchange, loads the completions, and reloads when the login state flips.

State resolution on load: a Xano `passed` row wins, then `localStorage`
(`strive_check_<courseId>_m<n>`). A failed POST never un-does the pass the
learner just earned on screen — the local copy carries it until the next load.

**Status:** live as of 2026-09-09 — table 888032, endpoints 4043102 and
4043103, both verified against the live instance (a wrong, empty, or fabricated
answer list cannot pass; `passed` is sticky; `attempts` counts). See
`docs/xano/README.md`.

## Shape

```jsonc
"check": {
  "eyebrow": "Knowledge check",      // optional, defaults to "Knowledge check"
  "intro": "Three questions on …",   // optional
  "doneText": "Check passed — …",    // optional
  "questions": [
    {
      "q": "Question text (inline HTML allowed)",
      "options": [
        { "text": "Wrong option" },
        { "text": "Right option", "correct": true }
      ],
      "okFeedback": "Shown when they get it right.",
      "noFeedback": "Shown above the mini-lesson when they don't.",
      "miniLesson": {
        "eyebrow": "Mini-lesson · instance vs. type",
        "title": "Short, memorable framing",
        "body": "Two or three sentences that re-teach the concept.",
        "points": ["Key point", "Key point", "Key point"],
        "note": { "label": "Remember", "text": "The one line to keep." },
        "rewatch": { "label": "Rewatch: slope arrows (~13:30)", "start": 810 }
      }
    }
  ]
}
```

`rewatch.start` is seconds into the module video; omit it to simply scroll
back to the player. Only give a timestamp you have actually verified in the
video — a wrong one is worse than none.

## Authoring guidance

- **Three questions per module** works well: one on the module's core idea,
  one on a decision the learner will actually face, one on the trap that
  wastes an afternoon.
- Test understanding, not recall of the video's wording. "Which walls change?"
  beats "What is the Properties palette?"
- Every distractor should be something a beginner would plausibly believe.
- The mini-lesson teaches the *concept*, not the question. Someone who reads
  it should be able to answer any question on that idea.

## Live example

`CRS-revit-basics-arch-checks` (slug `revit-basics-for-architecture-checks`) —
a copy of the Revit basics course with 18 checks across 6 modules. Created
2026-09-09 as **status `draft`**, so it does not appear in `/courses` or the
catalog; flip the status to `published` in Xano when it should go live.

Local review without Xano:

```bash
python -m http.server 8765
```

then open `preview-course.html?mock=1`, which renders
`docs/fixtures/course_revit_basics_checks.json` — the same JSON that is
stored in the Xano record.
