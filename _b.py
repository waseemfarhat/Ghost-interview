import docx
from docx.oxml.ns import qn
d=docx.Document('Ghost_Interview_FYP_Evaluation3_Documentation.docx')
paras=d.paragraphs
def bold(p):
    return any(r.bold for r in p.runs if r.text.strip())
for i,p in enumerate(paras):
    t=p.text.strip()
    if not t: continue
    if bold(p) and len(t)<70:
        # color of first run
        col=None
        for r in p.runs:
            if r.text.strip():
                try: col=r.font.color.rgb
                except: col=None
                sz=r.font.size.pt if r.font.size else None
                break
        print(i,'|',col,'|',sz,'|',t)
