import docx
from docx.oxml.ns import qn
from docx.shared import Pt

DOC = 'Ghost_Interview_FYP_Evaluation3_Documentation.docx'
doc = docx.Document(DOC)
paras = doc.paragraphs

def fmt_para(idx):
    p = paras[idx]
    pf = p.paragraph_format
    print(f"\n--- p{idx}: style={p.style.name!r} align={pf.alignment} "
          f"before={pf.space_before} after={pf.space_after} line={pf.line_spacing}")
    has_img = bool(p._p.findall('.//' + qn('w:drawing')))
    print(f"    text={p.text[:70]!r}  HAS_IMG={has_img}")
    for r in p.runs:
        col = r.font.color.rgb if (r.font.color and r.font.color.type is not None) else None
        print(f"    run: bold={r.bold} italic={r.italic} size={r.font.size} "
              f"name={r.font.name} color={col} text={r.text[:50]!r}")

# find key paragraphs
chapter2 = [i for i,p in enumerate(paras) if 'CHAPTER 2' in p.text.upper() or 'Chapter 2' in p.text]
screens  = [i for i,p in enumerate(paras) if p.text.strip().lower()=='screenshots']
figcap   = [i for i,p in enumerate(paras) if p.text.strip().startswith('Figure 2.1:')]
print("chapter2 idx:", chapter2, "screenshots idx:", screens, "fig2.1 cap idx:", figcap)

# image paragraph
for i,p in enumerate(paras):
    if p._p.findall('.//'+qn('w:drawing')):
        fmt_para(i); break

# a sub-heading (module title) - find one with '2.1'
sub = [i for i,p in enumerate(paras) if p.text.strip().startswith('2.1')]
print("\nsubheading 2.x idx:", sub)
if sub: fmt_para(sub[0])

if screens: fmt_para(screens[0])
if figcap: fmt_para(figcap[0])
if chapter2: fmt_para(chapter2[0])

# last paragraphs (end of doc / conclusion area)
print("\n=== LAST 12 PARAGRAPHS ===")
for i in range(max(0,len(paras)-12), len(paras)):
    p=paras[i]
    has_img = bool(p._p.findall('.//'+qn('w:drawing')))
    print(f"[p{i:3d}] img={has_img} style={p.style.name} {p.text[:60]!r}")
