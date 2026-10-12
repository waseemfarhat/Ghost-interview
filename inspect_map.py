import docx
from docx.shared import Cm, Emu
from docx.oxml.ns import qn

DOC = 'Ghost_Interview_FYP_Evaluation3_Documentation.docx'
d = docx.Document(DOC)
print('inline_shapes:', len(d.inline_shapes))

# Build ordered body element list to map shapes -> following caption paragraph
body = d.element.body
children = list(body)

# index of each drawing's blip so we can locate in flow
def emu_cm(v):
    try:
        return round(v/360000.0, 1)
    except Exception:
        return None

# Walk paragraphs in document order; for each paragraph, note if it has a drawing
# and capture the next non-empty paragraph text as the caption.
paras = d.paragraphs
print('total paragraphs:', len(paras))

# Map: iterate paragraphs, detect inline drawings within run
for pi, p in enumerate(paras):
    has_draw = p._p.findall('.//' + qn('w:drawing'))
    if has_draw:
        # find blip embed rId to get image size
        for dr in has_draw:
            ext = dr.findall('.//' + qn('wp:extent'))
            cx = cy = None
            if ext:
                cx = int(ext[0].get('cx'))
                cy = int(ext[0].get('cy'))
            size = f"{emu_cm(cx)}x{emu_cm(cy)}cm" if cx else "?"
        # caption = next non-empty paragraph
        cap = ''
        for pj in range(pi+1, len(paras)):
            t = paras[pj].text.strip()
            if t:
                cap = t
                break
        # section heading context: nearest preceding Heading 1/2
        ctx = ''
        for pk in range(pi, -1, -1):
            st = paras[pk].style.name if paras[pk].style else ''
            if st.startswith('Heading'):
                ctx = f"[{st}] {paras[pk].text.strip()[:50]}"
                break
        print(f"para#{pi:3d} size={size:12s} cap='{cap[:70]}'  {ctx}")
