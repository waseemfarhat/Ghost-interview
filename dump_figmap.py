import docx
from docx.oxml.ns import qn

PATH = 'Ghost_Interview_FYP_Evaluation3_Documentation.docx'
d = docx.Document(PATH)

paras = d.paragraphs

def is_heading(p):
    # heading = bold run, short text, no drawing
    if p._p.findall('.//' + qn('w:drawing')):
        return False
    t = p.text.strip()
    if not t:
        return False
    for r in p.runs:
        if r.bold and r.text.strip():
            return True
    return False

def has_image(p):
    return bool(p._p.findall('.//' + qn('w:drawing')))

last_heading = ''
for i, p in enumerate(paras):
    if is_heading(p):
        last_heading = p.text.strip()
    if has_image(p):
        # find the caption = next non-empty paragraph
        cap = ''
        for j in range(i+1, min(i+4, len(paras))):
            t = paras[j].text.strip()
            if t:
                cap = t
                break
        print(f'[{last_heading}]  ->  {cap}')
