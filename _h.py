import docx
from docx.oxml.ns import qn
d=docx.Document('Ghost_Interview_FYP_Evaluation3_Documentation.docx')
print('=== HEADINGS ===')
for i,p in enumerate(d.paragraphs):
    st=(p.style.name or '')
    if 'Heading' in st:
        print(i, '|', st.replace('Heading','H'), '|', p.text.strip()[:70])
