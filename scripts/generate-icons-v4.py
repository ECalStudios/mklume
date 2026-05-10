"""
Generate MkLume v1.0.0 release icons — v4.

Key fix: Windows shell uses BMP-format ICO entries for small sizes.
PNG-in-ICO can look bad in Windows Explorer/Start Menu/taskbar.
This version writes BMP entries for sizes <= 48, PNG for >= 64.

Also: 8x supersampling for all sizes, simplified design for small sizes.
"""

from PIL import Image, ImageDraw
import struct
import io
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

    # Background: solid indigo rounded square
    corner_r = int(s * 0.22)
    bg = (79, 70, 229, 255)
    draw_rrect(draw, (0, 0, s - 1, s - 1), corner_r, fill=bg)

    # White document
    doc_left = int(s * 0.22)
    doc_top = int(s * 0.15)
    doc_right = int(s * 0.78)
    doc_bottom = int(s * 0.85)
    doc_r = int(s * 0.03)
    draw_rrect(draw, (doc_left, doc_top, doc_right, doc_bottom),
               doc_r, fill=(255, 255, 255, 255))

    if not simplified:
        # Fold corner
        fold = int(s * 0.11)
        fx = doc_right - fold
        fy = doc_top + fold
        draw.polygon([(fx, doc_top - 1), (doc_right + 1, doc_top - 1),
                       (doc_right + 1, fy)], fill=bg)
        draw.polygon([(fx, doc_top), (doc_right, fy),
                       (fx, fy)], fill=(215, 215, 228, 255))

    # Content lines
    pad = int(s * 0.065)
    ll = doc_left + pad
    lr = doc_right - pad
    dh = doc_bottom - doc_top

    if simplified:
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

    return img.resize((size, size), Image.LANCZOS)


def image_to_bmp_data(img):
    """Convert RGBA image to ICO-compatible BMP data (no file header)."""
    w, h = img.size
    pixels = list(img.getdata())

    # ICO BMP is upside-down, BGRA order, with AND mask
    row_size = w * 4  # 32bpp BGRA
    # AND mask: 1 bit per pixel, rows padded to 4 bytes
    and_row = (w + 31) // 32 * 4

    # BMP info header (BITMAPINFOHEADER, 40 bytes)
    bmp_data = struct.pack("<IiiHHIIiiII",
        40,           # biSize
        w,            # biWidth
        h * 2,        # biHeight (doubled for ICO: includes AND mask)
        1,            # biPlanes
        32,           # biBitCount (BGRA)
        0,            # biCompression (BI_RGB)
        row_size * h + and_row * h,  # biSizeImage
        0, 0,         # biXPelsPerMeter, biYPelsPerMeter
        0, 0,         # biClrUsed, biClrImportant
    )

    # Pixel data: bottom-up, BGRA
    for y in range(h - 1, -1, -1):
        for x in range(w):
            r, g, b, a = pixels[y * w + x]
            bmp_data += struct.pack("BBBB", b, g, r, a)

    # AND mask: all zeros (fully opaque — alpha channel handles transparency)
    bmp_data += b"\x00" * (and_row * h)

    return bmp_data


def build_ico(images, sizes, ico_path):
    """
    Build ICO file manually with BMP format for sizes <= 48
    and PNG format for sizes >= 64.
    """
    count = len(images)

    # ICO header: reserved(2) + type(2) + count(2)
    header = struct.pack("<HHH", 0, 1, count)

    # Calculate offsets
    dir_size = 6 + count * 16  # header + directory entries
    entries = []
    data_blocks = []
    offset = dir_size

    for i, (img, sz) in enumerate(zip(images, sizes)):
        if sz <= 48:
            # BMP format for small sizes — Windows shell compatibility
            img_data = image_to_bmp_data(img)
            bpp = 32
        else:
            # PNG format for large sizes — space efficient
            buf = io.BytesIO()
            img.save(buf, format="PNG")
            img_data = buf.getvalue()
            bpp = 32

        w_byte = 0 if sz == 256 else sz
        h_byte = 0 if sz == 256 else sz

        entry = struct.pack("<BBBBHHII",
            w_byte,      # width (0 = 256)
            h_byte,      # height (0 = 256)
            0,           # color count
            0,           # reserved
            1,           # color planes
            bpp,         # bits per pixel
            len(img_data),  # data size
            offset,      # data offset
        )
        entries.append(entry)
        data_blocks.append(img_data)
        offset += len(img_data)

    # Write file
    with open(ico_path, "wb") as f:
        f.write(header)
        for e in entries:
            f.write(e)
        for d in data_blocks:
            f.write(d)


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

    # Build ICO with mixed BMP/PNG format
    ico_path = os.path.join(ICONS_DIR, "icon.ico")
    ico_images = [icons[sz] for sz in targets]
    build_ico(ico_images, targets, ico_path)
    print(f"Saved icon.ico (mixed BMP/PNG)")

    # Verify ICO
    with open(ico_path, "rb") as f:
        data = f.read()
        _, _, count = struct.unpack_from("<HHH", data, 0)
        print(f"\nicon.ico: {len(data):,} bytes, {count} images:")
        off = 6
        for i in range(count):
            w, h, _, _, _, bpp, sz, io_off = struct.unpack_from(
                "<BBBBHHIH", data, off)
            w = w or 256
            h = h or 256
            is_png = data[io_off:io_off + 4] == b"\x89PNG"
            fmt = "PNG" if is_png else "BMP"
            print(f"  {w}x{h} {bpp}bpp {sz:,}B ({fmt})")
            off += 16

    # Preview sheet
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
        y = margin + row1_h - sz
        preview.paste(icons[sz], (x, y), icons[sz])
        x += max(sz, 40) + gap

    x = margin
    for sz in [16, 24, 32, 48]:
        zoomed = icons[sz].resize((sz * zoom, sz * zoom), Image.NEAREST)
        y = margin + row1_h + gap * 2
        preview.paste(zoomed, (x, y), zoomed)
        x += sz * zoom + gap

    preview.save(os.path.join(RELEASE_DIR, "icon-preview-v1.0.0.png"), "PNG")
    print(f"\nSaved preview sheet")

    print("\nFile sizes:")
    for f in ["32x32.png", "128x128.png", "128x128@2x.png", "icon.png", "icon.ico"]:
        print(f"  {f}: {os.path.getsize(os.path.join(ICONS_DIR, f)):,}B")


if __name__ == "__main__":
    main()
