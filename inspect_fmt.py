import docx
from docx.oxml.ns import qn
from lxml import etree

d = docx.Document('Ghost_Interview_FYP_Evaluation3_Documentation.docx')
body = d.element.body
paras = d.paragraphs

def find_by_text(sub):
    for p in paras:
        t = p.text.strip()
        if t.startswith(sub):
            return p
    return None

def dump(label, p):
    print(f"\n===== {label} : style={p.style.name} =====")
    xml = p._element.xml
    # shorten: remove drawing inner content noise
    print(xml[:1400])

dump("H1 Introduction", find_by_text("1. Introduction"))
dump("H2 2.1 User Registration", find_by_text("2.1 User Registration"))
dump("Caption Fig 2.1", find_by_text("Figure 2.1:"))

# image paragraph
for p in paras:
    if p._element.findall('.//' + qn('w:drawing')):
        dump("IMAGE PARA (first)", p)
        break
