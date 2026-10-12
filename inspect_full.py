import docx
from docx.oxml.ns import qn
import os

DOC = 'Ghost_Interview_FYP_Evaluation3_Documentation.docx'
doc = docx.Document(DOC)
paras = doc.paragraphs

print('=== INLINE SHAPES: idx | caption | image-part ===')
n = 0
for i, p in enumerate(paras):
    for d in p._p.findall('.//' + qn('wp:inline')):
        n += 1
        blip = d.find('.//' + qn('a:blip'))
        rid = blip.get(qn('r:embed')) if blip is not None else '?'
        partname = ''
        try:
            partname = os.path.basename(str(doc.part.related_parts[rid].partname))
        except Exception:
            partname = '???'
        cap = ''
        for j in range(i + 1, min(i + 4, len(paras))):
            t = paras[j].text.strip()
            if t:
                cap = t[:55]
                break
        print(f'[{n:2d}] p{i:3d} {partname:22s} | {cap}')

print('\n=== DOC TAIL (last 22 non-empty paras) ===')
ne = [(i, p) for i, p in enumerate(paras) if p.text.strip()]
for i, p in ne[-22:]:
    runs = p.runs
    bold = runs[0].bold if runs else None
    sz = runs[0].font.size.pt if (runs and runs[0].font.size) else None
    print(f'p{i:3d} b={bold} sz={sz} | {p.text.strip()[:70]}')

print('\nTOTAL paras:', len(paras))
