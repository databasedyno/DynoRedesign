import asyncio, json, os, sys, urllib.request, ssl, time
import websockets

DO_TOKEN = os.environ["DO_TOKEN"]
APP = "f86b27dc-feb0-4a44-a4e9-ebd2053e0468"
DEP = sys.argv[1] if len(sys.argv) > 1 else "64858fdd-32f8-4e9c-b8cf-34d8297eb55c"
COMP = "dynoredesign"
LOGTYPE = sys.argv[2] if len(sys.argv) > 2 else "RUN"
OUT = sys.argv[3] if len(sys.argv) > 3 else "/tmp/do_run_logs.txt"
DURATION = int(sys.argv[4]) if len(sys.argv) > 4 else 25

def get_ws_url():
    url = f"https://api.digitalocean.com/v2/apps/{APP}/deployments/{DEP}/components/{COMP}/logs?type={LOGTYPE}"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {DO_TOKEN}"})
    with urllib.request.urlopen(req) as r:
        d = json.loads(r.read())
    return d.get("url") or d.get("live_url")

async def main():
    ws_url = get_ws_url().replace("https://", "wss://", 1)
    count = 0
    with open(OUT, "w") as f:
        try:
            async with websockets.connect(ws_url, max_size=None, ping_interval=None) as ws:
                start = time.time()
                while time.time() - start < DURATION:
                    try:
                        msg = await asyncio.wait_for(ws.recv(), timeout=DURATION)
                    except asyncio.TimeoutError:
                        break
                    if isinstance(msg, bytes):
                        msg = msg.decode("utf-8", "replace")
                    # DO proxy sends JSON frames {"data": "...", "pod_name": "..."} or raw text
                    try:
                        obj = json.loads(msg)
                        line = obj.get("data", msg)
                    except Exception:
                        line = msg
                    f.write(line if line.endswith("\n") else line + "\n")
                    count += 1
        except Exception as e:
            f.write(f"\n[WS_ERROR] {e}\n")
    print(f"CAPTURED_MESSAGES={count} OUT={OUT}")

asyncio.run(main())
