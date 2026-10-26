import json
import sys

from fontTools import subset
from fontTools.ttLib import TTFont

source, target, charset = sys.argv[1], sys.argv[2], sys.argv[3]
with open(charset, encoding="utf-8") as f:
    wanted = set()
    for r in json.load(f)["ranges"]:
        a, _, b = r[2:].partition("-")
        lo, hi = int(a, 16), int(b or a, 16)
        wanted.update(range(lo, hi + 1))

font = TTFont(source)
cmap = set(font.getBestCmap())
keep = sorted(wanted & cmap)
options = subset.Options()
options.flavor = "woff2"
options.layout_features = ["*"]
options.name_IDs = ["*"]
options.notdef_outline = True
options.glyph_names = False
subsetter = subset.Subsetter(options)
subsetter.populate(unicodes=keep)
subsetter.subset(font)
font.flavor = "woff2"
font.save(target)
print(json.dumps({"kept": len(keep), "inSource": len(cmap), "glyphs": len(font.getGlyphOrder())}))
