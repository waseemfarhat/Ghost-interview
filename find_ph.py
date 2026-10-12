import docx, zipfile, io
from PIL import Image
from docx.oxml.ns import qn
DOC="Ghost_Interview_FYP_Evaluation3_Documentation.docx"
d=docx.Document(DOC)
z=zipfile.ZipFile(DOC)
media=[n for n in z.namelist() if n.startswith("word/media/")]
ph_rids=set()
for n in media:
    im=Image.open(io.BytesIO(z.read(n)))
    if im.size==(1274,798):
        # find rId -> placeholder
        pass
# Walk paragraphs; for each image paragraph, get its caption (next para) and whether placeholder
paras=d.paragraphs
for i,p in enumerate(paras):
    blip=p._p.find(".//"+qn("a:blip"))
    if blip is None: continue
    rid=blip.get(qn("r:embed"))
    part=d.part.related_parts[rid]
    blob=part.blob
    im=Image.open(io.BytesIO(blob))
    is_ph = im.size==(1274,798)
    cap = paras[i+1].text.strip() if i+1<len(paras) else ""
    if is_ph:
        print(f"PH  idx={i:>3}  {cap[:55]}")
