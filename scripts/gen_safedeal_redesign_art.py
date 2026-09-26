"""
One-off generator for SafeDeal landing-redesign 3D artwork.

Uses Nano Banana (Gemini 2.5 Flash Image -> model id gemini-3.1-flash-image-preview)
through the Emergent universal key + emergentintegrations. Run ONCE; the PNGs are
committed as static assets under /app/public/safedeal/redesign and referenced by the
three mockup directions. No runtime key is needed after this.

Usage:
    EMERGENT_LLM_KEY=sk-... /root/.venv/bin/python scripts/gen_safedeal_redesign_art.py
"""
import asyncio
import base64
import os
import sys

from emergentintegrations.llm.chat import LlmChat, UserMessage

MODEL = "gemini-3.1-flash-image-preview"  # Nano Banana (per verified playbook)
OUT_DIR = "/app/public/safedeal/redesign"

# SafeDeal brand: gold #FFC61A + near-black #0A0A0B. No text/logos in the art.
ASSETS = [
    (
        "vault",
        "A photorealistic 3D render of a futuristic circular bank vault door, floating and "
        "slightly angled, centered. Glossy black metal body with polished 24-karat gold "
        "accents, a gold spoke locking wheel, and thin glowing golden light seams around the "
        "sealed edge. Premium fintech product visualization, octane render quality, soft "
        "studio lighting with a warm golden rim light, crisp reflections, gentle depth of "
        "field. Background: solid deep near-black (#0A0A0B) with a soft warm golden radial "
        "glow directly behind the vault. Ultra detailed, clean, minimal, no text, no logos, "
        "no watermark.",
    ),
    (
        "handshake",
        "A soft friendly 3D illustration of two simplified hands meeting in a gentle "
        "handshake nested inside a rounded protective shield with a subtle checkmark, "
        "centered. Smooth matte-and-glossy clay style, polished 24-karat gold and warm cream "
        "white materials, soft global illumination, gentle contact shadows, rounded shapes. "
        "Background: a soft cream-to-white vertical gradient (from #FFF7E6 to #FFFFFF). Warm, "
        "approachable, trustworthy premium fintech look, centered composition, high detail, "
        "no text, no logos, no watermark.",
    ),
    (
        "flow-accent",
        "A photorealistic 3D render of a neat stack of glossy golden coins with a small "
        "polished padlock resting on top and a soft green rounded checkmark badge floating "
        "just above, centered and floating. Polished 24-karat gold with black glass accents, "
        "premium fintech, octane render quality, soft studio lighting, warm golden rim light, "
        "crisp reflections. Background: solid deep near-black (#0A0A0B) with a soft warm "
        "golden radial glow behind the objects. Ultra detailed, minimal, no text, no logos, "
        "no watermark.",
    ),
    (
        "shield",
        "A photorealistic 3D render of a single glossy golden security shield emblem with a "
        "subtle centered keyhole and a soft embossed checkmark, floating and centered. "
        "Polished 24-karat gold with dark black-glass beveled edges, premium fintech, octane "
        "render quality, soft studio lighting with warm golden rim light, subtle reflections. "
        "Background: solid deep near-black (#0A0A0B) with a soft warm golden radial glow "
        "behind the shield. Centered, ultra detailed, minimal, no text, no logos, no watermark.",
    ),
]


async def gen_one(api_key: str, name: str, prompt: str) -> bool:
    # New LlmChat per asset (playbook requirement).
    chat = LlmChat(
        api_key=api_key,
        session_id=f"safedeal-redesign-{name}",
        system_message="You are an expert 3D product illustrator for premium fintech brands.",
    ).with_model("gemini", MODEL).with_params(modalities=["image", "text"])

    msg = UserMessage(text=prompt)
    text, images = await chat.send_message_multimodal_response(msg)
    if not images:
        print(f"[{name}] NO IMAGE returned. text head: {str(text)[:80]}")
        return False
    img = images[0]
    image_bytes = base64.b64decode(img["data"])
    path = os.path.join(OUT_DIR, f"{name}.png")
    with open(path, "wb") as f:
        f.write(image_bytes)
    print(f"[{name}] saved {path} ({len(image_bytes)} bytes, mime={img.get('mime_type')})")
    return True


async def main() -> int:
    api_key = os.getenv("EMERGENT_LLM_KEY")
    if not api_key:
        print("ERROR: EMERGENT_LLM_KEY not set", file=sys.stderr)
        return 2
    os.makedirs(OUT_DIR, exist_ok=True)
    only = set(sys.argv[1:])  # optional: regenerate a subset by name
    ok = 0
    total = 0
    for name, prompt in ASSETS:
        if only and name not in only:
            continue
        total += 1
        for attempt in range(1, 4):
            try:
                if await gen_one(api_key, name, prompt):
                    ok += 1
                    break
                print(f"[{name}] retry {attempt} (empty result)")
            except Exception as e:  # noqa: BLE001
                print(f"[{name}] attempt {attempt} error: {str(e)[:200]}")
                await asyncio.sleep(3)
    print(f"DONE {ok}/{total} assets generated")
    return 0 if ok == total else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
