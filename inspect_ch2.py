import docx
from docx.oxml.ns import qn

d = docx.Document('Ghost_Interview_FYP_Evaluation3_Documentation.docx')
body = d.element.body
para_has_img = {}
for para in d.paragraphs:
    drawings = para._element.findall('.//' + qn('w:drawing'))
    if drawings:
        para_has_img[para._element] = len(drawings)

idx = 0
for child in body.iterchildren():
    tag = child.tag.split('}')[-1]
    if tag == 'p':
        txt = ''.join(child.itertext()).strip()
        ni = para_has_img.get(child, 0)
        pPr = child.find(qn('w:pPr'))
        style = ''
        if pPr is not None:
            ps = pPr.find(qn('w:pStyle'))
            if ps is not None:
                style = ps.get(qn('w:val')) or ''
        core = txt
        if len(txt) > 20 and txt[:len(txt)//3] == txt[len(txt)//3:2*len(txt)//3]:
            core = txt[:len(txt)//3]
        marker = "IMG" if ni else "   "
        if 48 <= idx <= 168:
            print(f"{idx:3d} {marker} {style:10s} | {core[:100]}")
        idx += 1
    elif tag == 'tbl':
        if 48 <= idx <= 168:
            print(f"{idx:3d} === TABLE ===")
        idx += 1
