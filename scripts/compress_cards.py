"""把原始牌面大图压成网页用的小图。

用法（在项目根目录）：
    <python> scripts/compress_cards.py [源目录]

默认源目录 D:\\Working\\web-project，输出 public/cards/major-XX.webp。
规则：EXIF 转正 -> 宽 640 -> 去噪（扫描件纸纹很重，不去噪压不下去）
      -> WebP 质量自 88 起每档降 2，取第一个体积 <= 100KB 的档位。
"""
import io
import sys
from pathlib import Path

from PIL import Image, ImageFilter, ImageOps

WIDTH = 640
LIMIT = 100_000  # 按十进制 100KB 卡，避免"100KB 到底算 102400 还是 100000"的歧义
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(r"D:\Working\web-project")
OUT = Path(__file__).resolve().parent.parent / "public" / "cards"


def encode(im: Image.Image, quality: int) -> bytes:
    buf = io.BytesIO()
    im.save(buf, "WEBP", quality=quality, method=6)
    return buf.getvalue()


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    sources = sorted(p for p in SRC.glob("major-*") if p.suffix.lower() in {".jpg", ".jpeg", ".png"})
    if not sources:
        print(f"no source images in {SRC}")
        return 1

    total = 0
    worst = (0, "")
    for src in sources:
        number = src.stem.split("-")[1][:2]
        target = OUT / f"major-{number}.webp"

        im = ImageOps.exif_transpose(Image.open(src)).convert("RGB")
        width, height = im.size
        im = im.resize((WIDTH, round(height * WIDTH / width)), Image.LANCZOS)
        im = im.filter(ImageFilter.MedianFilter(3)).filter(ImageFilter.SMOOTH_MORE)

        data = None
        quality = 0
        for quality in range(88, 39, -2):
            candidate = encode(im, quality)
            if len(candidate) <= LIMIT:
                data = candidate
                break
        if data is None:
            print(f"FAIL {src.name}: cannot get under {LIMIT} bytes")
            return 2

        target.write_bytes(data)
        total += len(data)
        if len(data) > worst[0]:
            worst = (len(data), target.name)
        print(f"{target.name:18s} q{quality:2d}  {len(data) / 1024:6.1f} KB  {im.size[0]}x{im.size[1]}")

    print(f"\n{len(sources)} cards, {total / 1024 / 1024:.2f} MB total, largest {worst[1]} {worst[0] / 1024:.1f} KB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
