"""Scan every mini_lessons row and report where answer_key disagrees with lesson_json.

    python docs/xano/check_answer_keys.py

The lesson engine (strive-lesson.js) grades client-side from lesson_json options[].correct,
then the completion endpoint re-grades against answer_key. If the two disagree the lesson
can never be completed, so this should report "mismatches: 0" after any content change.

Token: XANO_META_TOKEN env var, or XANO_META_TOKEN=... in the gitignored .env at the repo root.
Note: this Xano instance returns 404 for PATCH on table content; to fix a row, PUT the full row.
"""
import sys, os, json, time, urllib.request, urllib.error

sys.stdout.reconfigure(encoding="utf-8", line_buffering=True)

def _tok():
    t = os.environ.get("XANO_META_TOKEN", "").strip()
    if t: return t
    # walk up from this file so a git worktree (no .env of its own) finds the main checkout's
    d = os.path.dirname(os.path.abspath(__file__))
    while True:
        try:
            with open(os.path.join(d, ".env"), encoding="utf-8-sig") as fh:
                for line in fh:
                    line = line.strip()
                    if line.startswith("XANO_META_TOKEN="):
                        return line.split("=", 1)[1].strip().strip('"').strip("'")
        except OSError:
            pass
        parent = os.path.dirname(d)
        if parent == d: return ""
        d = parent

TOKEN = _tok()
BASE = "https://x8ki-letl-twmt.n7.xano.io/api:meta/workspace/163196/table/862745/content"

def call(method, url, body=None):
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={
        "Authorization": "Bearer " + TOKEN, "Content-Type": "application/json", "Accept": "application/json"})
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.status, json.load(r)
        except urllib.error.HTTPError as e:
            txt = e.read().decode("utf-8", "replace")
            if e.code == 429 and attempt < 4:
                time.sleep(5 * (attempt + 1)); continue
            return e.code, {"raw": txt[:800]}
        except (TimeoutError, OSError) as e:
            return 0, {"raw": f"{method} timed out/failed: {e}"}

def questions(lj):
    """Every dict in lesson_json that has an options list carrying 'correct' flags, in document order."""
    out = []
    def walk(o):
        if isinstance(o, dict):
            opts = o.get("options")
            if isinstance(opts, list) and opts and all(isinstance(x, dict) for x in opts) and any("correct" in x for x in opts):
                out.append(o)
            for v in o.values(): walk(v)
        elif isinstance(o, list):
            for v in o: walk(v)
    walk(lj)
    return out

def as_json(v):
    return json.loads(v) if isinstance(v, str) else v

def main():
    if not TOKEN:
        print("XANO_META_TOKEN is not set"); return 2
    page, bad, total = 1, [], 0
    while True:
        s, res = call("GET", f"{BASE}?page={page}&per_page=100")
        if s != 200:
            print("GET failed:", s, res); return 2
        for row in res.get("items", []):
            total += 1
            try:
                lj = [[k for k, o in enumerate(q["options"]) if o.get("correct")] for q in questions(as_json(row.get("lesson_json")))]
                ak = as_json(row.get("answer_key"))
                ok = isinstance(ak, list) and len(ak) == len(lj) and all(len(c) == 1 and c[0] == a for c, a in zip(lj, ak))
            except Exception as e:
                ok, lj, ak = False, "ERR " + str(e), row.get("answer_key")
            if not ok: bad.append((row.get("id"), row.get("slug"), ak, lj))
        if not res.get("nextPage"): break
        page = res["nextPage"]
    print("rows scanned:", total, "mismatches:", len(bad))
    for b in bad: print("  id %s %s  answer_key=%s  lesson_json=%s" % b)
    return 1 if bad else 0

if __name__ == "__main__":
    sys.exit(main())
