import docx
from docx.oxml.ns import qn
from docx.shared import RGBColor

REF = r'C:\Users\Anees\Desktop\FYP Wasim\Freshly_FYP_Evaluation3_Documentation.docx'
d = docx.Document(REF)

# Default style font
st = d.styles['Normal']
print("Normal font:", st.font.name, st.font.size)

# Page setup
sec = d.sections[0]
print("Page W x H:", sec.page_width, sec.page_height)
print("Margins L/R/T/B:", sec.left_margin, sec.right_margin, sec.top_margin, sec.bottom_margin)

# Inspect a heading run color
def color_of(idx):
    p = d.paragraphs[idx]
    for r in p.runs:
        c = r.font.color
        rgb = None
        if c and c.rgb is not None:
            rgb = str(c.rgb)
        return f"text='{p.text[:40]}' bold={r.bold} size={r.font.size.pt if r.font.size else None} color={rgb} name={r.font.name}"

print("\n-- Heading colors --")
for idx in [0, 5, 15, 34, 37, 44, 46, 48]:
    print(idx, color_of(idx))

# Table header styling
print("\n-- Table 0 (tech stack) header cell --")
t = d.tables[0]
c = t.rows[0].cells[0]
for p in c.paragraphs:
    for r in p.runs:
        rgb = str(r.font.color.rgb) if r.font.color and r.font.color.rgb else None
        print("  header run:", repr(r.text), "bold=", r.bold, "color=", rgb)
# shading of header cell
from docx.oxml.ns import qn as Q
shd = c._tc.find(Q('w:tcPr') )
print("  style:", t.style.name if t.style else None)

# Table 7 (completion) header
t7 = d.tables[7]
c7 = t7.rows[0].cells[0]
for p in c7.paragraphs:
    for r in p.runs:
        rgb = str(r.font.color.rgb) if r.font.color and r.font.color.rgb else None
        print("  T7 header run:", repr(r.text), "bold=", r.bold, "color=", rgb)
print("  T7 style:", t7.style.name if t7.style else None)

# check PASS cell
tc = t7.rows[1].cells[-1]
print("  T7 status cell text:", repr(tc.text))

# Full text of key paragraphs
print("\n-- Full texts --")
for idx in [13, 35, 36, 45, 47, 146, 147]:
    print(f"[{idx}] {d.paragraphs[idx].text}")
    print()
