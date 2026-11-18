"""Make the app icon from tools/source/app-icon.png (needs Pillow)."""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SIZE = 1024

icon = Image.open(ROOT / "tools/source/app-icon.png").resize((SIZE, SIZE), Image.LANCZOS)
# The App Store refuses an icon with transparency.
icon.convert("RGB").save(ROOT / "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png", optimize=True)
