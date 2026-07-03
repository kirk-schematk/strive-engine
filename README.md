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

The two engines are **parallel and independent** — different namespaces, no shared
code — so a change to one can never break the other.

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
