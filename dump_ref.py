import docx
from docx.oxml.ns import qn

REF = r'C:\Users\Anees\Desktop\FYP Wasim\Freshly_FYP_Evaluation3_Documentation.docx'
d = docx.Document(REF)

def fmt(p):
    # gather run-level bold/size/color and para-level style + alignment
    styles = set()
    szs = set()
    for r in p.runs:
        if r.bold: styles.add('B')
        if r.italic: styles.add('I')
        if r.underline: styles.add('U')
        if r.font.size: szs.add(r.font.size.pt)
    align = p.alignment
    return f"[{'/'.join(sorted(styles)) if styles else '-'}|{sorted(szs)}|{align}]"

print("===== PARAGRAPHS =====")
for i, p in enumerate(d.paragraphs):
    t = p.text.strip()
    if t == '' and not p.runs:
        continue
    # detect images
    has_img = p._p.findall('.//' + qn('a:blip'))
    tag = ' <IMG>' if has_img else ''
    print(f"{i:03d} {fmt(p)} {t[:100]}{tag}")

print()
print("===== TABLES =====")
for ti, tb in enumerate(d.tables):
    print(f"--- Table {ti}: {len(tb.rows)} rows x {len(tb.columns)} cols ---")
    for r in tb.rows[:3]:
        cells = [c.text.strip()[:22] for c in r.cells]
        print("   ", " | ".join(cells))
