#!/usr/bin/env python3
import math, os, shutil, subprocess, sys
from PIL import Image, ImageDraw, ImageFilter

def lerp(a, b, t):
    return a + (b - a) * t

def create_icon(size):
    s = size
    img = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    d.rounded_rectangle([(0, 0), (s, s)], radius=int(s * 0.2), fill=(9, 22, 6, 255))

    cx = s // 2
    probe_cy = int(s * 0.21)
    r_max    = int(s * 0.62)
    r_min    = int(s * 0.09)
    half_deg = 52

    steps = 80
    fan_pts = [(cx, probe_cy)]
    for i in range(steps + 1):
        deg = 90 - half_deg + (2 * half_deg * i / steps)
        rad = math.radians(deg)
        x = cx + r_max * math.cos(rad)
        y = probe_cy + r_max * math.sin(rad)
        fan_pts.append((int(x), int(y)))
    d.polygon(fan_pts, fill=(10, 35, 14, 230))

    n = 9
    for i in range(1, n + 1):
        r = r_min + (r_max - r_min) * i / n
        frac = i / n
        g = int(lerp(45, 200, frac))
        b = int(lerp(20, 70,  frac))
        a = int(lerp(220, 90, frac))
        lw = max(1, int(s / 220))
        bbox = [cx - r, probe_cy - r, cx + r, probe_cy + r]
        d.arc(bbox, start=90 - half_deg, end=90 + half_deg, fill=(0, g, b, a), width=lw)

    for sign in (-1, 1):
        rad = math.radians(90 + sign * half_deg)
        x1 = cx + r_min * math.cos(rad)
        y1 = probe_cy + r_min * math.sin(rad)
        x2 = cx + r_max * math.cos(rad)
        y2 = probe_cy + r_max * math.sin(rad)
        d.line([(int(x1), int(y1)), (int(x2), int(y2))], fill=(0, 90, 40, 100), width=max(1, int(s / 300)))

    focal_dist = int(r_max * 0.52)
    fy = probe_cy + focal_dist
    fx = cx

    glow_r = int(s * 0.11)
    glow = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    for gr in range(glow_r, 0, -1):
        a = int(55 * (1 - gr / glow_r) ** 1.5)
        gd.ellipse([fx - gr, fy - gr, fx + gr, fy + gr], fill=(60, 220, 100, a))
    img = Image.alpha_composite(img, glow)
    d = ImageDraw.Draw(img)

    ox, oy = int(s * 0.13), int(s * 0.09)
    d.ellipse([fx - ox, fy - oy, fx + ox, fy + oy], fill=(35, 140, 55, 180))

    br = int(s * 0.042)
    d.ellipse([fx - br, fy - br, fx + br, fy + br], fill=(120, 240, 140, 210))
    cr = int(br * 0.45)
    d.ellipse([fx - cr, fy - cr, fx + cr, fy + cr], fill=(220, 255, 210, 240))

    pw  = int(s * 0.24)
    ph  = int(s * 0.065)
    py1 = probe_cy - ph
    py2 = probe_cy

    d.rounded_rectangle([cx - pw // 2, py1, cx + pw // 2, py2], radius=int(ph * 0.45), fill=(38, 72, 28, 255))

    hl_w = int(pw * 0.55)
    hl_h = int(ph * 0.28)
    d.rounded_rectangle([cx - hl_w // 2, py1 + int(ph * 0.12), cx + hl_w // 2, py1 + int(ph * 0.12) + hl_h],
                         radius=int(hl_h * 0.4), fill=(90, 160, 60, 90))

    face_pad = int(pw * 0.08)
    lw_face  = max(2, int(s / 120))
    d.line([(cx - pw // 2 + face_pad, py2), (cx + pw // 2 - face_pad, py2)], fill=(140, 255, 100, 255), width=lw_face)

    beam_pts = [
        (cx - pw // 2 + face_pad, py2),
        (cx + pw // 2 - face_pad, py2),
        (cx + int(pw * 0.15), py2 + int(s * 0.04)),
        (cx - int(pw * 0.15), py2 + int(s * 0.04)),
    ]
    d.polygon(beam_pts, fill=(80, 200, 80, 60))

    line_y  = int(s * 0.795)
    lx1     = int(s * 0.16)
    lx2     = int(s * 0.84)
    lh      = max(2, int(s * 0.024))
    gap     = int(s * 0.046)
    widths  = [1.0, 0.68, 0.42]
    alphas  = [200, 165, 130]

    for i, (w, a) in enumerate(zip(widths, alphas)):
        ry  = line_y + i * gap
        rx2 = lx1 + int((lx2 - lx1) * w)
        d.rounded_rectangle([lx1, ry, rx2, ry + lh], radius=lh // 2, fill=(70, 165, 50, a))

    border_img = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    bd = ImageDraw.Draw(border_img)
    bw = max(1, int(s / 200))
    bd.rounded_rectangle([(bw, bw), (s - bw, s - bw)], radius=int(s * 0.195), outline=(60, 140, 40, 80), width=bw)
    img = Image.alpha_composite(img, border_img)

    return img


def make_iconset(out_dir):
    sizes = [16, 32, 64, 128, 256, 512, 1024]
    iconset = os.path.join(out_dir, 'RefertEco.iconset')
    os.makedirs(iconset, exist_ok=True)

    for sz in sizes:
        icon = create_icon(sz)
        icon.save(os.path.join(iconset, f'icon_{sz}x{sz}.png'))
        if sz <= 512:
            icon2 = create_icon(sz * 2)
            icon2.save(os.path.join(iconset, f'icon_{sz}x{sz}@2x.png'))

    return iconset


if __name__ == '__main__':
    out = os.path.dirname(os.path.abspath(__file__))
    print('  Genero icona RefertEco...')
    iconset = make_iconset(out)

    icns = os.path.join(out, 'RefertEco.icns')
    ret  = subprocess.run(['iconutil', '-c', 'icns', iconset, '-o', icns], capture_output=True)
    if ret.returncode != 0:
        print('  Errore iconutil:', ret.stderr.decode())
        sys.exit(1)

    shutil.rmtree(iconset)
    print(f'  ✓ Icona creata: {icns}')
