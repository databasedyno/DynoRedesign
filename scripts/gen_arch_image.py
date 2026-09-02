"""One-off: generate a clean modern architecture diagram for DynoPay via
Google Gemini "Nano Banana" (gemini-3.1-flash-image-preview) using the
Emergent universal LLM key. Saves the PNG to /app/architecture/.

Run:  EMERGENT_LLM_KEY=... /root/.venv/bin/python /app/scripts/gen_arch_image.py
"""
import asyncio
import os
import base64
import sys

from dotenv import load_dotenv
from emergentintegrations.llm.chat import LlmChat, UserMessage

load_dotenv()

API_KEY = os.getenv("EMERGENT_LLM_KEY")
OUT_DIR = "/app/architecture"
MODEL = "gemini-3.1-flash-image-preview"

PROMPT = (
    "Create a clean, modern software system architecture diagram, 16:9 landscape, "
    "flat vector style, muted professional palette (slate grey, indigo, teal accents), "
    "plenty of white space, thin rounded rectangle boxes with clear readable sans-serif labels, "
    "labelled arrows showing top-to-bottom data flow. Title at top: 'DynoPay - System Architecture'. "
    "Organise into clearly separated horizontal layers, each with a small left-side layer label:\n"
    "1) CLIENTS layer: boxes for 'Merchant Dashboard (Next.js SPA)', 'Public Crypto Checkout', 'Storefront', 'Creator / Tip Pages'.\n"
    "2) EDGE layer: one wide box 'Kubernetes Ingress / Nginx - path routing: /api -> :8001, /* -> :3000, TLS'.\n"
    "3) FRONTEND layer (port 3000): box 'Next.js 14 + React' with small chips 'MUI', 'Redux + Saga', 'SWR', 'i18n', 'NextAuth'.\n"
    "4) API GATEWAY layer (port 8001): box 'Python ASGI Reverse Proxy (uvicorn)' that forwards to the Node backend.\n"
    "5) BACKEND layer (port 3300): a large container 'Express + TypeScript API' holding four inner boxes: 'Auth JWT + CSRF Middleware', 'Controllers: payments, wallets, KYC, invoices, notifications', 'Services: email, web-push, payout digest, activation drip', 'Cron / Background Jobs'.\n"
    "6) DATA layer: cylinder 'PostgreSQL (Sequelize ORM)' and cylinder 'Redis - cache, sessions, rate-limit'.\n"
    "7) EXTERNAL SERVICES layer: boxes 'Tatum (crypto wallets & tx)', 'TRON / EVM Nodes', 'Binance Price Feed', 'SMTP Email', 'DigitalOcean Spaces (CDN)', 'Web Push (VAPID)'.\n"
    "Connect the layers with vertical arrows. Keep it uncluttered, corporate, and easy to read. No photos, no 3D, no drop shadows - just a crisp flat diagram."
)


async def main() -> int:
    if not API_KEY:
        print("ERROR: EMERGENT_LLM_KEY not set")
        return 2
    os.makedirs(OUT_DIR, exist_ok=True)
    chat = LlmChat(
        api_key=API_KEY,
        session_id="dynopay-arch-diagram",
        system_message="You are an expert technical diagram generator.",
    )
    chat.with_model("gemini", MODEL).with_params(modalities=["image", "text"])
    msg = UserMessage(text=PROMPT)
    text, images = await chat.send_message_multimodal_response(msg)
    print("Text response (first 200 chars):", (text or "")[:200])
    if not images:
        print("ERROR: no images returned")
        return 1
    saved = []
    for i, img in enumerate(images):
        print(f"Image {i}: {img.get('mime_type')}")
        image_bytes = base64.b64decode(img["data"])
        out = os.path.join(OUT_DIR, f"dynopay-architecture-ai-{i}.png")
        with open(out, "wb") as f:
            f.write(image_bytes)
        saved.append(out)
        print("Saved", out, f"({len(image_bytes)} bytes)")
    print("DONE", saved)
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
