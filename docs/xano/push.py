"""Push a XanoScript (.xs) file to Xano through the Metadata API.

    set XANO_META_TOKEN=<metadata api token>          (PowerShell: $env:XANO_META_TOKEN="…")
    python docs/xano/push.py <file.xs> function                    # create a custom function
    python docs/xano/push.py <file.xs> function <function_id>      # replace + publish a function
    python docs/xano/push.py <file.xs> api <group_id>              # create an endpoint
    python docs/xano/push.py <file.xs> api <group_id> <api_id>     # replace + publish an endpoint

Group ids: Onboarding 428916, Platform 417827. Current ids are listed in README.md.
On a syntax error Xano's reported line is unreliable; the real culprit is usually the
statement *before* the reported one (see README "XanoScript gotchas").
"""
import sys, os, json, time, urllib.request, urllib.error

TOKEN = os.environ.get("XANO_META_TOKEN", "").strip()
BASE = "https://x8ki-letl-twmt.n7.xano.io/api:meta/workspace/163196"

def call(method, url, body):
    req = urllib.request.Request(url, data=body.encode("utf-8"), method=method, headers={
        "Authorization": "Bearer " + TOKEN, "Content-Type": "text/x-xanoscript", "Accept": "application/json"})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req) as r:
                return r.status, json.load(r)
        except urllib.error.HTTPError as e:
            txt = e.read().decode("utf-8", "replace")
            if e.code == 429 and attempt < 3:
                time.sleep(2 * (attempt + 1)); continue
            try:
                return e.code, json.loads(txt)
            except Exception:
                return e.code, {"raw": txt[:800]}

def main(argv):
    if not TOKEN:
        print("XANO_META_TOKEN is not set"); return 2
    if len(argv) < 2:
        print(__doc__); return 2
    path, kind = argv[0], argv[1]
    if kind == "function":
        url, method = (f"{BASE}/function/{argv[2]}?publish=true", "PUT") if len(argv) > 2 else (f"{BASE}/function", "POST")
    elif kind == "api" and len(argv) == 3:
        url, method = f"{BASE}/apigroup/{argv[2]}/api", "POST"
    elif kind == "api" and len(argv) == 4:
        url, method = f"{BASE}/apigroup/{argv[2]}/api/{argv[3]}?publish=true", "PUT"
    else:
        print(__doc__); return 2
    src = open(path, encoding="utf-8").read()
    status, res = call(method, url, src)
    name = os.path.basename(path)
    if status == 200 and "id" in res:
        print(f"OK {name} -> id={res['id']} name={res.get('name')} auth={res.get('auth')} inputs={[i['name'] for i in res.get('input', [])]}")
        return 0
    print(f"FAIL {name} status={status} code={res.get('code')} message={res.get('message')}")
    p = res.get("payload") or {}
    if isinstance(p, dict) and p.get("line"):
        lines = src.splitlines(); ln = p["line"]
        for i in range(max(1, ln - 4), min(len(lines), ln + 2) + 1):
            print(f"{'>>' if i == ln else '  '} {i:4d}: {lines[i-1]}")
    if "raw" in res:
        print(res["raw"])
    return 1

if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
