import asyncio, json, sys, ssl
import websockets

async def main(ws_url, seconds, outfile):
    ws_url = ws_url.replace("https://", "wss://").replace("http://", "ws://")
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    lines = []
    try:
        async with websockets.connect(ws_url, ssl=ctx, max_size=None, open_timeout=30) as ws:
            try:
                while True:
                    msg = await asyncio.wait_for(ws.recv(), timeout=seconds)
                    if isinstance(msg, bytes):
                        try:
                            msg = msg.decode("utf-8", "replace")
                        except Exception:
                            msg = str(msg)
                    # DO wraps log lines in JSON sometimes
                    try:
                        j = json.loads(msg)
                        data = j.get("data") if isinstance(j, dict) else None
                        lines.append(data if data else msg)
                    except Exception:
                        lines.append(msg)
            except asyncio.TimeoutError:
                pass
    except Exception as e:
        lines.append(f"[WS ERROR] {type(e).__name__}: {e}")
    with open(outfile, "w") as f:
        f.write("\n".join(lines))
    print(f"captured {len(lines)} messages -> {outfile}")

if __name__ == "__main__":
    ws_url = sys.argv[1]
    seconds = float(sys.argv[2]) if len(sys.argv) > 2 else 20
    outfile = sys.argv[3] if len(sys.argv) > 3 else "/tmp/do_run_logs.txt"
    asyncio.run(main(ws_url, seconds, outfile))
