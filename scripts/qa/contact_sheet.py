#!/usr/bin/env python3
"""Stitch sweep screenshots into a contact sheet. Usage: contact_sheet.py <glob> <out.png> [cols] [thumb_w] [max_h]"""
import glob, sys
from PIL import Image, ImageDraw

pattern, out = sys.argv[1], sys.argv[2]
cols = int(sys.argv[3]) if len(sys.argv) > 3 else 5
tw = int(sys.argv[4]) if len(sys.argv) > 4 else 260
max_h = int(sys.argv[5]) if len(sys.argv) > 5 else 900
files = sorted(glob.glob(pattern))
thumbs = []
for f in files:
    im = Image.open(f).convert("RGB")
    im = im.crop((0, 0, im.width, min(im.height, int(max_h * im.width / tw))))
    im = im.resize((tw, int(im.height * tw / im.width)))
    thumbs.append((f.split("/")[-1].replace(".png", ""), im))
th = max(t.height for _, t in thumbs) + 18
rows = (len(thumbs) + cols - 1) // cols
sheet = Image.new("RGB", (cols * (tw + 8), rows * (th + 8)), "#666")
d = ImageDraw.Draw(sheet)
for i, (name, t) in enumerate(thumbs):
    x, y = (i % cols) * (tw + 8), (i // cols) * (th + 8)
    d.text((x + 2, y + 2), name[:40], fill="white")
    sheet.paste(t, (x, y + 16))
sheet.save(out, quality=60)
print(out, sheet.size, len(thumbs))
