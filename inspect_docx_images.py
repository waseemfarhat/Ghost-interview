import docx
from docx.oxml.ns import qn

DOC = "Ghost_Interview_FYP_Evaluation3_Documentation.docx"
d = docx.Document(DOC)

def has_drawing(p):
    return p._p.findall('.//' + qn('w:drawing')) or p._p.findall('.//' + qn('w:pict'))

# Walk body in document order (paragraphs + tables)
body = d.element.body
items = []
from docx.text.paragraph import Paragraph
from docx.table import Table
for child in body.iterchildren():
    if child.tag == qn('w:p'):
        items.append(('p', Paragraph(child, d)))
    elif child.tag == qn('w:tbl'):
        items.append(('tbl', Table(child, d)))

print("total body items:", len(items))
print("=" * 80)
for idx, (kind, obj) in enumerate(items):
    if kind == 'p':
        drawings = obj._p.findall('.//' + qn('w:drawing')) + obj._p.findall('.//' + qn('w:pict'))
        # caption text = this paragraph text or next paragraph
        txt = obj.text.strip()
        if drawings:
            # find following caption text within next 2 paragraphs
            cap = ""
            for j in range(idx + 1, min(idx + 3, len(items))):
                if items[j][0] == 'p':
                    t = items[j][1].text.strip()
                    if t:
                        cap = t
                        break
            print(f"[IMG] item#{idx}  nDraw={len(drawings)}  selfText={txt!r}")
            print(f"       caption={cap!r}")
    # also detect images inside tables
for idx, (kind, obj) in enumerate(items):
    if kind == 'tbl':
        draws = obj._tbl.findall('.//' + qn('w:drawing'))
        if draws:
            print(f"[TBL IMG] item#{idx} nDraw={len(draws)}")
