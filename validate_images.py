import docx
from docx.oxml.ns import qn
from collections import Counter

DOC = 'Ghost_Interview_FYP_Evaluation3_Documentation.docx'
doc = docx.Document(DOC)

# map rId -> image filename via part rels
part = doc.part
rid_to_name = {}
for rid, rel in part.rels.items():
    if 'image' in rel.reltype:
        try:
            rid_to_name[rid] = rel.target_part.partname.split('/')[-1]
        except Exception:
            pass

print("Image parts in package:", len(rid_to_name))
print("Sample parts:", list(rid_to_name.items())[:3], "...\n")

# per-slot rId + resolved image
print("Slot -> rId -> image (first 6, the 4 replaced, and appendix):")
paras = doc.paragraphs
k = 0
for i, p in enumerate(paras):
    if not p._p.findall('.//' + qn('w:drawing')):
        continue
    inline = doc.inline_shapes[k]
    blip = inline._inline.graphic.graphicData.pic.blipFill.blip
    rid = blip.get(qn('r:embed'))
    cap = ''
    for j in range(i+1, min(i+4, len(paras))):
        if paras[j].text.strip():
            cap = paras[j].text.strip()[:52]; break
    tag = ''
    if any(s in cap for s in ['Figure 2.10','Figure 2.12','Figure 2.15','Figure 2.19','Appendix','System arch','Context','Class','Use case','Flowchart','Sequence','Gantt']):
        tag = '  <<<'
    print(f"[{k:2d}] {rid} -> {rid_to_name.get(rid,'?'):12s} | {cap}{tag}")
    k += 1

# count distinct image parts actually referenced
used = Counter()
for sh in doc.inline_shapes:
    blip = sh._inline.graphic.graphicData.pic.blipFill.blip
    used[blip.get(qn('r:embed'))] += 1
print("\nDistinct rIds used by images:", len(used))
print("rIds referencing image1.png (leftover placeholder):", sum(1 for r in used if rid_to_name.get(r)=='image1.png'), "slots")
