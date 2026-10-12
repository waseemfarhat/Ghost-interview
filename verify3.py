import docx, io
from PIL import Image
from docx.oxml.ns import qn
DOC="Ghost_Interview_FYP_Evaluation3_Documentation.docx"
d=docx.Document(DOC)
paras=d.paragraphs
ph_count=0; total=0
remaining=[]
for i,p in enumerate(paras):
    blip=p._p.find(".//"+qn("a:blip"))
    if blip is None: continue
    total+=1
    rid=blip.get(qn("r:embed"))
    part=d.part.related_parts[rid]
    im=Image.open(io.BytesIO(part.blob))
    if im.size==(1274,798):
        ph_count+=1
        cap=paras[i+1].text.strip() if i+1<len(paras) else ""
        remaining.append(cap[:60])
print("TOTAL_FIGURE_SLOTS", total, "STILL_PLACEHOLDER", ph_count)
for c in remaining: print("  PH:", c)
