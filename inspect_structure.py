import docx
from docx.oxml.ns import qn

DOC = r'Ghost_Interview_FYP_Evaluation3_Documentation.docx'
d = docx.Document(DOC)
body = d.element.body

order = []
for child in body.iterchildren():
    tag = child.tag
    if tag == qn('w:p'):
        texts = child.findall('.//' + qn('w:t'))
        txt = ''.join(t.text or '' for t in texts)
        has_pic = child.find('.//' + qn('w:drawing')) is not None
        # detect style
        ppr = child.find(qn('w:pPr'))
        style = ''
        if ppr is not None:
            ps = ppr.find(qn('w:pStyle'))
            if ps is not None:
                style = ps.get(qn('w:val'))
        order.append(('p', txt.strip(), has_pic, style))
    elif tag == qn('w:tbl'):
        order.append(('tbl', '<TABLE>', False, ''))

fig_no = 0
for kind, txt, has_pic, style in order:
    if has_pic:
        fig_no += 1
        print(f'    >>> [FIGURE SLOT #{fig_no}] <<<')
    elif kind == 'tbl':
        print('    [TABLE]')
    else:
        if not txt:
            continue
        # show headings prominently
        if style.startswith('Heading') or 'Heading' in style or 'Title' in style:
            print(f'\n### {style.upper()}: {txt[:90]}')
        elif txt.lower().startswith('figure'):
            print(f'      caption: {txt[:100]}')
        elif len(txt) < 60 and txt[0].isupper() and not txt.endswith('.'):
            print(f'    - {txt[:90]}')
