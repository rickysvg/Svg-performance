"""Cut photoreal plate shots to transparent WebP/PNG badge assets."""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

SRC = {
    "bronze": Path("/home/ubuntu/.cursor/projects/workspace/uploads/plate_bronze_blank_c2ca.png"),
    "steel": Path("/home/ubuntu/.cursor/projects/workspace/uploads/plate_steel_blank_84e2.png"),
    "gold": Path("/home/ubuntu/.cursor/projects/workspace/uploads/plate_gold_blank_1c5d.png"),
}
OUT = Path("/workspace/public/badges")


def cut_plate(path: Path) -> Image.Image:
    rgb = np.asarray(Image.open(path).convert("RGB"), dtype=np.float32)
    mn = rgb.min(axis=2)
    mx = rgb.max(axis=2)
    span = mx - mn
    # White field and the soft contact shadow go away; metal + rivets stay.
    alpha = np.clip((232.0 - mn) / 28.0, 0.0, 1.0)
    alpha = np.where((mn > 226) & (span < 14), 0.0, alpha)
    alpha = np.where(mn > 246, 0.0, alpha)
    a3 = alpha[..., None]
    cleaned = np.clip((rgb - 255.0 * (1.0 - a3)) / np.maximum(a3, 0.04), 0.0, 255.0)
    rgba = np.dstack([cleaned, alpha * 255.0]).astype(np.uint8)
    image = Image.fromarray(rgba, "RGBA")
    ys, xs = np.where(alpha > 0.08)
    pad = 6
    box = (
        max(int(xs.min()) - pad, 0),
        max(int(ys.min()) - pad, 0),
        min(int(xs.max()) + pad + 1, image.width),
        min(int(ys.max()) + pad + 1, image.height),
    )
    return image.crop(box)


def fit_width(image: Image.Image, width: int) -> Image.Image:
    height = max(1, round(image.height * (width / image.width)))
    return image.resize((width, height), Image.Resampling.LANCZOS)


def save(image: Image.Image, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.suffix == ".webp":
        image.save(dest, "WEBP", quality=86, method=6)
    else:
        image.save(dest, "PNG", optimize=True)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for name, src in SRC.items():
        plate = cut_plate(src)
        for size in (512, 256):
            fitted = fit_width(plate, size)
            save(fitted, OUT / f"plate-{name}-{size}.webp")
            save(fitted, OUT / f"plate-{name}-{size}.png")
            print(name, size, fitted.size, (OUT / f"plate-{name}-{size}.webp").stat().st_size)


if __name__ == "__main__":
    main()
