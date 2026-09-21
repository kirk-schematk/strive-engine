"""Sync the lesson pipeline's content into Xano through the Metadata API.

    python docs/xano/sync_content.py schema            # add any missing tables / columns (additive only)
    python docs/xano/sync_content.py skills            # upsert content/skills.json into `skill` + `proficiency_levels`
    python docs/xano/sync_content.py lesson <slug>...  # upsert content/lessons/<slug>.json into mini_lessons
    python docs/xano/sync_content.py lesson --all

Token: XANO_META_TOKEN (env var or repo-root .env), same as push.py. Never printed.
Additive only: it never deletes a column, a table or a row.

A lesson is always pushed with the status in its file, and the validator's publish
gate has already run on that file, so "published" cannot reach Xano without a
verified fact check, an alignment match and an approver. `answer_key` (what the
completion endpoint re-grades against) is derived from lesson_json here, so the
two can never disagree.
"""
import sys, os, json, time, subprocess, urllib.request, urllib.error, urllib.parse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import push  # TOKEN + BASE

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
T_LESSONS, T_SKILL = 862745, 848606

def api(method, path, body=None):
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(push.BASE + path, data=data, method=method, headers={
        "Authorization": "Bearer " + push.TOKEN, "Content-Type": "application/json", "Accept": "application/json"})
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req) as r:
                return r.status, json.load(r)
        except urllib.error.HTTPError as e:
            txt = e.read().decode("utf-8", "replace")
            if e.code == 429 and attempt < 4:
                time.sleep(3 * (attempt + 1)); continue
            return e.code, {"error": txt[:600]}

def must(res, what):
    st, body = res
    if st >= 300:
        raise SystemExit(f"{what} failed: {st} {body}")
    return body

def table_id(name):
    items = must(api("GET", "/table?per_page=100"), "list tables")["items"]
    return next((t["id"] for t in items if t["name"] == name), None)

def ensure_columns(tid, cols):
    have = {c["name"] for c in must(api("GET", f"/table/{tid}/schema"), "read schema")}
    for name, typ, desc, *dflt in cols:
        if name in have:
            continue
        default = dflt[0] if dflt else {"text": "", "int": 0, "json": None, "date": None, "bool": False}[typ]
        must(api("POST", f"/table/{tid}/schema/type/{typ}", {
            "name": name, "description": desc, "nullable": typ in ("json", "date"), "default": default,
            "required": False, "access": "public", "style": "single"}), f"add {name}")
        print(f"  + {name} ({typ})")

SKILL_COLS = [
    ("skill_id", "text", "SKL-n, matches Notion Skills DB"),
    ("slug", "text", "Notion skill slug, d{domain}-{competency}-{topic}"),
    ("competency_id", "int", "competencies.id"),
    ("phase", "int", "Career phase 1-5"),
    ("target_level", "int", "proficiency_levels.level the skill is assessed at"),
    ("acceptance_criteria", "text", "What a learner can do when the skill is met. Lesson objectives are written from this."),
    ("core_lesson_slug", "text", "mini_lessons.slug of the skill's core lesson"),
]
LESSON_COLS = [
    ("lesson_type", "text", "core | apply | ladder | refresher", "core"),
    ("lesson_level", "int", "proficiency level this lesson teaches (<= skill target_level)"),
    ("objective", "text", "The single measurable objective"),
    ("prerequisite_slugs", "json", "mini_lessons slugs to take first"),
    ("sources", "json", "[{id,title,publisher,url,edition,accessed,pack}]"),
    ("claims", "json", "Claim ledger: [{text,source_ids,locator,verified}]"),
    ("fact_check_status", "text", "unchecked | verified | failed", "unchecked"),
    ("review", "json", "alignment result, pedagogy score, second_look"),
    ("approved_by", "text", "Approver who published this version"),
    ("approved_at", "date", ""),
    ("reviewed_at", "date", ""),
    ("review_due", "date", "Re-verify sources by this date"),
    ("version", "int", "Content version, bumps on each approved change", 1),
]

def do_schema():
    print("skill"); ensure_columns(T_SKILL, SKILL_COLS)
    print("mini_lessons"); ensure_columns(T_LESSONS, LESSON_COLS)
    tid = table_id("proficiency_levels")
    if not tid:
        tid = must(api("POST", "/table", {"name": "proficiency_levels", "description": "Skill proficiency scale. Master: Notion Skills DB 'Target Proficiency Level'."}), "create proficiency_levels")["id"]
        print(f"created proficiency_levels ({tid})")
    print("proficiency_levels"); ensure_columns(tid, [("level", "int", "1-4"), ("name", "text", ""), ("descriptor", "text", "What a learner at this level can do")])

def all_rows(tid):
    rows, page = [], 1
    while True:
        b = must(api("GET", f"/table/{tid}/content?per_page=100&page={page}"), "read rows")
        rows += b["items"]
        if not b.get("nextPage"): return rows
        page = b["nextPage"]

def upsert(tid, key, rows):
    existing = {r[key]: r for r in all_rows(tid)}
    made = changed = 0
    for row in rows:
        cur = existing.get(row[key])
        if cur is None:
            must(api("POST", f"/table/{tid}/content", row), f"insert {row[key]}"); made += 1
        elif any(cur.get(k) != v for k, v in row.items()):
            must(api("PUT", f"/table/{tid}/content/{cur['id']}", {**cur, **row}), f"update {row[key]}"); changed += 1
    print(f"  {made} inserted, {changed} updated, {len(rows) - made - changed} unchanged")

def do_skills():
    snap = json.load(open(os.path.join(ROOT, "content", "skills.json"), encoding="utf-8"))
    print("proficiency_levels"); upsert(table_id("proficiency_levels"), "level", [{"level": l["level"], "name": l["name"]} for l in snap["levels"]])
    keep = [c[0] for c in SKILL_COLS] + ["name"]
    print("skill"); upsert(T_SKILL, "skill_id", [{k: s[k] for k in keep} for s in snap["skills"]])

def do_lessons(slugs):
    ldir = os.path.join(ROOT, "content", "lessons")
    if slugs == ["--all"]:
        slugs = [f[:-5] for f in sorted(os.listdir(ldir)) if f.endswith(".json")]
    files = [os.path.join(ldir, s + ".json") for s in slugs]
    if subprocess.run(["node", os.path.join(ROOT, "tools", "validate-lesson.js"), *files]).returncode:
        raise SystemExit("validator errors: nothing pushed")
    rows = []
    for f in files:
        d = json.load(open(f, encoding="utf-8")); lj, r = d["lesson_json"], d["review"]
        key = [next(i for i, o in enumerate(q["options"]) if o["correct"])
               for s in lj["sections"] for b in s["blocks"] if b["type"] == "quiz" for q in b["config"]["questions"]]
        rows.append({
            "slug": d["slug"], "skill_id": d["skill_id"], "title": d["title"], "status": d["status"], "lesson_json": lj,
            "competency_id": d["competency_id"], "est_minutes": d["est_minutes"], "phase": d["phase"], "answer_key": json.dumps(key),
            "lesson_type": d["lesson_type"], "lesson_level": d["lesson_level"], "objective": d["objective"],
            "prerequisite_slugs": d.get("prerequisite_slugs", []), "sources": lj.get("sources", []), "claims": d["claims"],
            "fact_check_status": r["fact_check_status"],
            "review": {k: r[k] for k in ("alignment", "pedagogy_score", "second_look") if k in r},
            "approved_by": r.get("approved_by", ""), "approved_at": r.get("approved_at"), "reviewed_at": r.get("reviewed_at"),
            "review_due": r.get("review_due"), "version": r["version"]})
    # Approval happens in Xano (POST /lesson_approve). A file that still says "draft"
    # must never un-publish a lesson or wipe its approval record.
    live = {r["slug"]: r for r in all_rows(T_LESSONS)}
    for row in rows:
        cur = live.get(row["slug"])
        if cur and cur.get("status") == "published" and row["status"] == "draft":
            for k in ("status", "approved_by", "approved_at", "review_due"):
                row[k] = cur.get(k)
            print(f"  {row['slug']}: already published in Xano, keeping its approval")
    print("mini_lessons"); upsert(T_LESSONS, "slug", rows)

def main(argv):
    if not push.TOKEN:
        print("XANO_META_TOKEN is not set (env var, or .env at the repo root)"); return 2
    if argv[:1] == ["schema"]: do_schema()
    elif argv[:1] == ["skills"]: do_skills()
    elif argv[:1] == ["lesson"] and len(argv) > 1: do_lessons(argv[1:])
    else: print(__doc__); return 2
    return 0

if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
