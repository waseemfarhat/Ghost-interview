import docx, os
from PIL import Image
d=docx.Document('Ghost_Interview_FYP_Evaluation3_Documentation.docx')
print('=== EXTRACTED IMAGE DIMS ===')
for f in sorted(os.listdir('extracted_images')):
    p=os.path.join('extracted_images',f)
    try:
        im=Image.open(p); print(f, im.size)
    except Exception as e:
        print(f,'ERR',e)
print('=== HEADINGS ===')
for i,p in enumerate(d.paragraphs):
    st=(p.style.name or '')
    if st.startswith('Heading 1') or st.startswith('Heading 2'):
        print(i, '|', st, '|', p.text.strip())
