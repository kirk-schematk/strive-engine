#!/usr/bin/env python3
"""Smoke test for the STRIVE onboarding -> roadmap -> dashboard backend.

Stdlib only. Usage:

    python docs/xano/smoke_test.py                 # anonymous flow only
    XANO_AUTH_TOKEN=eyJ... python docs/xano/smoke_test.py   # + authenticated flow

Anonymous: onboarding_start -> onboarding_answer (until done) -> onboarding_teaser
           -> onboarding_lesson_pick -> onboarding_lesson_done.
           Asserts no question_id is served twice.
Authenticated (needs a user Bearer token, e.g. from POST /memberstack_auth):
           onboarding_claim -> GET /roadmap -> PATCH /roadmap {status:confirmed}
           -> POST /goals -> GET /dashboard. Prints the shape of each response.
Handles 429 with exponential backoff.
"""
import json
import os
import sys
import time
import urllib.error
import urllib.request

BASE = "https://x8ki-letl-twmt.n7.xano.io"
ONBOARDING = os.environ.get("XANO_ONBOARDING_BASE", BASE + "/api:m2bNDxnv")
PLATFORM = os.environ.get("XANO_PLATFORM_BASE", BASE + "/api:fykJB1SM")
TOKEN = os.environ.get("XANO_AUTH_TOKEN", "").strip()
DISCIPLINE = os.environ.get("SMOKE_DISCIPLINE", "Architecture")
GOAL = os.environ.get("SMOKE_GOAL", "Step up to the next role")


class ApiError(Exception):
    def __init__(self, status, body):
        super().__init__(f"HTTP {status}: {body[:300]}")
        self.status = status
        self.body = body


def call(method, url, body=None, auth=False, query=None):
    if query:
        from urllib.parse import urlencode
        url = url + "?" + urlencode(query)
    data = None
    headers = {"Accept": "application/json"}
    if body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    if auth:
        if not TOKEN:
            raise RuntimeError("XANO_AUTH_TOKEN not set")
        headers["Authorization"] = "Bearer " + TOKEN
    delay = 1.5
    for attempt in range(6):
        req = urllib.request.Request(url, data=data, method=method, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                raw = r.read().decode()
                return json.loads(raw) if raw else None
        except urllib.error.HTTPError as e:
            raw = e.read().decode(errors="replace")
            if e.code == 429 and attempt < 5:
                print(f"    429 rate limited, backing off {delay:.1f}s")
                time.sleep(delay)
                delay *= 2
                continue
            raise ApiError(e.code, raw)
    raise RuntimeError("unreachable")


def shape(v, depth=0, max_depth=3):
    """Compact type-shape of a JSON value, for eyeballing contracts."""
    if isinstance(v, dict):
        if depth >= max_depth:
            return "{...}"
        return "{" + ", ".join(f"{k}: {shape(x, depth + 1, max_depth)}" for k, x in v.items()) + "}"
    if isinstance(v, list):
        if not v:
            return "[]"
        return f"[{shape(v[0], depth + 1, max_depth)} x{len(v)}]"
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "bool"
    if isinstance(v, (int, float)):
        return "num"
    if isinstance(v, str):
        return "str"
    return type(v).__name__


def step(title):
    print("\n== " + title)


def expect(cond, msg):
    if not cond:
        print("  FAIL: " + msg)
        sys.exit(1)
    print("  ok: " + msg)


def anonymous_flow():
    step("onboarding_start")
    r = call("POST", ONBOARDING + "/onboarding_start", {"discipline": DISCIPLINE, "goal": GOAL})
    print("  shape:", shape(r))
    expect("session_token" in r and "question" in r, "start returns session_token + question")
    token = r["session_token"]
    q = r["question"]
    expect(all(isinstance(o, str) for o in q["options"]), "options are plain text (no correct flags)")

    served = [q["question_id"]]
    answers = 0
    while True:
        # alternate answer indexes so we exercise both ladder directions
        idx = answers % len(q["options"])
        step(f"onboarding_answer #{answers + 1} (question {q['question_id']}, answer {idx})")
        r = call("POST", ONBOARDING + "/onboarding_answer",
                 {"session_token": token, "question_id": q["question_id"], "answer_index": idx})
        answers += 1
        print("  shape:", shape(r))
        expect("correct" in r and "feedback" in r and "progress" in r, "answer has correct/feedback/progress")
        expect(r["progress"]["answered"] == answers, f"progress.answered == {answers}")
        if r.get("done"):
            expect(r.get("session_token") == token, "done payload carries session_token")
            break
        q = r["next_question"]
        expect(q["question_id"] not in served, f"question {q['question_id']} not served before")
        served.append(q["question_id"])
        expect(answers < 8, "no more than 8 questions")

    expect(len(served) == len(set(served)), f"no repeated question_id across {len(served)} served")

    # answering again must be rejected (session finished)
    try:
        call("POST", ONBOARDING + "/onboarding_answer",
             {"session_token": token, "question_id": served[-1], "answer_index": 0})
        print("  WARN: answer after done was accepted (expected 400)")
    except ApiError as e:
        expect(e.status in (400, 403), f"answer after done rejected with {e.status}")

    step("onboarding_teaser")
    r = call("GET", ONBOARDING + "/onboarding_teaser", query={"session_token": token})
    print("  shape:", shape(r))
    expect(r.get("locked") is True, "teaser is locked")
    for k in ("archetype", "placement_phase", "phase_label", "headline", "accuracy"):
        expect(k in r, f"teaser has {k}")
    expect("review" not in r and "domains" not in r, "teaser has no breakdown")

    step("onboarding_lesson_pick")
    r = call("POST", ONBOARDING + "/onboarding_lesson_pick", {"session_token": token})
    print("  shape:", shape(r))
    print("  pick:", r.get("reason"), r.get("slug"), "-", r.get("message"))
    for k in ("slug", "title", "est_minutes", "competency", "domain", "phase", "reason", "message"):
        expect(k in r, f"lesson_pick has {k}")
    expect(r["reason"] in ("remediation", "stretch"), "reason is remediation|stretch")
    slug = r["slug"]

    r2 = call("POST", ONBOARDING + "/onboarding_lesson_pick", {"session_token": token})
    expect(r2["slug"] == slug, "lesson_pick is idempotent")

    step("onboarding_lesson_done")
    r = call("POST", ONBOARDING + "/onboarding_lesson_done", {"session_token": token, "slug": slug})
    print("  shape:", shape(r))
    expect(r.get("ok") is True, "lesson_done ok")

    return token


def authenticated_flow(token):
    step("onboarding_claim (auth)")
    r = call("POST", ONBOARDING + "/onboarding_claim", {"session_token": token}, auth=True)
    print("  shape:", shape(r, max_depth=2))
    expect("results" in r and "roadmap" in r and "goals_suggested" in r, "claim returns results/roadmap/goals_suggested")
    res = r["results"]
    for k in ("archetype", "placement_phase", "phase_label", "accuracy", "domains", "review"):
        expect(k in res, f"results has {k}")
    rm = r["roadmap"]
    expect(isinstance(rm.get("milestones"), list) and rm["milestones"], "roadmap has milestones")
    m0 = rm["milestones"][0]
    print("  first milestone:", m0["id"], "-", m0["title"], f"({len(m0['items'])} items)")
    expect("done" in m0["items"][0], "items carry done flag")
    print("  goals_suggested:", [g["title"] for g in r["goals_suggested"]])

    r2 = call("POST", ONBOARDING + "/onboarding_claim", {"session_token": token}, auth=True)
    expect(r2["roadmap"]["version"] == rm["version"], "claim is idempotent (version unchanged)")

    step("GET /roadmap (auth)")
    r = call("GET", PLATFORM + "/roadmap", auth=True)
    print("  shape:", shape(r, max_depth=2))
    expect(r.get("roadmap") is not None, "roadmap present")
    expect("stats" in r and "next_item" in r and "goals" in r, "roadmap GET has stats/next_item/goals")
    milestones = r["roadmap"]["milestones"]

    step("PATCH /roadmap confirm (auth)")
    # drop the last item of the last milestone to exercise validation
    edited = json.loads(json.dumps(milestones))
    if len(edited[-1]["items"]) > 1:
        edited[-1]["items"].pop()
    r = call("PATCH", PLATFORM + "/roadmap", {"status": "confirmed", "milestones": edited}, auth=True)
    print("  shape:", shape(r, max_depth=2))
    expect(r.get("status") == "confirmed", "status confirmed")

    step("POST /goals (auth)")
    goals = [dict(title=g["title"], description=g.get("description", ""), metric=g["metric"],
                  target_count=g.get("target_count"), due_date=g.get("due_date"))
             for g in r2["goals_suggested"]]
    goals.append({"title": "Tell my manager about my plan", "metric": {"type": "manual"},
                  "due_date": time.strftime("%Y-%m-%d", time.gmtime(time.time() + 7 * 86400))})
    r = call("POST", PLATFORM + "/goals", {"goals": goals}, auth=True)
    print("  shape:", shape(r, max_depth=3))
    expect(len(r.get("goals", [])) == len(goals), f"{len(goals)} goals saved")
    g = r["goals"][0]
    expect("progress" in g and "overdue" in g, "goals carry progress + overdue")

    step("PATCH /goal (auth)")
    manual = [x for x in r["goals"] if x["metric"].get("type") == "manual"][0]
    r = call("PATCH", PLATFORM + "/goal", {"id": manual["id"], "status": "done"}, auth=True)
    print("  shape:", shape(r, max_depth=3))
    expect(r["goal"]["status"] == "done", "manual goal marked done")

    step("GET /dashboard (auth)")
    r = call("GET", PLATFORM + "/dashboard", auth=True)
    print("  shape:", shape(r, max_depth=2))
    for k in ("user", "roadmap_summary", "next_item", "goals", "recent_completions", "stats"):
        expect(k in r, f"dashboard has {k}")
    expect(r["user"].get("phase_label"), "dashboard user has phase_label")

    step("DELETE /goal (auth)")
    r = call("DELETE", PLATFORM + "/goal", {"id": manual["id"]}, auth=True)
    expect(r.get("ok") is True, "goal deleted")


def main():
    print("Onboarding base:", ONBOARDING)
    print("Platform base:  ", PLATFORM)
    token = anonymous_flow()
    if TOKEN:
        authenticated_flow(token)
    else:
        print("\n(XANO_AUTH_TOKEN not set — skipped claim/roadmap/goals/dashboard. Session token: %s)" % token)
    print("\nALL OK")


if __name__ == "__main__":
    try:
        main()
    except ApiError as e:
        print("\nAPI ERROR:", e)
        sys.exit(2)
