import docx
from docx.oxml.ns import qn
from lxml import etree

DOC = 'Ghost_Interview_FYP_Evaluation3_Documentation.docx'
doc = docx.Document(DOC)
paras = doc.paragraphs

print('=== TOC (paras 0-30) ===')
for i, p in enumerate(paras[:32]):
    if p.text.strip():
        runs = p.runs
        bold = runs[0].bold if runs else None
        sz = runs[0].font.size.pt if (runs and runs[0].font.size) else None
        col = None
        try:
            col = runs[0].font.color.rgb
        except Exception:
            pass
        print(f'p{i:3d} b={bold} sz={sz} col={col} | {p.text.strip()[:60]}')

print('\n=== IMAGE PARA p90 structure ===')
p = paras[90]
print('style:', p.style.name, '| align:', p.alignment)
for ri, r in enumerate(p.runs):
    has_draw = r._r.find('.//' + qn('wp:inline')) is not None
    print(f'  run{ri} bold={r.bold} has_inline={has_draw} text={r.text!r}')
xml = etree.tostring(p._p, pretty_print=True).decode()
print(xml[:1600])
