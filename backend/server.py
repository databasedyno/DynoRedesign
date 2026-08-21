"""
DynoPay Node.js Backend Launcher with Lightweight Reverse Proxy

This script launches the Node.js/TypeScript backend and proxies requests to it.
Required because supervisor configuration expects Python/uvicorn on port 8001.

Architecture:
- Python/uvicorn: Lightweight proxy on port 8001 (supervisor requirement)
- Main Backend: Node.js on internal port 3300 (handles all business logic + merchant API)

The proxy adds minimal overhead (<5ms) and allows the project to remain pure Node.js.
Note: The api-service (port 3301) has been retired — all merchant API endpoints
are now served by the main backend's merchantApiRouter.
"""

import subprocess
import os
import sys
import signal
import atexit
import time
import httpx
import threading
from dotenv import load_dotenv

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

# Internal port for Node.js backend
NODE_PORT = 3300

# Process references
NODE_PROCESS = None
HTTP_CLIENT = None

print("""
+----------------------------------------------------------+
|  DynoPay - Node.js Backend with Python Launcher          |
|  Pure Node.js/TypeScript backend via lightweight proxy   |
+----------------------------------------------------------+
""", flush=True)

TS_NODE_BIN = '/app/backend/node_modules/.bin/ts-node'


def ensure_node_modules():
    """Fresh-pod self-heal: install backend deps instead of crash-looping.

    /app is restored from git on a new pod, so backend/node_modules is missing.
    flock serialises with the frontend installer (shared yarn cache).
    """
    if os.path.exists(TS_NODE_BIN):
        return

    print("⚙️  backend/node_modules missing -> yarn install (fresh-pod self-heal, ~1 min)...", flush=True)
    for extra in (['--network-concurrency', '16'], ['--check-files']):
        subprocess.run(
            ['flock', '/tmp/dynopay-yarn-install.lock', 'yarn', 'install', '--non-interactive'] + extra,
            cwd='/app/backend',
        )
        if os.path.exists(TS_NODE_BIN):
            print("✅ backend deps installed", flush=True)
            return

    print("❌ backend yarn install failed — backing off 20s before supervisor retries", flush=True)
    time.sleep(20)
    sys.exit(1)


def start_node_backend():
    """Start main Node.js backend on internal port."""
    global NODE_PROCESS
    
    env = os.environ.copy()
    env['PORT'] = str(NODE_PORT)
    
    ensure_node_modules()

    print(f"🚀 Starting Node.js Backend (internal port {NODE_PORT})...", flush=True)
    
    NODE_PROCESS = subprocess.Popen(
        ['/app/backend/node_modules/.bin/ts-node', '--transpile-only', 'server.ts'],
        cwd='/app/backend',
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        bufsize=1,
        universal_newlines=True
    )
    
    # Stream output
    def stream():
        for line in iter(NODE_PROCESS.stdout.readline, ''):
            if line:
                print(f"[Backend] {line.rstrip()}", flush=True)
    
    threading.Thread(target=stream, daemon=True).start()
    
    # Wait for startup
    time.sleep(5)
    
    if NODE_PROCESS.poll() is None:
        print(f"✅ Node.js Backend running (PID: {NODE_PROCESS.pid})", flush=True)
    else:
        print("❌ ERROR: Node.js Backend failed to start", flush=True)
        sys.exit(1)

def stop_all():
    """Stop all services gracefully."""
    global NODE_PROCESS
    
    if NODE_PROCESS and NODE_PROCESS.poll() is None:
        print("Stopping Backend...", flush=True)
        NODE_PROCESS.terminate()
        try:
            NODE_PROCESS.wait(timeout=10)
        except subprocess.TimeoutExpired:
            NODE_PROCESS.kill()
            NODE_PROCESS.wait()

atexit.register(stop_all)
signal.signal(signal.SIGTERM, lambda s, f: (stop_all(), sys.exit(0)))
signal.signal(signal.SIGINT, lambda s, f: (stop_all(), sys.exit(0)))

def monitor_services():
    """Monitor and restart crashed services."""
    global NODE_PROCESS
    
    while True:
        time.sleep(10)
        
        if NODE_PROCESS and NODE_PROCESS.poll() is not None:
            print("Warning: Backend crashed, restarting...", flush=True)
            time.sleep(2)
            start_node_backend()

# Lightweight reverse proxy
def _build_forward_path(scope):
    """Combine ASGI path + query string into a single URL suffix."""
    path = scope.get('path', '/')
    query = scope.get('query_string', b'')
    if query:
        path = f"{path}?{query.decode()}"
    return path


def _extract_forward_headers(scope):
    """Return a dict of headers to forward, dropping hop-by-hop ones."""
    headers = {}
    for name, value in scope.get('headers', []):
        name_str = name.decode().lower()
        if name_str not in ('host', 'content-length', 'transfer-encoding'):
            headers[name_str] = value.decode()
    return headers


async def _read_request_body(receive):
    """Accumulate the full ASGI request body."""
    body = b''
    while True:
        message = await receive()
        body += message.get('body', b'')
        if not message.get('more_body', False):
            break
    return body


async def proxy_request(scope, receive, send):
    """Lightweight HTTP proxy to Node.js backend."""
    global HTTP_CLIENT

    path = _build_forward_path(scope)
    headers = _extract_forward_headers(scope)
    body = await _read_request_body(receive)
    method = scope.get('method', 'GET')

    try:
        # Forward to Node.js
        response = await HTTP_CLIENT.request(
            method=method,
            url=path,
            headers=headers,
            content=body if body else None
        )
        
        # Send response
        response_headers = [
            (k.lower().encode(), v.encode())
            for k, v in response.headers.items()
            if k.lower() not in ('transfer-encoding', 'content-encoding')
        ]
        response_headers.append((b'content-length', str(len(response.content)).encode()))
        
        await send({
            'type': 'http.response.start',
            'status': response.status_code,
            'headers': response_headers,
        })
        await send({
            'type': 'http.response.body',
            'body': response.content,
        })
        
    except httpx.ConnectError:
        await send({
            'type': 'http.response.start',
            'status': 503,
            'headers': [(b'content-type', b'application/json')],
        })
        await send({
            'type': 'http.response.body',
            'body': b'{"error": "Backend starting, please retry"}',
        })
    except Exception as e:
        await send({
            'type': 'http.response.start',
            'status': 502,
            'headers': [(b'content-type', b'application/json')],
        })
        await send({
            'type': 'http.response.body',
            'body': f'{{"error": "Proxy error: {str(e)}"}}'.encode(),
        })

# Flag to track if services are started
SERVICES_STARTED = False

async def ensure_services_started():
    """Ensure Node.js services are started (lazy initialization)."""
    global HTTP_CLIENT, SERVICES_STARTED
    
    if not SERVICES_STARTED:
        # Start Node.js backend (merchant API is now part of main backend)
        start_node_backend()
        
        # Start monitoring thread
        threading.Thread(target=monitor_services, daemon=True).start()
        
        # Create HTTP client for proxying with optimized connection pooling
        HTTP_CLIENT = httpx.AsyncClient(
            base_url=f"http://127.0.0.1:{NODE_PORT}",
            timeout=httpx.Timeout(60.0, connect=10.0),
            limits=httpx.Limits(max_connections=100, max_keepalive_connections=20, keepalive_expiry=30),
        )
        
        print("Proxy ready on port 8001 -> Node.js on port 3300", flush=True)
        SERVICES_STARTED = True

# ASGI application
async def app(scope, receive, send):
    """Main ASGI app - handles lifespan and proxies HTTP requests."""
    global HTTP_CLIENT, SERVICES_STARTED
    
    if scope['type'] == 'lifespan':
        while True:
            message = await receive()
            if message['type'] == 'lifespan.startup':
                await ensure_services_started()
                await send({'type': 'lifespan.startup.complete'})
                
            elif message['type'] == 'lifespan.shutdown':
                if HTTP_CLIENT:
                    await HTTP_CLIENT.aclose()
                stop_all()
                await send({'type': 'lifespan.shutdown.complete'})
                break
            
    elif scope['type'] == 'http':
        # Lazy initialization if lifespan wasn't supported
        await ensure_services_started()
        
        # Intercept NextAuth routes — these should NOT reach the Node.js backend
        # K8s routes all /api/* to this proxy, but /api/auth/* is NextAuth (frontend)
        path = scope.get('path', '')
        if path.startswith('/api/auth/'):
            # Return a valid empty session JSON so NextAuth client doesn't error
            if path == '/api/auth/session':
                body = b'{"user":null}'
            elif path == '/api/auth/_log':
                body = b'{"ok":true}'
            else:
                body = b'{}'
            await send({
                'type': 'http.response.start',
                'status': 200,
                'headers': [
                    (b'content-type', b'application/json'),
                    (b'content-length', str(len(body)).encode()),
                ],
            })
            await send({ 'type': 'http.response.body', 'body': body })
            return
        
        await proxy_request(scope, receive, send)
