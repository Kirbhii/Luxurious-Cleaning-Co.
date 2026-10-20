"""
make-logo-onlight.py — builds the light-background logo used by the WHITE PREVIEW.

The real logo is a raster (src/imports/image-3.png, 484x169, RGBA). Its wordmark
"LUXURIOUS" is WHITE and "CLEANING CO." is a pale tan, so on a white background
the first is invisible and the second is barely there. The live dark theme is
fine with both; only the light preview needs this file.

It works because the PNG has a real alpha channel — the white background is
transparency, not paint — so the RGB can be rewritten while the alpha, and
therefore the shape, is untouched.

Two region-limited recolours:
  * "LUXURIOUS"  neutral-light pixels (alpha > 10, min channel > 120, channel
                 spread < 45) -> near-black, alpha kept.
  * "CLEANING CO." warm saturated pixels (r > g > b, r - b > 30) -> darkened.

Both are limited to x >= 155. That matters: the gold ICON also matches the warm
test, and without the x limit it gets darkened too and the whole mark turns
brown. Colour alone is not a safe key here; colour AND region is.

Usage:  python make-logo-onlight.py
Writes: logo-onlight.png next to this file.
"""

import os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "..", "src", "imports", "image-3.png")
OUT = os.path.join(HERE, "logo-onlight.png")

WORDMARK_X = 155  # everything left of this is the icon and must not be touched
INK = (20, 18, 15)  # near-black, matches --color-cream-50 in the light palette


def is_neutral_light(r, g, b, a):
    return a > 10 and min(r, g, b) > 120 and (max(r, g, b) - min(r, g, b)) < 45


def is_warm_tan(r, g, b, a):
    return a > 10 and r > g > b and (r - b) > 30 and r > 120


def main():
    im = Image.open(SRC).convert("RGBA")
    w, h = im.size
    px = im.load()

    out = Image.new("RGBA", (w, h))
    op = out.load()
    ink_n = tan_n = 0

    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if x >= WORDMARK_X and is_neutral_light(r, g, b, a):
                op[x, y] = (*INK, a)
                ink_n += 1
            elif x >= WORDMARK_X and is_warm_tan(r, g, b, a):
                op[x, y] = (int(r * 0.42), int(g * 0.38), int(b * 0.30), a)
                tan_n += 1
            else:
                op[x, y] = (r, g, b, a)

    out.save(OUT)
    print(f"LUXURIOUS  : {ink_n} px -> {INK}")
    print(f"CLEANING CO: {tan_n} px -> darkened warm")
    print("wrote", OUT)


if __name__ == "__main__":
    main()
