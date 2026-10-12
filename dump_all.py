import docx, os
from docx.oxml.ns import qn
from PIL import Image

DOC = 'Ghost_Interview_FYP_Evaluation3_Documentation.docx'

print("=" * 90)
print("IMAGE INVENTORY (real artifacts available)")
print("=" * 90)
d = 'extracted_images'
for f in sorted(os.listdir(d)):
    p = os.path.join(d, f)
    try:
        w, h = Image.open(p).size
        print(f"  {f:28s} {w}x{h}")
    except Exception as e:
        print(f"  {f:28s} ERR {e}")

print()
print("=" * 90)
print("ORDERED DOCUMENT MAP: image-slot -> caption, with nearest heading above")
print("=" * 90)
doc = docx.Document(DOC)
paras = doc.paragraphs
last_heading = ""
for i, para in enumerate(paras):
    # detect image
    has_img = para._p.findall('.//' + qn('w:drawing')) or para._p.findall('.//' + qn('w:pict'))
    txt = para.text.strip()
    is_bold = any(r.bold for r in para.runs if r.text.strip())
    if txt and is_bold and len(txt) < 90:
        last_heading = txt
    if has_img:
        # find caption = next non-empty paragraph
        cap = ""
        for j in range(i + 1, min(i + 4, len(paras))):
            t = paras[j].text.strip()
            if t:
                cap = t
                break
        print(f"[p{i:3d}] IMG  under '{last_heading[:55]}'")
        print(f"        caption: {cap[:95]}")
