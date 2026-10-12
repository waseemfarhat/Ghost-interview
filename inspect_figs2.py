import docx
from docx.oxml.ns import qn
from docx.text.paragraph import Paragraph
from docx.table import Table

d = docx.Document('Ghost_Interview_FYP_Evaluation3_Documentation.docx')
body = d.element.body

items = []
for child in body.iterchildren():
    tag = child.tag.split('}')[-1]
    if tag == 'p':
        items.append(('p', Paragraph(child, d)))
    elif tag == 'tbl':
        items.append(('tbl', Table(child, d)))

idx = 0
for i, (kind, obj) in enumerate(items):
    if kind == 'p':
        drawings = obj._p.findall('.//' + qn('w:drawing'))
        if drawings:
            idx += 1
            ext = obj._p.findall('.//' + qn('wp:extent'))
            size = ''
            if ext:
                cx = int(ext[0].get('cx'))
                cy = int(ext[0].get('cy'))
                size = f'{cx/914400*2.54:.1f}x{cy/914400*2.54:.1f}cm'
            caption = ''
            for j in range(i+1, min(i+3, len(items))):
                if items[j][0] == 'p' and items[j][1].text.strip():
                    caption = items[j][1].text.strip()
                    break
            print(f'[{idx}] IMG {size:16s} | {caption[:85]}')

print(f'\nTotal image paragraphs: {idx}')
