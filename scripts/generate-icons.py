#!/usr/bin/env python3
"""One-shot icon generator for Hanssimiko Bunker.

Text has to be converted to outlines before it goes into an icon file: a favicon
is rendered by the browser at sizes where a webfont reference is unreliable,
and some platforms rasterise the SVG in a context that never fetches remote
fonts. So the glyph outlines are baked into path data here, once, and the result
is committed to public/.

This script is not part of `npm run build`. It only needs to run when the
monogram or the wordmark faces change.

    .venv-fonts/bin/python scripts/generate-icons.py

Requires: fonttools (+ brotli for woff2 input) and a local copy of the faces in
.font-cache/, both fetched from Google Fonts at build time rather than hotlinked
at runtime.
"""

from __future__ import annotations

import json
import pathlib
import subprocess
import sys

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
FONT_CACHE = ROOT / ".font-cache"
PUBLIC = ROOT / "public"

# Official 0G palette, mirrored from src/app/globals.css.
GRADIENT_TOP = "#E3C1FF"
GRADIENT_MID = "#CB8AFF"
GRADIENT_BOTTOM = "#9200E1"
PLATE_BG = "#0A0A0A"
PLATE_BORDER = "#9200E1"

# The icon is authored on this grid and exported at many sizes, so the outlines
# are resolution independent by construction.
VIEWBOX = 40.0

# H over B, stacked. Cap heights are set explicitly rather than by font size:
# at 16px a two-letter stack has to survive having its counters filled in, and
# the only reliable way to control that is to work in cap-height units.
H_CAP = 13.0
B_CAP = 12.0
H_TOP = 7.0
B_TOP = 23.0


def load(font_name: str) -> TTFont:
    path = FONT_CACHE / f"{font_name}.woff2"
    if not path.exists():
        sys.exit(
            f"missing {path}. Download the faces from Google Fonts first "
            f"(see scripts/generate-icons.py docstring)."
        )
    font = TTFont(str(path))
    font.flavor = None  # decompress woff2 so the glyph table is directly usable
    return font


def glyph_path(font: TTFont, char: str, cap_height: float, top: float) -> str:
    """Returns SVG path data for `char`, scaled to `cap_height` and sitting with
    its cap line at `top`.

    Horizontal placement uses the glyph's ink extents rather than its advance
    width. Advance width includes the side bearings, so centring on it pushes
    letters like H visibly off-centre at small sizes.
    """
    glyph_set = font.getGlyphSet()
    name = font.getBestCmap()[ord(char)]
    glyph = glyph_set[name]

    # Measure ink extents in font units.
    from fontTools.pens.boundsPen import BoundsPen

    bounds_pen = BoundsPen(glyph_set)
    glyph.draw(bounds_pen)
    x_min, y_min, x_max, y_max = bounds_pen.bounds
    if None in (y_min, y_max):
        sys.exit(f"glyph {char!r} has no outlines")

    scale = cap_height / (y_max - y_min)
    ink_width = (x_max - x_min) * scale

    # The SVG y axis points down, the font y axis points up, so y is flipped
    # about the cap line.
    baseline = top + cap_height
    offset_x = (VIEWBOX - ink_width) / 2 - x_min * scale
    transform = f"translate({offset_x:.3f},{baseline:.3f}) scale({scale:.4f},{-scale:.4f})"

    pen = SVGPathPen(glyph_set)
    glyph.draw(TransformPen(pen, (scale, 0, 0, -scale, offset_x, baseline)))
    return pen.getCommands()


def monogram_svg() -> str:
    grenze = load("grenze")
    cinzel = load("cinzel")

    h = glyph_path(grenze, "H", H_CAP, H_TOP)
    b = glyph_path(cinzel, "B", B_CAP, B_TOP)

    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {VIEWBOX:g} {VIEWBOX:g}" width="{VIEWBOX:g}" height="{VIEWBOX:g}" role="img" aria-label="Hanssimiko Bunker">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="{GRADIENT_TOP}"/>
      <stop offset="55%" stop-color="{GRADIENT_MID}"/>
      <stop offset="100%" stop-color="{GRADIENT_BOTTOM}"/>
    </linearGradient>
  </defs>
  <rect x="0.75" y="0.75" width="38.5" height="38.5" rx="9" fill="{PLATE_BG}" stroke="{PLATE_BORDER}" stroke-width="1.5"/>
  <path d="{h}" fill="url(#g)"/>
  <path d="{b}" fill="url(#g)"/>
</svg>
"""


def main() -> None:
    PUBLIC.mkdir(parents=True, exist_ok=True)
    svg = monogram_svg()

    (PUBLIC / "favicon.svg").write_text(svg, encoding="utf-8")

    # Rasterise the PNG variants and pack the .ico from the same source, so all
    # of them are guaranteed to be the same artwork.
    sizes = [16, 32, 48, 180, 192, 512]
    staging = ROOT / ".icon-staging"
    staging.mkdir(exist_ok=True)
    staged_svg = staging / "favicon.svg"
    staged_svg.write_text(svg, encoding="utf-8")

    subprocess.run(
        [
            "node",
            str(ROOT / "scripts" / "rasterize-icons.mjs"),
            str(staged_svg),
            str(PUBLIC),
            json.dumps(sizes),
        ],
        check=True,
    )
    print("icons written to public/")


if __name__ == "__main__":
    main()
