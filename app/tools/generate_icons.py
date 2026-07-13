#!/usr/bin/env python3
"""Genera le icone della PWA (van + sole + zampetta) in app/icons/."""
from pathlib import Path
from PIL import Image, ImageDraw

BG = (31, 92, 99)       # teal profondo (mare)
BG2 = (23, 71, 77)
VAN = (255, 255, 255)
SUN = (241, 191, 0)     # giallo Spagna
ACCENT = (232, 115, 74)  # terracotta

OUT = Path(__file__).resolve().parent.parent / "icons"
OUT.mkdir(parents=True, exist_ok=True)


def rounded_rect(draw, box, radius, fill):
    draw.rounded_rectangle(box, radius=radius, fill=fill)


def draw_icon(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    pad = int(size * 0.06)
    rounded_rect(d, [pad, pad, size - pad, size - pad], radius=int(size * 0.18), fill=BG)

    # sole nell'angolo alto
    sun_r = size * 0.10
    d.ellipse(
        [size * 0.66, size * 0.14, size * 0.66 + sun_r * 2, size * 0.14 + sun_r * 2],
        fill=SUN,
    )

    # corpo del van
    van_w = size * 0.56
    van_h = size * 0.26
    van_x = (size - van_w) / 2
    van_y = size * 0.42
    d.rounded_rectangle(
        [van_x, van_y, van_x + van_w, van_y + van_h],
        radius=size * 0.05,
        fill=VAN,
    )
    # cabina (parte anteriore leggermente più bassa/arrotondata a sinistra)
    cab_w = van_w * 0.32
    d.rounded_rectangle(
        [van_x, van_y + van_h * 0.15, van_x + cab_w, van_y + van_h],
        radius=size * 0.04,
        fill=VAN,
    )
    # finestrino
    d.rounded_rectangle(
        [van_x + cab_w * 0.18, van_y + van_h * 0.28, van_x + cab_w * 0.78, van_y + van_h * 0.62],
        radius=size * 0.015,
        fill=BG2,
    )

    # ruote
    wheel_r = size * 0.07
    wheel_y = van_y + van_h - wheel_r * 0.35
    for wx in (van_x + van_w * 0.22, van_x + van_w * 0.78):
        d.ellipse(
            [wx - wheel_r, wheel_y - wheel_r, wx + wheel_r, wheel_y + wheel_r],
            fill=BG2,
        )
        inner = wheel_r * 0.45
        d.ellipse(
            [wx - inner, wheel_y - inner, wx + inner, wheel_y + inner],
            fill=VAN,
        )

    # zampetta di Daisy sotto il van
    paw_cx = size * 0.5
    paw_cy = size * 0.80
    pr = size * 0.028
    d.ellipse([paw_cx - pr * 1.6, paw_cy, paw_cx - pr * 1.6 + pr * 2, paw_cy + pr * 2], fill=ACCENT)
    d.ellipse([paw_cx + pr * 0.4, paw_cy, paw_cx + pr * 0.4 + pr * 2, paw_cy + pr * 2], fill=ACCENT)
    for dx in (-pr * 2.2, -pr * 0.6, pr * 1.0, pr * 2.6):
        d.ellipse(
            [paw_cx + dx, paw_cy - pr * 1.6, paw_cx + dx + pr * 1.3, paw_cy - pr * 1.6 + pr * 1.3],
            fill=ACCENT,
        )

    return img


for size, name in [(192, "icon-192.png"), (512, "icon-512.png"), (180, "apple-touch-icon.png")]:
    icon = draw_icon(size)
    icon.save(OUT / name)
    print("scritta", OUT / name)
