import docx
from docx.oxml.ns import qn
from PIL import Image
import os, glob

print("===== IMAGE DIMENSIONS / ASPECT =====")
for p in sorted(glob.glob('extracted_images/*')):
    try:
        im = Image.open(p)
        w, h = im.size
        print(f"{os.path.basename(p):22s} {w}x{h}  ar={w/h:.3f}")
    except Exception as e:
        print(p, "ERR", e)

print("\n===== DOCX ORDERED STRUCTURE =====")
d = docx.Document('Ghost_Interview_FYP_Evaluation3_Documentation.docx')
body = d.element.body
# Map each drawing/blip to a paragraph
para_has_img = {}
for para in d.paragraphs:
    drawings = para._element.findall('.//' + qn('w:drawing'))
    if drawings:
        para_has_img[para._element] = len(drawings)

idx = 0
for child in body.iterchildren():
    tag = child.tag.split('}')[-1]
    if tag == 'p':
        # style
        txt = ''.join(child.itertext()).strip()
        # find style
        pPr = child.find(qn('w:pPr'))
        style = ''
        if pPr is not None:
            ps = pPr.find(qn('w:pStyle'))
            if ps is not None:
                style = ps.get(qn('w:val')) or ''
        ni = para_has_img.get(child, 0)
        marker = f"[IMGx{ni}]" if ni else ""
        if txt or ni or style:
            print(f"{idx:3d} P {style:12s} {marker:6s} {txt[:80]}")
        idx += 1
    elif tag == 'tbl':
        # first row first cell
        cells = child.findall('.//' + qn('w:tc'))
        first = ''.join(cells[0].itertext()).strip()[:40] if cells else ''
        print(f"{idx:3d} TBL            cells={len(cells)} first='{first}'")
        idx += 1
