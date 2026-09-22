#!/usr/bin/env node
/* Validates lesson authoring files (content/lessons/*.json).

     node tools/validate-lesson.js                 every file in content/lessons
     node tools/validate-lesson.js <file> [...]    just these
     node tools/validate-lesson.js --engine <file> a bare lesson_json (e.g. a fixture): structure only

   Structure comes from lesson.schema.json. Everything below it is a content rule
   from docs/lesson-authoring.md: skill alignment, sources, quiz quality, length.
   ERROR blocks a push to Xano; WARN is for the reviewer to weigh. Exit 1 on any error. */
const fs = require("fs"), path = require("path");
const Ajv = require("ajv");

const ROOT = path.join(__dirname, "..");
const schema = JSON.parse(fs.readFileSync(path.join(ROOT, "lesson.schema.json"), "utf8"));
const SKILLS = JSON.parse(fs.readFileSync(path.join(ROOT, "content", "skills.json"), "utf8"));
const skillById = Object.fromEntries(SKILLS.skills.map((s) => [s.skill_id, s]));
const levelName = Object.fromEntries(SKILLS.levels.map((l) => [l.level, l.name]));

const ajv = new Ajv({ allErrors: true, strict: false, validateFormats: false });
const validateFile = ajv.compile(schema);
const validateEngine = ajv.compile({ ...schema.definitions.lessonJson, definitions: schema.definitions });

/* Verbs that fit each proficiency level (Bloom-style). The objective's first verb
   must come from the lesson's level or the one below it. */
const LEVEL_VERBS = {
  1: ["identify", "name", "describe", "explain", "recognise", "distinguish", "match", "list", "define", "summarise", "read"],
  2: ["apply", "use", "select", "choose", "produce", "build", "complete", "check", "set", "prepare", "trace", "fix", "model", "run", "export"],
  3: ["analyse", "audit", "diagnose", "configure", "prioritise", "plan", "coordinate", "evaluate", "decide", "specify", "resolve", "review", "detect", "assess"],
  4: ["evaluate", "justify", "design", "govern", "direct", "defend", "set", "benchmark", "weigh", "prioritise", "decide", "judge"],
};
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const strip = (html) => String(html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const words = (s) => (strip(s).match(/\S+/g) || []).length;

/* Every learner-visible string in lesson_json, with a rough location label. */
function collectText(lj) {
  const out = [];
  const walk = (v, where) => {
    if (typeof v === "string") out.push({ where, text: strip(v) });
    else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${where}[${i}]`));
    else if (v && typeof v === "object") for (const k of Object.keys(v)) if (!["type", "widget", "icon", "accent", "tagColor", "correct", "good"].includes(k)) walk(v[k], `${where}.${k}`);
  };
  (lj.sections || []).forEach((s, i) => walk(s, `sections[${i}]`));
  return out;
}

function checkEngineShape(lj, E, W) {
  const secs = lj.sections || [];
  if (!secs[0] || !secs[0].hero || !secs[0].h1) E("sections[0] must be the hero section with an h1");
  secs.slice(1).forEach((s, i) => { if (!s.h2) E(`sections[${i + 1}] needs an h2`); if (s.hero) E(`sections[${i + 1}]: only the first section may be the hero`); });
  const blocks = secs.flatMap((s) => s.blocks || []);
  const quizzes = blocks.filter((b) => b.type === "quiz");
  if (quizzes.length !== 1) E(`exactly one quiz block per lesson (found ${quizzes.length}); the engine completes on it`);
  if (!blocks.some((b) => b.type === "recap")) E("missing a recap block");
  const last = secs[secs.length - 1];
  if (last && !(last.blocks || []).some((b) => b.type === "recap")) W("the recap is usually the last section");

  blocks.filter((b) => b.type === "widget" && b.widget === "caseCards").forEach((b) => {
    const cs = (b.config && b.config.cases) || [];
    if (cs.length < 3) E("caseCards needs at least 3 cases");
    if (!cs.some((c) => c.good) || !cs.some((c) => !c.good)) E("caseCards needs at least one good and one not-good case");
    cs.forEach((c, i) => { if (!c.title || !c.why || words(c.why) < 8) E(`caseCards case ${i + 1}: needs a title and a 'why' that explains the verdict (8+ words)`); });
  });

  let correctIsLongest = 0, nQ = 0; const positions = [];
  quizzes.forEach((qz) => (qz.config.questions || []).forEach((q, qi) => {
    nQ++;
    const right = q.options.filter((o) => o.correct);
    if (right.length !== 1) E(`quiz q${qi + 1}: exactly one correct option (found ${right.length})`);
    const lens = q.options.map((o) => strip(o.text).length), ci = q.options.findIndex((o) => o.correct);
    positions.push(ci);
    if (ci >= 0 && lens[ci] === Math.max(...lens) && lens.filter((l) => l === lens[ci]).length === 1 && lens[ci] > 1.4 * Math.max(...lens.filter((_, i) => i !== ci))) correctIsLongest++;
    if (new Set(q.options.map((o) => strip(o.text).toLowerCase())).size !== q.options.length) E(`quiz q${qi + 1}: duplicate options`);
    q.options.forEach((o) => { if (/\b(all|none) of the above\b/i.test(o.text)) W(`quiz q${qi + 1}: avoid "all/none of the above"; write a distractor from a real misconception`); });
    if (strip(q.noFeedback).toLowerCase() === strip(q.okFeedback).toLowerCase()) E(`quiz q${qi + 1}: noFeedback must re-teach, not repeat okFeedback`);
  }));
  if (nQ && correctIsLongest === nQ) W("the correct option is clearly the longest in every question; learners will spot the pattern");
  if (nQ >= 3 && new Set(positions).size === 1) W("the correct option is in the same position in every question");
  return { nQ, blocks };
}

function checkFile(file) {
  const errors = [], warns = [];
  const E = (m) => errors.push(m), W = (m) => warns.push(m);
  let doc;
  try { doc = JSON.parse(fs.readFileSync(file, "utf8")); } catch (e) { return { errors: ["not valid JSON: " + e.message], warns }; }

  if (!validateFile(doc)) { validateFile.errors.slice(0, 12).forEach((e) => E(`schema ${e.instancePath || "/"} ${e.message}`)); return { errors, warns }; }
  const lj = doc.lesson_json;

  /* --- identity + skill alignment --- */
  if (path.basename(file, ".json") !== doc.slug) E(`file name must be ${doc.slug}.json`);
  if (lj.slug !== doc.slug) E("lesson_json.slug differs from slug");
  if (lj.skillId !== doc.skill_id) E("lesson_json.skillId differs from skill_id");
  const skill = skillById[doc.skill_id];
  if (!skill) E(`${doc.skill_id} is not in content/skills.json`);
  else {
    if (doc.competency_id !== skill.competency_id) E(`competency_id ${doc.competency_id} but ${doc.skill_id} belongs to ${skill.competency_id} (${skill.competency})`);
    if (doc.phase !== skill.phase) E(`phase ${doc.phase} but ${doc.skill_id} is phase ${skill.phase}; a wrong phase drops the lesson out of roadmap milestones`);
    if (doc.lesson_level > skill.target_level) E(`lesson_level ${doc.lesson_level} is above the skill's target level ${skill.target_level} (${levelName[skill.target_level]})`);
    if (["apply", "practise", "mix"].includes(doc.lesson_type) && doc.lesson_level !== skill.target_level) E(`apply, practise and mix lessons teach at the skill's target level (${skill.target_level})`);
    if (doc.lesson_type !== "core" && doc.slug === skill.core_lesson_slug) E("slug collides with the skill's core lesson");
    if (!lj.meta.some((m) => m.includes(doc.skill_id))) W("meta pills should include the skill id");
    if (!lj.meta.some((m) => m.includes("L" + doc.lesson_level))) W(`meta pills should show the level (L${doc.lesson_level} ${levelName[doc.lesson_level]})`);
  }
  const verb = (doc.objective.toLowerCase().match(/[a-z]+/) || [""])[0];
  const okVerbs = [...(LEVEL_VERBS[doc.lesson_level] || []), ...(LEVEL_VERBS[doc.lesson_level - 1] || [])];
  if (!okVerbs.includes(verb)) W(`objective starts with "${verb}"; for L${doc.lesson_level} expect a verb like ${LEVEL_VERBS[doc.lesson_level].slice(0, 5).join(", ")}`);
  if (/\band\b.*\band\b/i.test(doc.objective)) W("objective reads like more than one outcome; a mini-lesson carries one");

  /* --- structure + quiz quality --- */
  const { nQ, blocks } = checkEngineShape(lj, E, W);
  if (["apply", "practise", "mix", "ladder"].includes(doc.lesson_type) && nQ < 2) E("practise, mix and ladder lessons need at least 2 quiz questions");
  if (["apply", "practise", "mix"].includes(doc.lesson_type) && !blocks.some((b) => b.type === "widget")) E("practise and mix lessons need a judgement widget (caseCards or similar) before the quiz");
  if (doc.lesson_type !== "reinforce" && !doc.misconception) W("name the misconception this lesson corrects; distractors are built from it");

  /* --- length --- */
  const texts = collectText(lj);
  /* noFeedback is only seen on a miss, so it does not count towards reading time */
  const total = texts.filter((t) => !/noFeedback$/.test(t.where)).reduce((n, t) => n + words(t.text), 0), mins = total / 180;
  if (Math.abs(mins - doc.est_minutes) > 2) W(`est_minutes is ${doc.est_minutes} but ~${total} words reads in about ${mins.toFixed(1)} min`);
  if (total > 1300) W(`${total} words is long for a mini-lesson; cut what does not serve the objective`);

  /* --- sources + claim ledger --- */
  const sources = lj.sources || [];
  if (!sources.length) E("lesson_json.sources is empty; every lesson cites its sources");
  const ids = new Set();
  sources.forEach((s) => {
    if (ids.has(s.id)) E(`duplicate source id ${s.id}`); ids.add(s.id);
    if (!ISO_DATE.test(s.accessed)) E(`source ${s.id}: accessed must be YYYY-MM-DD`);
    if (/wikipedia\.org|medium\.com|linkedin\.com/.test(s.url)) E(`source ${s.id}: not an acceptable source on its own (${s.url})`);
    if (!s.pack) W(`source ${s.id} is outside the competency source pack; this lesson needs a second look`);
  });
  if (!doc.claims.length) E("claims is empty; list every factual statement with its source");
  const used = new Set();
  doc.claims.forEach((c, i) => c.source_ids.forEach((id) => { used.add(id); if (!ids.has(id)) E(`claim ${i + 1} cites unknown source "${id}"`); }));
  sources.forEach((s) => { if (!used.has(s.id)) W(`source ${s.id} is listed but no claim uses it`); });
  const claimText = doc.claims.map((c) => c.text).join(" ");
  texts.forEach((t) => {
    (t.text.match(/\d+(?:\.\d+)?\s?(?:%|per ?cent)/gi) || []).forEach((fig) => { if (!claimText.includes(fig.replace(/\s/g, "")) && !claimText.includes(fig)) E(`"${fig}" at ${t.where} has no matching claim; every statistic needs a sourced claim`); });
    if (/[$£€]\s?\d/.test(t.text)) W(`money figure at ${t.where}; house rule is percentages, not currency`);
    (t.text.match(/\bISO\s?\d{4,5}(?:-\d)?/g) || []).forEach((std) => { if (!claimText.includes(std) && !sources.some((s) => (s.title + (s.edition || "")).includes(std))) W(`${std} is mentioned at ${t.where} but no claim or source covers it`); });
  });

  /* --- publish gate --- */
  const r = doc.review;
  if (doc.status === "published") {
    if (r.fact_check_status !== "verified") E("published requires review.fact_check_status = verified");
    if (doc.claims.some((c) => c.verified !== true)) E("published requires every claim verified");
    if (!r.alignment || r.alignment.match !== true) E("published requires a passed blind alignment check");
    if (!r.approved_by || !ISO_DATE.test(r.approved_at || "")) E("published requires approved_by and approved_at");
    if (!ISO_DATE.test(r.review_due || "")) E("published requires review_due");
  }
  if (r.alignment && r.alignment.match === false) E(`blind alignment check picked ${r.alignment.blind_pick_skill_id}; the lesson is off-target or overlaps another skill`);
  if (r.fact_check_status === "failed") E("fact check failed");
  if (r.review_due && ISO_DATE.test(r.review_due) && r.review_due < new Date().toISOString().slice(0, 10)) W(`review was due ${r.review_due}`);
  return { errors, warns };
}

function main() {
  const args = process.argv.slice(2);
  if (args[0] === "--engine") {
    let bad = 0;
    args.slice(1).forEach((f) => {
      const lj = JSON.parse(fs.readFileSync(f, "utf8")), errors = [], warns = [];
      if (!validateEngine(lj)) validateEngine.errors.slice(0, 12).forEach((e) => errors.push(`schema ${e.instancePath || "/"} ${e.message}`));
      else checkEngineShape(lj, (m) => errors.push(m), (m) => warns.push(m));
      report(f, { errors, warns }); bad += errors.length;
    });
    process.exit(bad ? 1 : 0);
  }
  const dir = path.join(ROOT, "content", "lessons");
  const files = args.length ? args : fs.readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => path.join(dir, f));
  if (!files.length) { console.log("no lesson files in content/lessons"); return; }
  let bad = 0, slugs = new Map();
  files.forEach((f) => {
    const res = checkFile(f);
    try { const d = JSON.parse(fs.readFileSync(f, "utf8")); if (slugs.has(d.slug)) res.errors.push(`slug also used by ${slugs.get(d.slug)}`); slugs.set(d.slug, path.basename(f)); } catch (e) {}
    report(f, res); bad += res.errors.length;
  });
  console.log(`\n${files.length} file(s), ${bad} error(s)`);
  process.exit(bad ? 1 : 0);
}
function report(f, { errors, warns }) {
  console.log(`${errors.length ? "FAIL" : "ok  "}  ${path.relative(ROOT, f)}`);
  errors.forEach((m) => console.log("   ERROR  " + m));
  warns.forEach((m) => console.log("   warn   " + m));
}
main();
