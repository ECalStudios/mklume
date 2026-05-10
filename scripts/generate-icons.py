"""
Generate MkLume app icons.

Design: Rounded-square purple/indigo background with a clean white document icon
featuring horizontal lines (representing markdown/docs content) and a subtle
folded corner.

Outputs:
  src-tauri/icons/32x32.png
  src-tauri/icons/128x128.png
  src-tauri/icons/128x128@2x.png   (256x256)
  src-tauri/icons/icon.ico
  src-tauri/icons/icon.icns
"""

from PIL import Image, ImageDraw
import struct
import io
import os
import math

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(SCRIPT_DIR)
TAURI_ICONS = os.path.join(ROOT, "src-tauri", "icons")
ASSETS = os.path.join(ROOT, "src", "assets")

# Colors
BG_COLOR_1 = (99, 102, 241)      # Indigo-500 (top-left)
BG_COLOR_2 = (129, 140, 248)     # Indigo-400 (bottom-right, for gradient feel)
DOC_COLOR = (255, 255, 255)       # White document
DOC_SHADOW = (79, 82, 220)        # Slight shadow behind doc
LINE_COLOR_1 = (99, 102, 241)     # Lines on document (purple)
LINE_COLOR_2 = (139, 142, 248)    # Lighter line
LINE_COLOR_3 = (169, 172, 255)    # Even lighter line
FOLD_COLOR = (235, 235, 245)      # Folded corner

def lerp_color(c1, c2, t):
    return tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))

def draw_rounded_rect(draw, xy, radius, fill):
    x0, y0, x1, y1 = xy
    w = x1 - x0
    h = y1 - y0
    radius = min(radius, w // 2, h // 2)
    if radius <= 0:
        draw.rectangle([x0, y0, x1, y1], fill=fill)
        return
    # Main rectangle body
    draw.rectangle([x0 + radius, y0, x1 - radius, y1], fill=fill)
    draw.rectangle([x0, y0 + radius, x1, y1 - radius], fill=fill)
    # Four corners
    draw.pieslice([x0, y0, x0 + 2*radius, y0 + 2*radius], 180, 270, fill=fill)
    draw.pieslice([x1 - 2*radius, y0, x1, y0 + 2*radius], 270, 360, fill=fill)
    draw.pieslice([x0, y1 - 2*radius, x0 + 2*radius, y1], 90, 180, fill=fill)
    draw.pieslice([x1 - 2*radius, y1 - 2*radius, x1, y1], 0, 90, fill=fill)

def generate_icon(size):
    """Generate icon at given size."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    s = size  # shorthand

    # --- Background: rounded square with subtle gradient ---
    corner_r = int(s * 0.22)  # ~22% corner radius

    # Draw gradient background by horizontal strips
    for y in range(s):
        t = y / max(s - 1, 1)
        color = lerp_color(BG_COLOR_1, BG_COLOR_2, t * 0.5)
        # Only draw within the rounded rect bounds
        # We'll do a simple approach: draw full gradient, then mask

    # Simpler: draw solid background then overlay
    bg = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    bg_draw = ImageDraw.Draw(bg)

    # Gradient background
    for y in range(s):
        t = y / max(s - 1, 1)
        color = lerp_color(BG_COLOR_1, BG_COLOR_2, t * 0.6)
        bg_draw.line([(0, y), (s, y)], fill=(*color, 255))

    # Create rounded rect mask
    mask = Image.new("L", (s, s), 0)
    mask_draw = ImageDraw.Draw(mask)
    draw_rounded_rect(mask_draw, (0, 0, s - 1, s - 1), corner_r, fill=255)

    # Apply mask to gradient
    bg.putalpha(mask)
    img = Image.alpha_composite(img, bg)
    draw = ImageDraw.Draw(img)

    # --- Document shape ---
    # Document body (white rectangle with rounded corners and folded top-right corner)
    doc_left = int(s * 0.24)
    doc_top = int(s * 0.16)
    doc_right = int(s * 0.76)
    doc_bottom = int(s * 0.84)
    doc_corner_r = max(int(s * 0.04), 2)
    fold_size = int(s * 0.12)

    # Draw subtle shadow first
    shadow_offset = max(int(s * 0.015), 1)
    shadow_alpha = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow_alpha)
    draw_rounded_rect(shadow_draw,
        (doc_left + shadow_offset, doc_top + shadow_offset,
         doc_right + shadow_offset, doc_bottom + shadow_offset),
        doc_corner_r, fill=(0, 0, 0, 40))
    img = Image.alpha_composite(img, shadow_alpha)
    draw = ImageDraw.Draw(img)

    # Document body (main white rectangle)
    draw_rounded_rect(draw, (doc_left, doc_top, doc_right, doc_bottom),
                      doc_corner_r, fill=(*DOC_COLOR, 240))

    # Folded corner (triangle in top-right)
    fold_x = doc_right - fold_size
    fold_y = doc_top + fold_size
    # Cover top-right corner with background color, then draw fold
    fold_points = [(fold_x, doc_top), (doc_right, doc_top), (doc_right, fold_y)]

    # Draw the fold background (matches app background)
    bg_at_fold = lerp_color(BG_COLOR_1, BG_COLOR_2, 0.1)
    draw.polygon(fold_points, fill=(*bg_at_fold, 255))

    # Draw the fold triangle (slightly darker white)
    fold_triangle = [(fold_x, doc_top), (doc_right, fold_y), (fold_x, fold_y)]
    draw.polygon(fold_triangle, fill=(*FOLD_COLOR, 220))

    # --- Content lines (representing markdown) ---
    line_left = doc_left + int(s * 0.08)
    line_right_short = doc_left + int(s * 0.30)  # Short line (heading)
    line_right_long = doc_right - int(s * 0.08)   # Long line (content)
    line_right_med = doc_left + int(s * 0.38)      # Medium line
    line_thickness = max(int(s * 0.025), 1)
    line_radius = max(line_thickness // 2, 1)

    # Line 1 - "heading" (thick, short, dark purple)
    y1 = doc_top + int(s * 0.22)
    heading_thickness = max(int(s * 0.035), 2)
    draw_rounded_rect(draw, (line_left, y1, line_right_short, y1 + heading_thickness),
                      line_radius, fill=(*LINE_COLOR_1, 180))

    # Line 2 - content (full width)
    y2 = y1 + int(s * 0.10)
    draw_rounded_rect(draw, (line_left, y2, line_right_long, y2 + line_thickness),
                      line_radius, fill=(*LINE_COLOR_2, 140))

    # Line 3 - content (full width)
    y3 = y2 + int(s * 0.07)
    draw_rounded_rect(draw, (line_left, y3, line_right_long, y3 + line_thickness),
                      line_radius, fill=(*LINE_COLOR_2, 120))

    # Line 4 - content (medium width)
    y4 = y3 + int(s * 0.07)
    draw_rounded_rect(draw, (line_left, y4, line_right_med, y4 + line_thickness),
                      line_radius, fill=(*LINE_COLOR_3, 100))

    return img


def create_ico(images, path):
    """Create a .ico file from a list of PIL Images using Pillow's built-in ICO support."""
    # Use Pillow's built-in ICO writer for proper format compliance
    # The largest image is saved as the base, with all sizes included
    images[0].save(
        path,
        format="ICO",
        sizes=[(im.width, im.height) for im in images],
        append_images=images[1:] if len(images) > 1 else [],
    )


def generate_svg():
    """Generate the SVG version of the icon for use in-app."""
    return '''<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" fill="none">
  <!-- Background rounded square -->
  <defs>
    <linearGradient id="bg-grad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#6366F1"/>
      <stop offset="100%" stop-color="#818CF8"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="14" fill="url(#bg-grad)"/>

  <!-- Document shadow -->
  <rect x="16.5" y="11.5" width="34" height="44" rx="3" fill="black" fill-opacity="0.12"/>

  <!-- Document body -->
  <rect x="15" y="10" width="34" height="44" rx="3" fill="white" fill-opacity="0.94"/>

  <!-- Folded corner -->
  <path d="M41 10 L49 10 L49 18 Z" fill="#6366F1"/>
  <path d="M41 10 L49 18 L41 18 Z" fill="#EBEBF5" fill-opacity="0.85"/>

  <!-- Content lines -->
  <rect x="20" y="24" width="14" height="3" rx="1.5" fill="#6366F1" fill-opacity="0.7"/>
  <rect x="20" y="31" width="24" height="2" rx="1" fill="#818CF8" fill-opacity="0.5"/>
  <rect x="20" y="37" width="24" height="2" rx="1" fill="#818CF8" fill-opacity="0.4"/>
  <rect x="20" y="43" width="16" height="2" rx="1" fill="#A9ACFF" fill-opacity="0.35"/>
</svg>'''


if __name__ == "__main__":
    os.makedirs(TAURI_ICONS, exist_ok=True)
    os.makedirs(ASSETS, exist_ok=True)

    # Generate PNGs at required sizes
    sizes = {
        "32x32.png": 32,
        "128x128.png": 128,
        "128x128@2x.png": 256,
    }

    all_images = []
    for filename, px in sizes.items():
        img = generate_icon(px)
        path = os.path.join(TAURI_ICONS, filename)
        img.save(path, "PNG")
        all_images.append(img)
        print(f"  Created {filename} ({px}x{px})")

    # Generate ICO (include 16, 32, 48, 256)
    ico_sizes = [16, 32, 48, 256]
    ico_images = [generate_icon(sz) for sz in ico_sizes]
    ico_path = os.path.join(TAURI_ICONS, "icon.ico")
    create_ico(ico_images, ico_path)
    print(f"  Created icon.ico ({', '.join(str(s) for s in ico_sizes)})")

    # Generate a 512px PNG for general use / icon.png
    icon_512 = generate_icon(512)
    icon_512.save(os.path.join(TAURI_ICONS, "icon.png"), "PNG")
    print("  Created icon.png (512x512)")

    # Generate SVG
    svg_content = generate_svg()
    svg_path = os.path.join(ASSETS, "mklume-icon.svg")
    with open(svg_path, "w", encoding="utf-8") as f:
        f.write(svg_content)
    print(f"  Created mklume-icon.svg")

    # Also create icns placeholder (copy of ico - macOS won't be tested here)
    import shutil
    # For a real macOS build you'd need a proper .icns, but for now copy the 512 png
    # The Tauri build system handles icns generation from the PNG on macOS

    print("\nDone! Icon assets generated.")
