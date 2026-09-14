#!/usr/bin/env python3
"""Renders pixel-perfect OG share cards with the real Manrope brand fonts.

Outputs:
  /app/public/og/dynopay-og.png            (site-wide default, 1200x630)
  /app/public/og/vertical-{slug}.png       (new SEO verticals)
"""
import io
import sys
from pathlib import Path

from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageFilter

FONTS_DIR = Path("/app/public/fonts")
OUT_DIR = Path("/app/public/og")
TMP = Path("/tmp/ogfonts")
TMP.mkdir(exist_ok=True)

W, H = 1200, 630
BG = (247, 247, 251)
INK = (10, 10, 10)
INDIGO = (79, 70, 229)
GRAY = (82, 82, 91)


def woff_to_ttf(name: str) -> str:
    out = TMP / f"{name}.ttf"
    if not out.exists():
        f = TTFont(str(FONTS_DIR / f"{name}.woff2"))
        f.flavor = None
        f.save(str(out))
    return str(out)


from PIL import ImageFont  # noqa: E402

XB = woff_to_ttf("Manrope-ExtraBold")
MD = woff_to_ttf("Manrope-Medium")
BD = woff_to_ttf("Manrope-Bold")


def base_canvas() -> Image.Image:
    img = Image.new("RGB", (W, H), BG)
    glow = Image.new("RGB", (W, H), BG)
    gd = ImageDraw.Draw(glow)
    gd.ellipse([W - 420, -260, W + 260, 320], fill=(215, 214, 245))
    glow = glow.filter(ImageFilter.GaussianBlur(120))
    img = Image.blend(img, glow, 0.55)
    return img


def draw_wordmark(img: Image.Image, draw: ImageDraw.ImageDraw):
    mark = Image.open("/app/public/favicon-512.png").convert("RGBA").resize((46, 46), Image.LANCZOS)
    img.paste(mark, (72, H - 118), mark)
    f = ImageFont.truetype(BD, 34)
    draw.text((132, H - 114), "dynopay", font=f, fill=INK)


def card(lines, subline, out_name):
    img = base_canvas()
    d = ImageDraw.Draw(img)
    y = 118
    f_head = ImageFont.truetype(XB, 76)
    for parts in lines:  # each line: list of (text, color)
        x = 72
        for text, color in parts:
            d.text((x, y), text, font=f_head, fill=color)
            x += d.textlength(text, font=f_head)
        y += 92
    f_sub = ImageFont.truetype(MD, 29)
    d.text((72, y + 26), subline, font=f_sub, fill=GRAY)
    draw_wordmark(img, d)
    OUT_DIR.mkdir(exist_ok=True)
    img.save(OUT_DIR / out_name, "PNG", optimize=True)
    print("wrote", OUT_DIR / out_name)


# Site-wide default card
card(
    [
        [("Accept crypto payments.", INK)],
        [("Get paid ", INDIGO), ("your way.", INK)],
    ],
    "Bitcoin · Ethereum · USDT · USDC — settled to your own wallet",
    "dynopay-og.png",
)

# New vertical cards (match /og/vertical-{slug}.png convention)
VERTICALS = {
    "hosting": ("Crypto payments for", "web hosting.", "Domains, VPS & hosting plans — paid in crypto, settled to your wallet"),
    "vpn": ("Crypto payments for", "VPN & privacy tools.", "Private, borderless subscriptions — no chargebacks, no card data"),
    "marketplaces": ("Crypto payments for", "marketplaces.", "One API for checkout, payouts and settlement across 15+ cryptocurrencies"),
    "agencies": ("Crypto payments for", "agencies.", "Invoice global clients in crypto — fees from 1.5%, first payment free"),
    "nonprofits": ("Crypto donations for", "nonprofits.", "Borderless giving with funds settled straight to your own wallet"),
}
for slug, (l1, l2, sub) in VERTICALS.items():
    card([[(l1, INK)], [(l2, INDIGO)]], sub, f"vertical-{slug}.png")
