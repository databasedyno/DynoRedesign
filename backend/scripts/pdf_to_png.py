#!/usr/bin/env python3
"""Rasterize every PDF in a directory to PNG (page 1, 110 dpi) for visual review.
Usage: python3 scripts/pdf_to_png.py <dir>
"""
import sys, pathlib
import pymupdf  # pip install pymupdf

d = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "/app/memory/pdf_previews/current")
for pdf in sorted(d.glob("*.pdf")):
    doc = pymupdf.open(pdf)
    pages = len(doc)
    pix = doc[0].get_pixmap(dpi=110)
    out = pdf.with_suffix(".png")
    pix.save(out)
    print(f"{pdf.name}: {pages} page(s) -> {out.name} ({pix.width}x{pix.height})")
