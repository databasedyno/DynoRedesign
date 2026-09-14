#!/usr/bin/env python3
"""Render branded 1200x630 OpenGraph images for the 14 SEO landing pages.

Reads data/seo-pages/{countries,verticals}/*.json and writes
public/og/{kind}-{slug}.png. Uses the repo's Urbanist/Outfit woff2 fonts
(converted to ttf on the fly). Re-run after adding new SEO pages:
    python3 scripts/generate-og-images.py
Deps: pillow, fonttools, brotli
"""
import glob
import io
import json
import math
import os
import re

from fontTools.ttLib import TTFont, woff2
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "public", "og")
W, H = 1200, 630

NAVY = (5, 7, 32)
BLUE = (0, 4, 255)
INDIGO = (108, 123, 255)
LAVENDER = (159, 177, 255)
PALE = (185, 196, 255)
GREEN = (18, 183, 106)
MINT = (124, 231, 174)
WHITE = (255, 255, 255)


def load_font(name: str, size: int) -> ImageFont.FreeTypeFont:
    ttf_path = f"/tmp/ogfonts/{name}.ttf"
    if not os.path.exists(ttf_path):
        os.makedirs("/tmp/ogfonts", exist_ok=True)
        with open(os.path.join(ROOT, "public", "fonts", f"{name}.woff2"), "rb") as f:
            buf = io.BytesIO()
            woff2.decompress(io.BytesIO(f.read()), buf)
            buf.seek(0)
            TTFont(buf).save(ttf_path)
    return ImageFont.truetype(ttf_path, size)


def background() -> Image.Image:
    im = Image.new("RGB", (W, H), NAVY)
    px = im.load()
    for y in range(H):
        for x in range(0, W, 4):
            t = (x / W * 0.55 + y / H * 0.45)
            r = int(NAVY[0] + (BLUE[0] * 0.22 - NAVY[0]) * t)
            g = int(NAVY[1] + (BLUE[1] * 0.22 - NAVY[1]) * t)
            b = int(NAVY[2] + (110 - NAVY[2]) * t)
            for dx in range(4):
                if x + dx < W:
                    px[x + dx, y] = (r, g, b)
    # radial indigo glow top-right
    glow = Image.new("L", (W, H), 0)
    gd = ImageDraw.Draw(glow)
    gd.ellipse([W - 480, -260, W + 260, 320], fill=110)
    glow = glow.filter(ImageFilter.GaussianBlur(120))
    im = Image.composite(Image.new("RGB", (W, H), INDIGO), im, glow.point(lambda v: v // 2))
    # subtle dot grid
    d = ImageDraw.Draw(im, "RGBA")
    for gy in range(60, H, 56):
        for gx in range(60, W, 56):
            d.ellipse([gx, gy, gx + 2, gy + 2], fill=(255, 255, 255, 14))
    return im


def tracked_text(d: ImageDraw.ImageDraw, pos, text, font, fill, tracking=0):
    x, y = pos
    for ch in text:
        d.text((x, y), ch, font=font, fill=fill)
        x += d.textlength(ch, font=font) + tracking
    return x


def wrap_title(d, text, font, max_w):
    words, lines, cur = text.split(), [], ""
    for w in words:
        trial = f"{cur} {w}".strip()
        if d.textlength(trial, font=font) <= max_w:
            cur = trial
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def fit_title(d, text, max_w, start_y, max_bottom, max_lines=2, start=92, floor=54):
    size = start
    while size > floor:
        font = load_font("Urbanist-ExtraBold", size)
        lines = wrap_title(d, text, font, max_w)
        if len(lines) <= max_lines and start_y + len(lines) * size * 1.12 <= max_bottom:
            return font, lines
        size -= 4
    font = load_font("Urbanist-ExtraBold", floor)
    return font, wrap_title(d, text, font, max_w)[:max_lines]


def paste_logo(im, left, top, height=58):
    """Composite the real Dynopay white logo lockup (icon + wordmark) with its alpha."""
    logo = Image.open(
        os.path.join(ROOT, "assets", "Images", "auth", "dynopay-white-logo.png")
    ).convert("RGBA")
    w = round(logo.width * height / logo.height)
    logo = logo.resize((w, height), Image.LANCZOS)
    im.paste(logo, (left, top), logo)


def render(kind: str, display_name: str, slug: str):
    im = background()
    d = ImageDraw.Draw(im, "RGBA")
    left = 84

    # real Dynopay white logo lockup (icon + wordmark)
    paste_logo(im, left, 66)

    # eyebrow
    eyebrow = "ACCEPT CRYPTO PAYMENTS IN" if kind == "country" else "CRYPTO PAYMENTS FOR"
    tracked_text(d, (left, 208), eyebrow, load_font("Outfit-SemiBold", 27), LAVENDER, tracking=5)

    # hero title (block must end by y=448 so the pill clears the footer row)
    title = display_name[0].upper() + display_name[1:]
    font, lines = fit_title(d, title, W - left - 90, 258, 448)
    y = 258
    for line in lines:
        d.text((left, y), line, font=font, fill=WHITE)
        y += int(font.size * 1.12)

    # green feature pill
    pill_y = y + 26
    pill_text = "Non-custodial  •  Instant settlement  •  12+ assets"
    pill_font = load_font("Outfit-SemiBold", 25)
    tw = d.textlength(pill_text, font=pill_font)
    pad_x, dot_r = 26, 6
    pill_w = pad_x * 2 + dot_r * 2 + 14 + tw
    d.rounded_rectangle(
        [left, pill_y, left + pill_w, pill_y + 56],
        radius=28,
        fill=(GREEN[0], GREEN[1], GREEN[2], 36),
        outline=(GREEN[0], GREEN[1], GREEN[2], 130),
        width=2,
    )
    cy = pill_y + 28
    d.ellipse([left + pad_x, cy - dot_r, left + pad_x + dot_r * 2, cy + dot_r], fill=GREEN)
    d.text((left + pad_x + dot_r * 2 + 14, pill_y + 12), pill_text, font=pill_font, fill=MINT)

    # footer
    d.text((left, H - 78), "dynopay.com", font=load_font("Outfit-SemiBold", 27), fill=PALE)
    coins = "BTC  •  ETH  •  SOL  •  USDT  •  XRP"
    coins_font = load_font("Outfit-SemiBold", 24)
    d.text((W - 84 - d.textlength(coins, font=coins_font), H - 76), coins, font=coins_font, fill=(255, 255, 255, 150))

    out = os.path.join(OUT_DIR, f"{kind}-{slug}.png")
    im.save(out, "PNG", optimize=True)
    print(f"wrote {out} ({os.path.getsize(out) // 1024} KB)")


def render_press():
    """Branded 1200x630 OpenGraph card for the /press media-kit page."""
    im = background()
    d = ImageDraw.Draw(im, "RGBA")
    left = 84

    # real Dynopay white logo lockup (icon + wordmark)
    paste_logo(im, left, 66)

    # eyebrow
    tracked_text(d, (left, 208), "PRESS & MEDIA KIT", load_font("Outfit-SemiBold", 27), LAVENDER, tracking=5)

    # hero title
    font, lines = fit_title(d, "Logos, brand assets & company facts", W - left - 90, 258, 448)
    y = 258
    for line in lines:
        d.text((left, y), line, font=font, fill=WHITE)
        y += int(font.size * 1.12)

    # green feature pill
    pill_y = y + 26
    pill_text = "Logos  •  Brand colours  •  Fast facts"
    pill_font = load_font("Outfit-SemiBold", 25)
    tw = d.textlength(pill_text, font=pill_font)
    pad_x, dot_r = 26, 6
    pill_w = pad_x * 2 + dot_r * 2 + 14 + tw
    d.rounded_rectangle(
        [left, pill_y, left + pill_w, pill_y + 56],
        radius=28,
        fill=(GREEN[0], GREEN[1], GREEN[2], 36),
        outline=(GREEN[0], GREEN[1], GREEN[2], 130),
        width=2,
    )
    cy = pill_y + 28
    d.ellipse([left + pad_x, cy - dot_r, left + pad_x + dot_r * 2, cy + dot_r], fill=GREEN)
    d.text((left + pad_x + dot_r * 2 + 14, pill_y + 12), pill_text, font=pill_font, fill=MINT)

    # footer
    d.text((left, H - 78), "dynopay.com/press", font=load_font("Outfit-SemiBold", 27), fill=PALE)

    out = os.path.join(OUT_DIR, "press.png")
    im.save(out, "PNG", optimize=True)
    print(f"wrote {out} ({os.path.getsize(out) // 1024} KB)")


def blog_posts():
    """Parse (slug, title) pairs from utils/blogData.ts (title is the field
    immediately after slug in each post object)."""
    src = open(os.path.join(ROOT, "utils", "blogData.ts"), encoding="utf-8").read()
    pairs = re.findall(r'slug:\s*"([^"]+)",\s*title:\s*"([^"]*)"', src)
    seen, out = set(), []
    for slug, title in pairs:
        if slug in seen:
            continue
        seen.add(slug)
        out.append((slug, title))
    return out


def render_blog(slug, title):
    """Branded 1200x630 OpenGraph card for a single blog post."""
    render_card(
        out_name=f"blog-{slug}.png",
        eyebrow="DYNOPAY BLOG",
        title=title,
        pill="Crypto commerce insights",
        footer="dynopay.com/blog",
        max_lines=3, start=74, floor=40, eyebrow_y=200, title_y=250, title_bottom=470,
    )


def render_card(out_name, eyebrow, title, pill, footer, coins=None,
                max_lines=2, start=92, floor=54, eyebrow_y=208, title_y=258, title_bottom=448):
    """Generic branded 1200x630 card: logo, tracked eyebrow, auto-fit title, green pill, footer."""
    im = background()
    d = ImageDraw.Draw(im, "RGBA")
    left = 84
    paste_logo(im, left, 66)
    tracked_text(d, (left, eyebrow_y), eyebrow, load_font("Outfit-SemiBold", 27), LAVENDER, tracking=5)

    font, lines = fit_title(d, title, W - left - 90, title_y, title_bottom, max_lines=max_lines, start=start, floor=floor)
    y = title_y
    for line in lines:
        d.text((left, y), line, font=font, fill=WHITE)
        y += int(font.size * 1.12)

    pill_y = y + 22
    pill_font = load_font("Outfit-SemiBold", 25)
    tw = d.textlength(pill, font=pill_font)
    pad_x, dot_r = 26, 6
    pill_w = pad_x * 2 + dot_r * 2 + 14 + tw
    d.rounded_rectangle(
        [left, pill_y, left + pill_w, pill_y + 56],
        radius=28,
        fill=(GREEN[0], GREEN[1], GREEN[2], 36),
        outline=(GREEN[0], GREEN[1], GREEN[2], 130),
        width=2,
    )
    cy = pill_y + 28
    d.ellipse([left + pad_x, cy - dot_r, left + pad_x + dot_r * 2, cy + dot_r], fill=GREEN)
    d.text((left + pad_x + dot_r * 2 + 14, pill_y + 12), pill, font=pill_font, fill=MINT)

    d.text((left, H - 78), footer, font=load_font("Outfit-SemiBold", 27), fill=PALE)
    if coins:
        coins_font = load_font("Outfit-SemiBold", 24)
        d.text((W - 84 - d.textlength(coins, font=coins_font), H - 76), coins, font=coins_font, fill=(255, 255, 255, 150))

    out = os.path.join(OUT_DIR, out_name)
    im.save(out, "PNG", optimize=True)
    print(f"wrote {out} ({os.path.getsize(out) // 1024} KB)")


# Per-page share cards for the main marketing pages (wired in pages/_app.tsx ROUTE_OG_IMAGE).
PAGE_CARDS = [
    dict(out_name="fees.png", eyebrow="PRICING & FEES", title="1.5% down to 0.5%. No monthly fee.",
         pill="No setup fee  •  No chargebacks  •  Pay only when paid", footer="dynopay.com/fees",
         coins="BTC  •  ETH  •  SOL  •  USDT  •  USDC"),
    dict(out_name="about.png", eyebrow="ABOUT DYNOPAY", title="Making crypto payments simple for every business",
         pill="Non-custodial  •  Since 2024  •  6 languages", footer="dynopay.com/about"),
    dict(out_name="how-to.png", eyebrow="HOW IT WORKS", title="Get paid in crypto in about 2 minutes",
         pill="Create a link  •  Share it  •  Settle to your wallet", footer="dynopay.com/how-to",
         coins="BTC  •  ETH  •  USDT  •  USDC"),
    dict(out_name="blog.png", eyebrow="DYNOPAY BLOG", title="Guides on fees, settlement & crypto integrations",
         pill="Crypto commerce insights", footer="dynopay.com/blog"),
]


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    render_press()
    for card in PAGE_CARDS:
        render_card(**card)
    for slug, title in blog_posts():
        render_blog(slug, title)
    for p in sorted(glob.glob(os.path.join(ROOT, "data", "seo-pages", "*", "*.json"))):
        c = json.load(open(p))
        render(c["_kind"], c["_display_name"], c["_slug"])


if __name__ == "__main__":
    main()
