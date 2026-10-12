import docx
from docx.oxml.ns import qn
d=docx.Document('Ghost_Interview_FYP_Evaluation3_Documentation.docx')
styles=set()
for p in d.paragraphs:
    styles.add(p.style.name)
print('STYLES USED:', sorted(styles))
