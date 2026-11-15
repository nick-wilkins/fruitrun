"""Make the home-screen icons in public/ from the smoothie cup (needs Pillow)."""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SKY = (76, 192, 255, 255)

cup = Image.open(ROOT / "tools/source/smoothie-cup.png").convert("RGBA")

for name, size in (("icon-512.png", 512), ("icon-192.png", 192), ("apple-touch-icon.png", 180)):
    # The cup fills 60% of the height, which keeps it inside the circle Android may crop the icon to.
    height = round(size * 0.6)
    scaled = cup.resize((round(cup.width * height / cup.height), height), Image.LANCZOS)
    icon = Image.new("RGBA", (size, size), SKY)
    icon.alpha_composite(scaled, ((size - scaled.width) // 2, (size - scaled.height) // 2))
    icon.convert("RGB").save(ROOT / "public" / name, optimize=True)
    print(name)
