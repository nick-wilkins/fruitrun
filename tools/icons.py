"""Make the app icon from the smoothie cup (needs Pillow). A stand-in until the proper icon is drawn."""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SKY = (76, 192, 255, 255)
SIZE = 1024

cup = Image.open(ROOT / "tools/source/smoothie-cup.png").convert("RGBA")
height = round(SIZE * 0.6)
scaled = cup.resize((round(cup.width * height / cup.height), height), Image.LANCZOS)
icon = Image.new("RGBA", (SIZE, SIZE), SKY)
icon.alpha_composite(scaled, ((SIZE - scaled.width) // 2, (SIZE - scaled.height) // 2))
# The App Store refuses an icon with transparency.
icon.convert("RGB").save(ROOT / "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png", optimize=True)
