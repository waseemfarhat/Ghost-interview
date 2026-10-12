import os, comtypes, comtypes.client
import pypdfium2 as pdfium
from PIL import Image

DOC = os.path.abspath('Ghost_Interview_FYP_Evaluation3_Documentation.docx')
PDF = os.path.abspath('preview_check.pdf')
wd = comtypes.client.CreateObject('Word.Application')
wd.Visible = False
try:
    d = wd.Documents.Open(DOC, ReadOnly=True)
    d.SaveAs(PDF, FileFormat=17)  # 17 = wdFormatPDF
    pages = d.ComputeStatistics(2)  # 2 = wdStatisticPages
    d.Close(False)
finally:
    wd.Quit()
print('PDF pages:', pages)

pdf = pdfium.PdfDocument(PDF)
n = len(pdf)
os.makedirs('preview_check', exist_ok=True)
# render first page, and last 6 pages (appendix)
targets = sorted(set([0] + list(range(max(0, n-6), n))))
for idx in targets:
    page = pdf[idx]
    bmp = page.render(scale=1.4)
    img = bmp.to_pil().convert('RGB')
    out = f'preview_check/page_{idx+1:02d}.png'
    img.save(out)
    print('rendered', out, img.size)
