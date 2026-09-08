# strive-engine

CDN-hosted front-end **engines** for the STRIVE learning platform. These are the
shared renderers that turn a JSON content record (served from Xano) into a fully
styled page inside Webflow. Content is data; these files are the renderer.

**Live CDN:** https://strive-engine.netlify.app/ (auto-deploys from this repo)

## Files served

| File | What it is |
|---|---|
| `strive-lesson.js` / `strive-lesson.css` | Mini-lesson engine. Renders a lesson from `lesson_json`. Scoped under `#strive-lesson .sl-*`. |
| `strive-course.js` / `strive-course.css` | Course engine. Renders a course from `course_json` via `STRIVECourse.render(data, mount)` / `STRIVECourse.load({url})`. Scoped under `#strive-course .sc-*`. |
| `strive-onboard.js` / `strive-onboard.css` | Onboarding / assessment engine for `/get-started`. Anonymous adaptive ladder → teaser → one remediation mini-lesson rendered inline (loads the lesson engine from this CDN on demand). Scoped under `#strive-onboard .onb-*`. `?mock=1` renders from `docs/fixtures/` without Xano; `preview-onboard.html` is the local harness. Contract: `docs/onboarding-roadmap-spec.md`. |
| `strive-roadmap.js` / `strive-roadmap.css` | Post-signup engine for `/welcome-onboard`: claims the assessment session, shows results, guided roadmap review, SMART-style goals, then profile. `STRIVERoadmap.init({mount, platform, onboarding, authToken, msToken, onboardToken, …})`. Scoped under `#strive-roadmap .rm-*`. `#roadmap` deep-links to the review step; `?mock=1` + `preview-roadmap.html` for local review. |
| `strive-dashboard.js` / `strive-dashboard.css` | Member dashboard engine for `/dashboard`: profile header, next-up lesson, roadmap progress, goals, recent completions. `STRIVEDashboard.init({mount, platform, authToken, msToken})`. Scoped under `#strive-dashboard .dsh-*`. `?mock=1` + `preview-dashboard.html`. |
| `strive-library.js` / `strive-library.css` | Course library catalog for `/catalog`. Scoped under `#strive-library .slib-*`. |

All engines are **parallel and independent** — different namespaces, no shared
code — so a change to one can never break another. The `webflow-*-embed.html`
files are the exact snippets pasted into each Webflow page (auth exchange, mount,
init call). The `preview-*.html` pages load the local files with fixtures from
`docs/fixtures/` so a change can be reviewed in a browser without Xano or Webflow.

## Onboarding → roadmap → dashboard

The end-to-end journey (assessment → signup → results/roadmap/goals/profile →
dashboard) is specified in `docs/onboarding-roadmap-spec.md`. The Xano side of
it (new tables, endpoints, roadmap generation rules) lives as paste-ready
XanoScript in `docs/xano/` with a runbook (`docs/xano/README.md`) and a smoke
test (`docs/xano/smoke_test.py`). Memberstack must redirect to `/welcome-onboard`
after signup.

## How it's used (Webflow)

Each dynamic template page loads the relevant engine from this CDN and mounts it:

```html
<link rel="stylesheet" href="https://strive-engine.netlify.app/strive-course.css">
<script src="https://strive-engine.netlify.app/strive-course.js"></script>
<div id="strive-course"></div>
<script>
  STRIVECourse.load({
    mount: '#strive-course',
    url: 'https://x8ki-letl-twmt.n7.xano.io/api:fykJB1SM/course?course_id=' + COURSE_ID
  });
</script>
```

## Deploying

This repo is connected to Netlify. **Push to `main` → Netlify auto-deploys.**
No more manual folder drag-and-drop. Edit a file, commit, done.

All engine files live at the **repo root** so they're served at the CDN root
(e.g. `/strive-course.js`). Do not nest them in subfolders.

## Conventions

Per STRIVE Tech Conventions: *docs live with the code*. Keep this README and any
engine-level notes current as part of "done" for a change. Xano remains the source
of truth for content; these engines only render it.
