"""Generate a round Spanish flag PNG (64x64 RGBA) matching germany-flag.png style.

The previous assets/Images/Icons/flags/spain-flag.png was a broken all-white 64x64
image, so the Espanol row rendered as an empty circle in every language switcher.

Style match (germany-flag.png): a circle inscribed in the full 64x64 box, fully
transparent corners, anti-aliased edge. Spain = horizontal red/yellow/red at 1:2:1.
Rendered at 8x then downscaled with LANCZOS for a smooth edge.
"""
from PIL import Image, ImageDraw

SCALE = 8
SIZE = 64
S = SIZE * SCALE

RED = (198, 11, 30, 255)      # #C60B1E
YELLOW = (255, 196, 0, 255)   # #FFC400

# Stripe bands (fractions of height): red 1/4, yellow 1/2, red 1/4
img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)
top_red_end = S // 4
yellow_end = S - S // 4
draw.rectangle([0, 0, S, top_red_end], fill=RED)
draw.rectangle([0, top_red_end, S, yellow_end], fill=YELLOW)
draw.rectangle([0, yellow_end, S, S], fill=RED)

# Circular alpha mask (inscribed circle, like germany-flag.png)
mask = Image.new("L", (S, S), 0)
ImageDraw.Draw(mask).ellipse([0, 0, S - 1, S - 1], fill=255)
img.putalpha(mask)

out = img.resize((SIZE, SIZE), Image.LANCZOS)
path = "assets/Images/Icons/flags/spain-flag.png"
out.save(path)

# Verify
chk = Image.open(path).convert("RGBA")
w, h = chk.size
print("saved", path, "size", chk.size)
print("corner(0,0)", chk.getpixel((0, 0)))
print("top-stripe centre", chk.getpixel((w // 2, h // 8)))
print("centre (yellow)", chk.getpixel((w // 2, h // 2)))
print("bottom-stripe centre", chk.getpixel((w // 2, h * 7 // 8)))
