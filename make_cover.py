#!/usr/bin/env python3
"""
Generate QoreSentinel cover / social-preview images.

Outputs:
  assets/cover.png        - 2400 x 1260 wide cover (GitHub social preview @2x)
  assets/cover-square.png - 1200 x 1200 square cover (project avatar / card)

Brand (from apps/web/src/styles.css and tailwind.config.js):
  bg        #070b14 / #080e1b  dark navy
  panel     #101a2b
  line      #202d42
  cyan      #65d8d0 / #00f0ff
  green     #5de0b2
  blue      #8eabff / #3b82f6
  amber     #e9bd76
  shield mark with "Q" monogram, DM Sans / Manrope typography
"""
from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
OUT_DIR = ROOT / "assets"
OUT_DIR.mkdir(parents=True, exist_ok=True)

BG_RGB = (7, 11, 20)
LINE_RGB = (32, 45, 66)
CYAN_RGB = (101, 216, 208)
CYAN_BRIGHT_RGB = (0, 240, 255)
CYAN_DARK_RGB = (59, 143, 156)
GREEN_RGB = (93, 224, 178)
BLUE_RGB = (142, 171, 255)
BLUE_BRIGHT_RGB = (59, 130, 246)
AMBER_RGB = (233, 189, 118)
WHITE_RGB = (233, 238, 248)
MUTED_RGB = (129, 144, 168)

FONT_BOLD = "C:/Windows/Fonts/segoeuib.ttf"
FONT_REG = "C:/Windows/Fonts/segoeui.ttf"


def load_font(size: int, bold: bool = True) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(FONT_BOLD if bold else FONT_REG, size)


def gradient_circle(draw, xy, radius, colors, alpha=255):
    cx, cy = xy
    steps = int(radius * 2)
    for i in range(steps, 0, -3):
        t = i / (radius * 2)
        c_outer = colors[0]
        c_inner = colors[-1] if len(colors) > 1 else colors[0]
        r = int(c_outer[0] + (c_inner[0] - c_outer[0]) * t)
        g = int(c_outer[1] + (c_inner[1] - c_outer[1]) * t)
        b = int(c_outer[2] + (c_inner[2] - c_outer[2]) * t)
        a = int(alpha * (1 - t) * 0.5)
        draw.ellipse([cx - i, cy - i, cx + i, cy + i], fill=(r, g, b, a))


def draw_shield_mark(draw, cx, cy, size, fill=(0, 240, 255)):
    s = size
    top = cy - s * 0.42
    bottom = cy + s * 0.42
    left = cx - s * 0.42
    right = cx + s * 0.42
    body_h = s * 0.72
    body_top = cy - body_h / 2
    body_bottom = cy + body_h * 0.30
    draw.rounded_rectangle([left, body_top, right, body_bottom],
                           radius=s * 0.22, fill=fill)
    draw.polygon([(left, body_bottom), (cx, bottom), (right, body_bottom)],
                 fill=fill)
    inner_top = body_top + s * 0.08
    inner_bottom = body_bottom - s * 0.06
    inner_left = left + s * 0.12
    inner_right = right - s * 0.12
    draw.rounded_rectangle([inner_left, inner_top, inner_right, inner_bottom],
                           radius=s * 0.12,
                           fill=(max(0, fill[0] - 60), max(0, fill[1] - 60),
                                 max(0, fill[2] - 60)))
    q_font = load_font(int(s * 0.52), bold=True)
    bbox = draw.textbbox((0, 0), "Q", font=q_font)
    q_w = bbox[2] - bbox[0]
    q_h = bbox[3] - bbox[1]
    qx = cx - q_w / 2 - bbox[0]
    qy = cy - q_h / 2 - bbox[1] - s * 0.02
    draw.text((qx, qy), "Q", font=q_font, fill=(7, 11, 20))


def draw_grid_lines(draw, w, h, color, spacing=64, alpha=28):
    overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    for x in range(0, w, spacing):
        od.line([(x, 0), (x, h)], fill=(*color, alpha), width=1)
    for y in range(0, h, spacing):
        od.line([(0, y), (w, y)], fill=(*color, alpha), width=1)
    return overlay


def draw_hex_network(draw, cx, cy, radius, color, count=7):
    for i in range(count):
        angle = -math.pi / 2 + (2 * math.pi * i / count)
        nx = cx + radius * math.cos(angle)
        ny = cy + radius * math.sin(angle)
        draw.ellipse([nx - 5, ny - 5, nx + 5, ny + 5], fill=color)
        draw.line([(cx, cy), (nx, ny)], fill=(*color, 60), width=1)



def build_cover(width: int, height: int, square: bool = False) -> Image.Image:
    img = Image.new("RGBA", (width, height), BG_RGB + (255,))
    draw = ImageDraw.Draw(img)

    glow = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(glow)
    gradient_circle(gdraw, (width * 0.78, height * -0.10), width * 0.55,
                    [CYAN_BRIGHT_RGB, CYAN_DARK_RGB], alpha=40)
    gradient_circle(gdraw, (width * -0.10, height * 1.10), width * 0.50,
                    [GREEN_RGB, (30, 120, 90)], alpha=30)
    img = Image.alpha_composite(img, glow)
    draw = ImageDraw.Draw(img)

    grid = draw_grid_lines(draw, width, height, CYAN_RGB, spacing=80, alpha=16)
    img = Image.alpha_composite(img, grid)
    draw = ImageDraw.Draw(img)


    mark_size = min(width, height) * 0.30
    cx = width / 2
    cy = height / 2 - (height * 0.04 if not square else 0)

    gradient_circle(draw, (cx, cy), mark_size * 1.55,
                    [CYAN_BRIGHT_RGB, CYAN_DARK_RGB], alpha=60)
    draw_shield_mark(draw, cx, cy, mark_size, fill=CYAN_BRIGHT_RGB)
    draw_hex_network(draw, cx, cy, mark_size * 1.18, CYAN_RGB, count=7)

    rail_y = cy + mark_size * 0.78
    rail_w = mark_size * 2.6
    draw.rounded_rectangle([cx - rail_w / 2, rail_y - 3,
                            cx + rail_w / 2, rail_y + 3],
                           radius=2, fill=CYAN_RGB)
    for offset in (-rail_w * 0.45, 0, rail_w * 0.45):
        draw.rectangle([cx + offset - 7, rail_y - 11,
                        cx + offset + 7, rail_y + 11], fill=CYAN_RGB)

    if square:
        title_size = int(min(width, height) * 0.10)
        title_font = load_font(title_size, bold=True)
        bbox = draw.textbbox((0, 0), "QoreSentinel", font=title_font)
        tw = bbox[2] - bbox[0]
        draw.text(((width - tw) / 2, cy + mark_size * 1.05),
                  "QoreSentinel", font=title_font, fill=WHITE_RGB)

        sub = load_font(int(min(width, height) * 0.042), bold=True)
        sub_text = "Autonomous Post-Quantum Microgrant Platform"
        bbox = draw.textbbox((0, 0), sub_text, font=sub)
        sw = bbox[2] - bbox[0]
        sy = cy + mark_size * 1.05 + title_size * 1.25
        draw.text(((width - sw) / 2, sy), sub_text, font=sub, fill=CYAN_RGB)

        meta = load_font(int(min(width, height) * 0.032), bold=False)
        meta_text = ("QoreChain Developer Fest 2026  ·  ML-DSA-87  ·  "
                     "Diana Testnet 9800")
        bbox = draw.textbbox((0, 0), meta_text, font=meta)
        mw = bbox[2] - bbox[0]
        my = sy + int(min(width, height) * 0.055)
        draw.text(((width - mw) / 2, my), meta_text, font=meta, fill=MUTED_RGB)
    else:
        copy_x = width * 0.09
        max_copy_w = width * 0.52

        kicker_font = load_font(int(height * 0.030), bold=True)
        kicker = ("QORE CHAIN DEVELOPER FEST 2026 · BUILD BEFORE Q-DAY")
        draw.text((copy_x, height * 0.20), kicker, font=kicker_font,
                  fill=CYAN_RGB)

        title_font = load_font(int(height * 0.135), bold=True)
        title = "QoreSentinel"
        bbox = draw.textbbox((0, 0), title, font=title_font)
        tw = bbox[2] - bbox[0]
        ty = height * 0.27
        draw.text((copy_x, ty), title, font=title_font, fill=WHITE_RGB)

        t2_font = load_font(int(height * 0.135), bold=True)
        t2 = "Sentinel"
        bbox2 = draw.textbbox((0, 0), t2, font=t2_font)
        t2_w = bbox2[2] - bbox2[0]
        t2_x = copy_x + int(tw * (4 / len(title)))
        t2_h = int(bbox2[3] - bbox2[1])
        gradient = Image.new("RGBA", (t2_h, t2_w), (0, 0, 0, 0))
        g2 = ImageDraw.Draw(gradient)
        for i in range(t2_w):
            tt = i / max(1, t2_w - 1)
            r = int(CYAN_BRIGHT_RGB[0] + (BLUE_BRIGHT_RGB[0] - CYAN_BRIGHT_RGB[0]) * tt)
            g = int(CYAN_BRIGHT_RGB[1] + (BLUE_BRIGHT_RGB[1] - CYAN_BRIGHT_RGB[1]) * tt)
            b = int(CYAN_BRIGHT_RGB[2] + (BLUE_BRIGHT_RGB[2] - CYAN_BRIGHT_RGB[2]) * tt)
            g2.line([(i, 0), (i, t2_h)], fill=(r, g, b, 255), width=1)
        img.paste(gradient, (int(t2_x), int(ty) + int(bbox2[1])), gradient)

        sub_font = load_font(int(height * 0.034), bold=True)
        sub = ("Autonomous Post-Quantum Microgrant Allocation Platform")
        words = sub.split()
        lines = []
        cur = ""
        for w_ in words:
            test = (cur + " " + w_).strip()
            if draw.textlength(test, font=sub_font) <= max_copy_w:
                cur = test
            else:
                if cur:
                    lines.append(cur)
                cur = w_
        if cur:
            lines.append(cur)
        sy = ty + int(height * 0.165)
        for ln in lines:
            draw.text((copy_x, sy), ln, font=sub_font, fill=CYAN_RGB)
            sy += int(height * 0.042)

        meta_font = load_font(int(height * 0.026), bold=False)
        meta = ("ML-DSA-87 signatures  ·  7 autonomous review agents  ·  "
                "Diana Testnet chain 9800  ·  Receipt-verified payouts")
        my = sy + int(height * 0.025)
        draw.text((copy_x, my), meta, font=meta_font, fill=MUTED_RGB)

        stages = [
            ("01 APPLY", CYAN_RGB),
            ("02 REVIEW", BLUE_RGB),
            ("03 SIGN", (159, 121, 255)),
            ("04 SETTLE", GREEN_RGB),
        ]
        pill_h = int(height * 0.055)
        pfont = load_font(int(height * 0.024), bold=True)
        px = copy_x
        py = my + int(height * 0.075)
        for text, color in stages:
            tw_ = draw.textlength(text, font=pfont)
            pw = int(tw_ + height * 0.05)
            draw.rounded_rectangle([px, py, px + pw, py + pill_h],
                                   radius=pill_h / 2, fill=(*color, 40))
            draw.line([(px, py + pill_h), (px + pw, py + pill_h)],
                      fill=(*color, 150), width=2)
            fh = pfont.getbbox(text)[3] - pfont.getbbox(text)[1]
            draw.text((px + int(height * 0.025),
                       py + pill_h / 2 - fh / 2),
                      text, font=pfont, fill=color)
            px += pw + int(height * 0.02)

    return img


def main():
    wide = build_cover(2400, 1260, square=False)
    wide_path = OUT_DIR / "cover.png"
    wide.convert("RGB").save(wide_path, quality=95)
    print(f"Saved {wide_path} ({wide.size})")

    social = build_cover(1200, 630, square=False)
    social_path = OUT_DIR / "cover-social.png"
    social.convert("RGB").save(social_path, quality=95)
    print(f"Saved {social_path} ({social.size})")

    square = build_cover(1200, 1200, square=True)
    square_path = OUT_DIR / "cover-square.png"
    square.convert("RGB").save(square_path, quality=95)
    print(f"Saved {square_path} ({square.size})")


if __name__ == "__main__":
    main()
