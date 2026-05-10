"""
Generate MkLume v1.0.0 release icons — v3 with 8x supersampling.

Renders each target size at 8x resolution with clean geometry,
then LANCZOS-downscales for sharp anti-aliased edges.

Small sizes (<=48) use a simplified design for clarity.
"""

from PIL import Image, ImageDraw
import struct
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(SCRIPT_DIR)
ICONS_DIR = os.path.join(ROOT, "src-tauri", "icons")
RELEASE_DIR = os.path.join(ROOT, "release")

SS = 8  # Supersample factor


def draw_rrect(draw, bbox, radius, fill):
    x0, y0, x1, y1 = [int(v) for v in bbox]
    r = int(min(radius, (x1 - x0) // 2, (y1 - y0) // 2))
    if r < 1:
        draw.rectangle([x0, y0, x1, y1], fill=fill)
        return
    draw.rounded_rectangle([x0, y0, x1, y1], radius=r, fill=fill)


def render_icon(size, simplified=False):
    """Render icon at size*SS, then LANCZOS downscale to target."""
    ss = size * SS
    img = Image.new("RGBA", (ss, ss), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    s = ss

    # ── Background: solid indigo rounded square ──
    corner_r = int(s * 0.22)
    bg_color = (79, 70, 229, 255)  # Indigo-600
    draw_rrect(draw, (0, 0, s - 1, s - 1), corner_r, fill=bg_color)

    # ── White document ──
    doc_left = int(s * 0.22)
    doc_top = int(s * 0.15)
    doc_right = int(s * 0.78)
    doc_bottom = int(s * 0.85)
    doc_r = int(s * 0.03)

    # Full white, no transparency
    draw_rrect(draw, (doc_left, doc_top, doc_right, doc_bottom),
               doc_r, fill=(255, 255, 255, 255))

    if not simplified:
        # Fold corner
        fold = int(s * 0.11)
        fx = doc_right - fold
        fy = doc_top + fold
        # Cut corner
        draw.polygon([(fx, doc_top - 1), (doc_right + 1, doc_top - 1),
                       (doc_right + 1, fy)], fill=bg_color)
        # Fold flap
        draw.polygon([(fx, doc_top), (doc_right, fy),
                       (fx, fy)], fill=(215, 215, 228, 255))

    # ── Content lines ──
    pad = int(s * 0.065)
    ll = doc_left + pad  # line left
    lr = doc_right - pad  # line right
    dh = doc_bottom - doc_top  # doc height

    if simplified:
        # Bold heading + one body line
        hh = int(s * 0.05)
        hy = doc_top + int(dh * 0.30)
        hr = ll + int((lr - ll) * 0.50)
        draw_rrect(draw, (ll, hy, hr, hy + hh), hh // 2,
                   fill=(79, 70, 229, 240))

        bh = int(s * 0.035)
        by = doc_top + int(dh * 0.55)
        draw_rrect(draw, (ll, by, lr, by + bh), bh // 2,
                   fill=(120, 115, 235, 200))
    else:
        # Heading + 2 body lines
        hh = int(s * 0.04)
        hy = doc_top + int(dh * 0.22)
        hr = ll + int((lr - ll) * 0.48)
        draw_rrect(draw, (ll, hy, hr, hy + hh), hh // 2,
                   fill=(79, 70, 229, 235))

        bh = int(s * 0.026)
        b1y = hy + int(dh * 0.12)
        draw_rrect(draw, (ll, b1y, lr, b1y + bh), bh // 2,
                   fill=(120, 115, 235, 195))

        b2y = b1y + int(dh * 0.08)
        b2r = ll + int((lr - ll) * 0.68)
        draw_rrect(draw, (ll, b2y, b2r, b2y + bh), bh // 2,
                   fill=(140, 135, 245, 165))

    # LANCZOS downscale
    return img.resize((size, size), Image.LANCZOS)


def main():
    os.makedirs(ICONS_DIR, exist_ok=True)
    os.makedirs(RELEASE_DIR, exist_ok=True)

    targets = [16, 24, 32, 48, 64, 128, 256]
    icons = {}

    for sz in targets:
        simplified = sz <= 48
        icons[sz] = render_icon(sz, simplified=simplified)
        print(f"  {sz}x{sz}: {'simplified' if simplified else 'full'}, "
              f"{SS}x supersample ({sz*SS}px -> {sz}px)")

    # Save PNGs
    icons[32].save(os.path.join(ICONS_DIR, "32x32.png"), "PNG")
    icons[128].save(os.path.join(ICONS_DIR, "128x128.png"), "PNG")
    icons[256].save(os.path.join(ICONS_DIR, "128x128@2x.png"), "PNG")
    render_icon(512, simplified=False).save(
        os.path.join(ICONS_DIR, "icon.png"), "PNG")
    print("\nSaved PNGs")

    # Save ICO
    ico_path = os.path.join(ICONS_DIR, "icon.ico")
    icons[256].save(
        ico_path, format="ICO",
        sizes=[(sz, sz) for sz in targets],
        append_images=[icons[sz] for sz in targets if sz != 256],
    )

    # Verify ICO
    with open(ico_path, "rb") as f:
        data = f.read()
        _, _, count = struct.unpack_from("<HHH", data, 0)
        print(f"\nicon.ico: {len(data):,} bytes, {count} images:")
        off = 6
        for i in range(count):
            w, h, _, _, _, bpp, sz, io = struct.unpack_from("<BBBBHHIH", data, off)
            w = w or 256
            h = h or 256
            fmt = "PNG" if data[io:io+4] == b"\x89PNG" else "BMP"
            print(f"  {w}x{h} {bpp}bpp {sz:,}B ({fmt})")
            off += 16

    # Preview: actual sizes top row, 4x zoom bottom row
    gap = 25
    margin = 30
    total_w = margin * 2 + sum(max(sz, 40) + gap for sz in targets)
    row1_h = 256
    zoom = 4
    row2_h = 48 * zoom
    total_h = margin + row1_h + gap * 2 + row2_h + margin

    preview = Image.new("RGBA", (total_w, total_h), (240, 240, 248, 255))

    x = margin
    for sz in targets:
        y = margin + row1_h - sz  # bottom-align
        preview.paste(icons[sz], (x, y), icons[sz])
        x += max(sz, 40) + gap

    x = margin
    for sz in [16, 24, 32, 48]:
        zoomed = icons[sz].resize((sz * zoom, sz * zoom), Image.NEAREST)
        y = margin + row1_h + gap * 2
        preview.paste(zoomed, (x, y), zoomed)
        x += sz * zoom + gap

    preview.save(os.path.join(RELEASE_DIR, "icon-preview-v1.0.0.png"), "PNG")
    print(f"\nSaved preview")

    print("\nFile sizes:")
    for f in ["32x32.png", "128x128.png", "128x128@2x.png", "icon.png", "icon.ico"]:
        print(f"  {f}: {os.path.getsize(os.path.join(ICONS_DIR, f)):,}B")


if __name__ == "__main__":
    main()
