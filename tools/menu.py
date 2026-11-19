"""Home screen art: trims the spare transparent edge off each piece and writes it for the web."""
from PIL import Image

PIECES = {
    "menu-bg": ("tools/source/menu-bg.png", 1720, False),
    "menu-logo": ("tools/source/menu-logo.png", 1000, True),
    "menu-carry": ("tools/source/menu-carry.png", 800, True),
    "menu-new": ("tools/source/menu-new.png", 800, True),
}

for name, (source, width, trim) in PIECES.items():
    image = Image.open(source)
    if trim:
        image = image.convert("RGBA")
        # Anything fainter than this is stray haze from cutting the piece out, not part of it.
        solid = image.getchannel("A").point(lambda a: 255 if a > 40 else 0)
        image = image.crop(solid.getbbox())
    else:
        image = image.convert("RGB")
    if image.width > width:
        image = image.resize((width, round(image.height * width / image.width)), Image.LANCZOS)
    image.save(f"public/assets/ui/{name}.webp", quality=88, method=6)
    print(name, image.size)
