"""Extract embedded images from the project's PDF documents (Scope/SRS/SDD)."""
import os
from pypdf import PdfReader

BASE = r"c:\Users\Anees\Desktop\FYP Ehsan Hamza"
PDFS = [
    "scope document  (1).pdf",
    "srs (1).pdf",
    "sdd1 (1).pdf",
]
OUT = os.path.join(BASE, "extracted_images")
os.makedirs(OUT, exist_ok=True)

total = 0
for pdf_name in PDFS:
    path = os.path.join(BASE, pdf_name)
    if not os.path.exists(path):
        print("MISSING:", pdf_name)
        continue
    reader = PdfReader(path)
    prefix = pdf_name.split()[0].split("(")[0].strip().replace(" ", "_")
    count = 0
    for page_num, page in enumerate(reader.pages):
        try:
            images = page.images
        except Exception as e:
            images = []
        for img in images:
            count += 1
            total += 1
            ext = os.path.splitext(img.name)[1] or ".png"
            out_name = f"{prefix}_p{page_num+1:02d}_{count:02d}{ext}"
            with open(os.path.join(OUT, out_name), "wb") as f:
                f.write(img.data)
    print(f"{pdf_name}: extracted {count} images across {len(reader.pages)} pages")

print("TOTAL extracted:", total)
print("Output dir:", OUT)
