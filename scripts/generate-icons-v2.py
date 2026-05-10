"""
Generate MkLume v1.0.0 release icons — sharp, high-quality Windows icons.

Strategy:
- Render master at 1024x1024 with clean geometry
- LANCZOS downscale for sizes >= 32
- Hand-tuned simplified design for 16x16 and 24x24
- Strong contrast, bold shapes, no soft/blurry details
- ICO contains 7 sizes: 16, 24, 32, 48, 64, 128, 256

Outputs:
  src-tauri/icons/32x32.png
  src-tauri/icons/128x128.png
  src-tauri/icons/128x128@2x.png (256x256)
  src-tauri/icons/icon.png (512x512)
  src-tauri/icons/icon.ico (multi-size)
  release/icon-preview-v1.0.0.png
"""

from PIL import Image, ImageDraw
import struct
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(SCRIPT_DIR)
ICONS_DIR = os.path.join(ROOT, "src-tauri", "icons")
RELEASE_DIR = os.path.join(ROOT, "release")


def draw_rrect(draw, xy, radius, fill):
    """Draw a rounded rectangle using Pillow's built-in if available."""
    x0, y0, x1, y1 = [int(v) for v in xy]
    r = int(min(radius, (x1 - x0) // 2, (y1 - y0) // 2))
    if r <= 0:
        draw.rectangle([x0, y0, x1, y1], fill=fill)
        return
    try:
        draw.rounded_rectangle([x0, y0, x1, y1], radius=r, fill=fill)
    except AttributeError:
        # Pillow < 8.2 fallback
        draw.rectangle([x0 + r, y0, x1 - r, y1], fill=fill)
        draw.rectangle([x0, y0 + r, x1, y1 - r], fill=fill)
        draw.pieslice([x0, y0, x0 + 2*r, y0 + 2*r], 180, 270, fill=fill)
        draw.pieslice([x1 - 2*r, y0, x1, y0 + 2*r], 270, 360, fill=fill)
        draw.pieslice([x0, y1 - 2*r, x0 + 2*r, y1], 90, 180, fill=fill)
        draw.pieslice([x1 - 2*r, y1 - 2*r, x1, y1], 0, 90, fill=fill)


def generate_master(size=1024):
    """Generate the master icon at high resolution."""
    s = size
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # ── Background: indigo gradient rounded square ──
    corner_r = int(s * 0.20)
    top_color = (99, 102, 241)    # Indigo-500
    bot_color = (67, 56, 202)     # Indigo-700

    bg = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    bg_draw = ImageDraw.Draw(bg)
    for y in range(s):
        t = y / max(s - 1, 1)
        r = int(top_color[0] + (bot_color[0] - top_color[0]) * t)
        g = int(top_color[1] + (bot_color[1] - top_color[1]) * t)
        b = int(top_color[2] + (bot_color[2] - top_color[2]) * t)
        bg_draw.line([(0, y), (s - 1, y)], fill=(r, g, b, 255))

    # Mask to rounded rect
    mask = Image.new("L", (s, s), 0)
    mask_draw = ImageDraw.Draw(mask)
    draw_rrect(mask_draw, (0, 0, s - 1, s - 1), corner_r, fill=255)
    bg.putalpha(mask)
    img = Image.alpha_composite(img, bg)
    draw = ImageDraw.Draw(img)

    # ── Document: bold white rectangle with fold ──
    doc_left = int(s * 0.25)
    doc_top = int(s * 0.17)
    doc_right = int(s * 0.75)
    doc_bottom = int(s * 0.83)
    doc_r = int(s * 0.025)
    fold_size = int(s * 0.12)

    # White document body
    draw_rrect(draw, (doc_left, doc_top, doc_right, doc_bottom),
               doc_r, fill=(255, 255, 255, 252))

    # Fold corner — cut and draw
    fold_x = doc_right - fold_size
    fold_y = doc_top + fold_size

    # Cut corner (draw background color over it)
    mid_bg = (83, 79, 221)  # mid-gradient color
    draw.polygon([(fold_x, doc_top), (doc_right, doc_top),
                  (doc_right, fold_y), (fold_x, doc_top)], fill=(*mid_bg, 255))

    # Fold flap
    draw.polygon([(fold_x, doc_top), (doc_right, fold_y),
                  (fold_x, fold_y)], fill=(225, 225, 235, 245))

    # ── Content lines — bold, high contrast ──
    line_left = doc_left + int(s * 0.07)
    line_right_full = doc_right - int(s * 0.07)
    line_right_heading = doc_left + int(s * 0.27)
    line_right_med = doc_left + int(s * 0.35)

    # Heading — thick, strong purple
    y_head = doc_top + int(s * 0.19)
    head_h = int(s * 0.038)
    draw_rrect(draw, (line_left, y_head, line_right_heading, y_head + head_h),
               head_h // 2, fill=(79, 70, 229, 230))

    # Line 1 — full width
    y1 = y_head + int(s * 0.09)
    line_h = int(s * 0.024)
    draw_rrect(draw, (line_left, y1, line_right_full, y1 + line_h),
               line_h // 2, fill=(120, 130, 245, 190))

    # Line 2 — full width
    y2 = y1 + int(s * 0.06)
    draw_rrect(draw, (line_left, y2, line_right_full, y2 + line_h),
               line_h // 2, fill=(120, 130, 245, 170))

    # Line 3 — medium width
    y3 = y2 + int(s * 0.06)
    draw_rrect(draw, (line_left, y3, line_right_med, y3 + line_h),
               line_h // 2, fill=(140, 150, 255, 150))

    return img


def generate_small(size):
    """Simplified icon for 16x16 and 24x24 — maximum clarity."""
    s = size
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Solid indigo background — rounded square
    corner_r = max(int(s * 0.18), 2)
    draw_rrect(draw, (0, 0, s - 1, s - 1), corner_r, fill=(89, 86, 233, 255))

    # Bold white document — no fold at these sizes
    m = max(int(s * 0.20), 2)
    doc_left = m
    doc_top = m
    doc_right = s - m - 1
    doc_bottom = s - m
    doc_r = max(int(s * 0.05), 1)
    draw_rrect(draw, (doc_left, doc_top, doc_right, doc_bottom),
               doc_r, fill=(255, 255, 255, 250))

    # Two bold lines only
    pad = max(int(s * 0.08), 1)
    line_left = doc_left + pad
    line_right = doc_right - pad
    line_h = max(int(s * 0.07), 1)

    doc_h = doc_bottom - doc_top
    y1 = doc_top + int(doc_h * 0.28)
    # Short heading line
    draw.rectangle([line_left, y1, line_left + int((line_right - line_left) * 0.55), y1 + line_h],
                   fill=(89, 86, 233, 210))

    y2 = doc_top + int(doc_h * 0.55)
    # Full content line
    draw.rectangle([line_left, y2, line_right, y2 + line_h],
                   fill=(120, 130, 245, 180))

    return img


if __name__ == "__main__":
    os.makedirs(ICONS_DIR, exist_ok=True)
    os.makedirs(RELEASE_DIR, exist_ok=True)

    # Generate master
    print("Generating master icon at 1024x1024...")
    master = generate_master(1024)

    # Generate all target sizes
    targets = [16, 24, 32, 48, 64, 128, 256]
    icons = {}

    for sz in targets:
        if sz <= 24:
            icons[sz] = generate_small(sz)
            print(f"  {sz}x{sz}: simplified design (hand-tuned)")
        else:
            icons[sz] = master.resize((sz, sz), Image.LANCZOS)
            print(f"  {sz}x{sz}: LANCZOS downscale from master")

    # Save PNGs
    icons[32].save(os.path.join(ICONS_DIR, "32x32.png"), "PNG")
    icons[128].save(os.path.join(ICONS_DIR, "128x128.png"), "PNG")
    icons[256].save(os.path.join(ICONS_DIR, "128x128@2x.png"), "PNG")
    master.resize((512, 512), Image.LANCZOS).save(
        os.path.join(ICONS_DIR, "icon.png"), "PNG")
    print("\nSaved PNGs: 32x32, 128x128, 128x128@2x (256), icon.png (512)")

    # Save ICO with all sizes
    ico_path = os.path.join(ICONS_DIR, "icon.ico")
    icons[256].save(
        ico_path,
        format="ICO",
        sizes=[(sz, sz) for sz in targets],
        append_images=[icons[sz] for sz in targets if sz != 256],
    )
    print(f"Saved icon.ico")

    # Verify ICO
    with open(ico_path, "rb") as f:
        data = f.read()
        _, _, count = struct.unpack_from("<HHH", data, 0)
        print(f"\nicon.ico verification: {len(data):,} bytes, {count} images:")
        offset = 6
        for i in range(count):
            w, h, colors, r2, planes, bpp, size, img_offset = struct.unpack_from(
                "<BBBBHHIH", data, offset)
            w = w if w != 0 else 256
            h = h if h != 0 else 256
            png_sig = data[img_offset:img_offset + 4]
            fmt = "PNG" if png_sig == b"\x89PNG" else "BMP"
            print(f"  {w}x{h} {bpp}bpp {size:,}B ({fmt})")
            offset += 16

    # Create preview sheet
    padding = 30
    label_h = 30
    row_h = 256 + label_h + padding
    total_w = sum(max(sz, 48) for sz in targets) + padding * (len(targets) + 1)
    total_h = row_h + padding * 2

    preview = Image.new("RGBA", (total_w, total_h), (250, 250, 255, 255))
    preview_draw = ImageDraw.Draw(preview)

    x = padding
    for sz in targets:
        icon = icons[sz]
        # Center each icon in its column, aligned to bottom
        col_w = max(sz, 48)
        y = padding + (256 - sz)  # align bottoms
        ix = x + (col_w - sz) // 2
        preview.paste(icon, (ix, y), icon)
        x += col_w + padding

    preview_path = os.path.join(RELEASE_DIR, "icon-preview-v1.0.0.png")
    preview.save(preview_path, "PNG")
    print(f"\nSaved preview: {preview_path}")

    # File sizes
    print("\nFinal file sizes:")
    for f in ["32x32.png", "128x128.png", "128x128@2x.png", "icon.png", "icon.ico"]:
        p = os.path.join(ICONS_DIR, f)
        print(f"  {f}: {os.path.getsize(p):,} bytes")
