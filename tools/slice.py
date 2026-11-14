"""Slice the source sticker sheets into square icons and compress the backdrops.

Run from the project root: python3 tools/slice.py
"""
import colorsys
from pathlib import Path

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SIZE = 256

FRUITS = [
    "strawberry", "blueberry", "raspberry", "blackberry", "banana", "kiwi", "pineapple",
    "mango", "orange", "apple", "greenapple", "pear", "peach", "cherry",
    "grape", "watermelon", "melon", "coconut", "pomegranate", "lemon", "lime",
    "cranberry", "plum", "apricot", "fig", "passionfruit", "dragonfruit", "guava",
]
NUTS_AND_SEEDS = [
    "almond", "cashew", "walnut", "hazelnut", "pistachio", "pecan", "brazil",
    "macadamia", "peanut", "pinenut", "quinoa", "sunflower", "pumpkinseed", "chia",
    "flax", "hemp", "seedmix", "poppy", "cacaonibs", "coconutchips", "coconutflakes",
    "oats", "granola", "protein", "cocoa", "cinnamon", "vanilla", "ginger",
]
# Names starting with "_" duplicate an icon from the nuts and seeds sheet and are skipped.
OTHERS = [
    "honey", "maple", "yogurt", "icecream", "coconutmilk", "almondmilk", "oatmilk", "milk",
    "avocado", "frozenbanana", "spinach", "kale", "cucumber", "carrot", "beetroot", "celery",
    "_ginger", "turmeric", "_cocoa", "_cinnamon", "matcha", "_chia", "_flax", "_hemp",
    "_protein", "_oats", "_granola", "peanutbutter", "almondbutter", "coconutyogurt", "darkchoc", "whitechoc",
    "ice", "sorbet", "frozenyogurt", "_coconutchips", "dates", "raisins", "spirulina", "wheatgrass",
]


def cuts(mask, axis, count):
    """Cut positions along an axis: the emptiest line near each expected grid boundary."""
    w, h = mask.size
    size = w if axis == 0 else h
    profile = list(mask.resize((w, 1) if axis == 0 else (1, h), Image.BOX).getdata())
    cell = size / count
    edges = [0]
    for i in range(1, count):
        centre = int(i * cell)
        reach = int(cell * 0.22)
        window = range(centre - reach, centre + reach)
        edges.append(min(window, key=lambda p: (profile[p], abs(p - centre))))
    edges.append(size)
    return list(zip(edges[:-1], edges[1:]))


def drop_shadow(cell):
    """Remove the flat grey ground shadow: grey pixels reachable from the bottom edge of the cell."""
    w, h = cell.size
    px = cell.load()

    def grey(x, y):
        r, g, b, a = px[x, y]
        if a < 40:
            return False
        _, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
        return s < 0.16 and 0.55 < v < 0.93

    seen = set()
    stack = [(x, y) for x in range(w) for y in range(int(h * 0.72), h) if grey(x, y)]
    while stack:
        x, y = stack.pop()
        if (x, y) in seen:
            continue
        seen.add((x, y))
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and int(h * 0.6) <= ny < h and (nx, ny) not in seen and grey(nx, ny):
                stack.append((nx, ny))
    for x, y in seen:
        r, g, b, _ = px[x, y]
        px[x, y] = (r, g, b, 0)
    cell.putalpha(cell.getchannel("A").filter(ImageFilter.MedianFilter(5)))
    return cell


def drop_strays(cell):
    """Erase slivers of neighbouring stickers: small blobs that touch the edge of the cell."""
    w, h = cell.size
    alpha = cell.getchannel("A")
    solid = alpha.point(lambda a: 255 if a > 60 else 0).load()
    label = {}
    blobs = []
    for sy in range(h):
        for sx in range(w):
            if not solid[sx, sy] or (sx, sy) in label:
                continue
            index = len(blobs)
            members = []
            touches = False
            stack = [(sx, sy)]
            label[(sx, sy)] = index
            while stack:
                x, y = stack.pop()
                members.append((x, y))
                if x == 0 or y == 0 or x == w - 1 or y == h - 1:
                    touches = True
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < w and 0 <= ny < h and solid[nx, ny] and (nx, ny) not in label:
                        label[(nx, ny)] = index
                        stack.append((nx, ny))
            blobs.append((members, touches))
    biggest = max(len(members) for members, _ in blobs)
    out = alpha.load()
    for members, touches in blobs:
        if len(members) < biggest * (0.12 if touches else 0.004):
            for x, y in members:
                out[x, y] = 0
    cell.putalpha(alpha)
    return cell


def slice_sheet(source, names, cols, rows, out_dir, shadows):
    sheet = Image.open(ROOT / source).convert("RGBA")
    # The sheets carry a faint glow around each sticker: harden the alpha so only the sticker survives.
    sheet.putalpha(sheet.getchannel("A").point(lambda a: 0 if a < 110 else min(255, int((a - 110) * 255 / 120))))
    mask = sheet.getchannel("A").point(lambda a: 255 if a > 60 else 0)
    (ROOT / out_dir).mkdir(parents=True, exist_ok=True)
    for row, (y0, y1) in enumerate(cuts(mask, 1, rows)):
        strip = mask.crop((0, y0, sheet.width, y1))
        for col, (x0, x1) in enumerate(cuts(strip, 0, cols)):
            name = names[row * cols + col]
            if name.startswith("_"):
                continue
            cell = sheet.crop((x0, y0, x1, y1))
            if shadows:
                cell = drop_shadow(cell)
            cell = drop_strays(cell)
            cell = cell.crop(cell.getchannel("A").point(lambda a: 255 if a > 60 else 0).getbbox())
            side = max(cell.size) + 16
            canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
            canvas.paste(cell, ((side - cell.width) // 2, (side - cell.height) // 2), cell)
            canvas.resize((SIZE, SIZE), Image.LANCZOS).save(ROOT / out_dir / f"{name}.png", optimize=True)


slice_sheet("tools/source/fruits28.png", FRUITS, 7, 4, "public/assets/fruits", True)
slice_sheet("tools/source/extras28.png", NUTS_AND_SEEDS, 7, 4, "public/assets/items", False)
slice_sheet("tools/source/extras40.png", OTHERS, 8, 5, "public/assets/items", False)

for name in ("map", "map-tropics", "map-village", "stall"):
    Image.open(ROOT / f"tools/source/{name}.png").convert("RGB").save(ROOT / f"public/assets/{name}.webp", quality=90, method=6)
Image.open(ROOT / "tools/source/smoothie-cup.png").save(ROOT / "public/assets/smoothie-cup.png", optimize=True)


def cut(source, box, out, strays=True):
    """Lift one piece out of a UI pack: crop the rough box, then trim to what is actually drawn."""
    piece = Image.open(ROOT / source).convert("RGBA").crop(box)
    piece.putalpha(piece.getchannel("A").point(lambda a: 0 if a < 110 else min(255, int((a - 110) * 255 / 120))))
    if strays:
        piece = drop_strays(piece)
    piece = piece.crop(piece.getchannel("A").point(lambda a: 255 if a > 60 else 0).getbbox())
    (ROOT / out).parent.mkdir(parents=True, exist_ok=True)
    if out.endswith(".webp"):
        piece.save(ROOT / out, quality=90, method=6)
    else:
        piece.save(ROOT / out, optimize=True)
    print(out, piece.size)


cut("tools/source/ui-pack1.png", (0, 0, 1000, 545), "public/assets/ui/menu.webp")
cut("tools/source/ui-pack1.png", (1005, 25, 1340, 205), "public/assets/ui/level-complete.png")
cut("tools/source/ui-pack1.png", (1145, 548, 1222, 625), "public/assets/ui/star.png")
cut("tools/source/ui-pack1.png", (1222, 548, 1297, 625), "public/assets/ui/star-empty.png")
cut("tools/source/ui-pack1.png", (15, 650, 120, 770), "public/assets/ui/lock.png")
