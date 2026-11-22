"""Build the source images @capacitor/assets turns into app icons and splash screens.

Input:  assets/source/svg-performance-lockup.png (white + neon lime logo on transparent).
Output: assets/icon-only.png, icon-foreground.png, icon-background.png,
        splash.png, splash-dark.png (black background, glowing lime ring, logo).
Run from mobile/: python3 scripts/make_brand_assets.py
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets" / "source" / "svg-performance-lockup.png"
OUT = ROOT / "assets"
LIME = (203, 248, 5)
BLACK = (0, 0, 0)


def logo(width: int) -> Image.Image:
    im = Image.open(SRC).convert("RGBA")
    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)
    h = round(im.height * width / im.width)
    return im.resize((width, h), Image.LANCZOS)


def glow_ring(size: int, radius: int, stroke: int) -> Image.Image:
    """A lime ring with a soft neon glow, on transparent."""
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    c = size // 2
    box = (c - radius, c - radius, c + radius, c + radius)
    halo = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(halo).ellipse(box, outline=LIME + (255,), width=stroke * 4)
    halo = halo.filter(ImageFilter.GaussianBlur(stroke * 2.2))
    layer.alpha_composite(halo)
    layer.alpha_composite(halo)
    ring = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(ring).ellipse(box, outline=LIME + (255,), width=stroke)
    layer.alpha_composite(ring)
    core = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    inner = stroke // 3
    ImageDraw.Draw(core).ellipse(
        (box[0] + inner, box[1] + inner, box[2] - inner, box[3] - inner),
        outline=(240, 255, 180, 255),
        width=max(2, stroke // 3),
    )
    layer.alpha_composite(core)
    return layer


def logo_glow(mark: Image.Image, blur: float) -> Image.Image:
    alpha = mark.split()[3]
    glow = Image.new("RGBA", mark.size, LIME + (0,))
    glow.putalpha(alpha.point(lambda a: int(a * 0.55)))
    pad = int(blur * 4)
    canvas = Image.new("RGBA", (mark.width + pad * 2, mark.height + pad * 2), (0, 0, 0, 0))
    canvas.alpha_composite(glow, (pad, pad))
    canvas = canvas.filter(ImageFilter.GaussianBlur(blur))
    canvas.alpha_composite(mark, (pad, pad))
    return canvas


def badge(size: int, transparent: bool, ring_scale: float, logo_scale: float) -> Image.Image:
    bg = (0, 0, 0, 0) if transparent else BLACK + (255,)
    im = Image.new("RGBA", (size, size), bg)
    radius = int(size * ring_scale / 2)
    im.alpha_composite(glow_ring(size, radius, max(4, size // 64)))
    mark = logo_glow(logo(int(size * logo_scale)), size / 160)
    im.alpha_composite(mark, ((size - mark.width) // 2, (size - mark.height) // 2))
    return im


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    badge(1024, False, 0.86, 0.68).convert("RGB").save(OUT / "icon-only.png")
    # Android adaptive icon: everything inside the 66% safe zone.
    badge(1024, True, 0.62, 0.44).save(OUT / "icon-foreground.png")
    Image.new("RGB", (1024, 1024), BLACK).save(OUT / "icon-background.png")
    splash = Image.new("RGBA", (2732, 2732), BLACK + (255,))
    splash.alpha_composite(badge(1100, True, 0.9, 0.64), ((2732 - 1100) // 2, (2732 - 1100) // 2))
    splash = splash.convert("RGB")
    splash.save(OUT / "splash.png")
    splash.save(OUT / "splash-dark.png")
    print("wrote", ", ".join(p.name for p in sorted(OUT.glob("*.png"))))


if __name__ == "__main__":
    main()
