import docx, zipfile, re
from docx.oxml.ns import qn

p = 'Ghost_Interview_FYP_Evaluation3_Documentation.docx'
d = docx.Document(p)
z = zipfile.ZipFile(p)
rels = z.read('word/_rels/document.xml.rels').decode()
relmap = {}
for m in re.finditer(r'Id="(rId\d+)"[^>]*Target="(media/[^"]+)"', rels):
    relmap[m.group(1)] = m.group(2)

paras = d.paragraphs
for i, para in enumerate(paras):
    blips = para._p.findall('.//' + qn('a:blip'))
    if blips:
        embeds = [b.get(qn('r:embed')) for b in blips]
        tgt = [relmap.get(e, '?') for e in embeds]
        cap = paras[i + 1].text if i + 1 < len(paras) else ''
        print('IMG', tgt, '=>', cap[:72])
