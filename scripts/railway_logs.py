import sys, json, urllib.request

RW = "8a6f6eb8-2ed6-4560-92c0-aab7947820ae"
DEP = "20f3db93-4fa2-45ce-ac7b-b6fb7398c52e"
ENDPOINT = "https://backboard.railway.app/graphql/v2"

def q(filter_str, limit=500):
    query = {
        "query": "query($d:String!,$f:String,$l:Int){deploymentLogs(deploymentId:$d,filter:$f,limit:$l){timestamp message severity}}",
        "variables": {"d": DEP, "f": filter_str, "l": limit},
    }
    data = json.dumps(query).encode()
    req = urllib.request.Request(ENDPOINT, data=data, headers={
        "Project-Access-Token": RW,
        "Content-Type": "application/json",
    })
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode())

if __name__ == "__main__":
    f = sys.argv[1] if len(sys.argv) > 1 else ""
    limit = int(sys.argv[2]) if len(sys.argv) > 2 else 500
    res = q(f, limit)
    if "errors" in res and res["errors"]:
        print("ERRORS:", json.dumps(res["errors"])[:800])
    logs = (res.get("data") or {}).get("deploymentLogs") or []
    print(f"# {len(logs)} log lines for filter='{f}'")
    for l in logs:
        print(f"{l.get('timestamp','')} [{l.get('severity','')}] {l.get('message','')}")
