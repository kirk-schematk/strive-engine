"""Create the `waitlist` table (pre-launch mailing list) through the Metadata API.

    python docs/xano/create_waitlist_table.py           # create table + indexes, print the id
    python docs/xano/create_waitlist_table.py --check   # only print the table if it exists

Uses the same token lookup as push.py (XANO_META_TOKEN env var, or .env at the repo
root). Safe to re-run: if a table named `waitlist` already exists it is left alone.
Written 2026-09-22 for docs/xano/platform/waitlist_post.xs / waitlist_apply.xs.
"""
import sys, os, json, urllib.request, urllib.error
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import push  # noqa: E402  (TOKEN + BASE)

BASE = push.BASE
HDR = {"Authorization": "Bearer " + push.TOKEN, "Content-Type": "application/json", "Accept": "application/json"}

def call(method, path, body=None):
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method, headers=HDR)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, json.load(r)
    except urllib.error.HTTPError as e:
        txt = e.read().decode("utf-8", "replace")
        try:
            return e.code, json.loads(txt)
        except Exception:
            return e.code, {"raw": txt[:600]}

def col(name, type_, default="", nullable=False, description="", required=False):
    c = {"name": name, "type": type_, "description": description, "nullable": nullable,
         "default": default, "required": required, "access": "public", "style": "single"}
    if type_ == "text":
        c["format"] = ""
    return c

SCHEMA = [
    col("id", "int", required=True),
    col("created_at", "timestamp", default="now"),
    col("updated_at", "timestamp", default="now", description="Last submit from this email."),
    col("email", "email", description="Lower-cased. One row per email (unique index)."),
    col("discipline", "text", description="Engine value from the home hero: Architecture / Engineering / Other."),
    col("goal", "text", description="Engine value: Move into BIM/digital, Step up to the next role, Level up in my current role."),
    col("level", "int", default="0", description="Self-rated baseline 1..4 (Awareness, Working, Advanced, Expert)."),
    col("level_name", "text", description="Awareness / Working / Advanced / Expert."),
    col("discipline_label", "text", description="Sentence form shown in the hero, e.g. 'structures'."),
    col("goal_label", "text", description="Sentence form, e.g. 'land a digital role'."),
    col("baseline_label", "text", description="Sentence form, e.g. 'draw in 2D'."),
    col("warmup_correct", "bool", default="false", description="Did they get the Level of Information Need warm-up right."),
    col("source", "text", default="home", description="Where the signup came from (home)."),
    col("page", "text", description="Full URL of the page that posted."),
    col("submissions", "int", default="1", description="How many times this email submitted the card."),
    col("report_sent_at", "timestamp", nullable=True, description="When the starting-point email went out (null = not sent, e.g. no RESEND_API_KEY yet)."),
    col("applied_user_id", "int", default="0", description="user.id the picks were copied to at signup (0 = not yet)."),
    col("applied_at", "timestamp", nullable=True, description="When waitlist_apply ran for this row."),
]

def find_existing():
    s, res = call("GET", "/table?per_page=100")
    items = res.get("items", res) if isinstance(res, dict) else res
    for t in items or []:
        if t.get("name") == "waitlist":
            return t
    return None

def main(argv):
    if not push.TOKEN:
        print("XANO_META_TOKEN is not set (env var, or XANO_META_TOKEN=... in .env at the repo root)"); return 2
    ex = find_existing()
    if "--check" in argv:
        print("waitlist:", json.dumps({k: ex.get(k) for k in ("id", "name", "created_at")}) if ex else "not found"); return 0
    if ex:
        print(f"waitlist already exists: id={ex['id']}"); return 0
    s, res = call("POST", "/table", {
        "name": "waitlist",
        "description": "Pre-launch mailing list. Written by POST /waitlist (home hero in waitlist mode); read by POST /waitlist_apply at signup. One row per email.",
        "docs": "", "auth": False, "tag": [],
        "schema": SCHEMA,
    })
    if s != 200 or "id" not in res:
        print("FAIL create table", s, json.dumps(res)[:800]); return 1
    tid = res["id"]
    print(f"OK table waitlist -> id={tid}")
    # Indexes: unique on email, btree on created_at desc
    s, r2 = call("POST", f"/table/{tid}/index/unique", {"fields": [{"name": "email", "op": "asc"}]})
    print("unique(email):", s, json.dumps(r2)[:300])
    s, r3 = call("POST", f"/table/{tid}/index/btree", {"fields": [{"name": "created_at", "op": "desc"}]})
    print("btree(created_at):", s, json.dumps(r3)[:300])
    s, sch = call("GET", f"/table/{tid}/schema")
    print("columns:", [c["name"] for c in sch] if s == 200 else (s, sch))
    return 0

if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
