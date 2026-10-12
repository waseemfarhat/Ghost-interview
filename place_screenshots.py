import os
import docx
from docx.oxml.ns import qn

DOC = "Ghost_Interview_FYP_Evaluation3_Documentation.docx"
SHOT = "screenshots"

# image-paragraph index -> screenshot file (real matches only)
MAPPING = {
    93:  "12_interview_idle.png",      # 2.11 Interview initiated, first question
    103: "13_interview_listening.png",  # 2.13 Live speech-to-text transcript / answering
    106: "12_interview_idle.png",       # 2.14 Emotion detection over camera feed
    116: "20_report_full.png",          # 2.16 Filler words across full interview (report)
    123: "13_interview_listening.png",  # 2.17 Real-time facial expression during interview
    126: "12_interview_idle.png",       # 2.18 Batched emotion readings during session
    136: "21_report_top.png",           # 2.20 Performance breakdown scores
    139: "20_report_full.png",          # 2.21 Emotion distribution + strengths/improve
    142: "20_report_full.png",          # 2.22 One-click PDF export (Download PDF button)
    204: "12_interview_idle.png",       # 3.6  TC-I1 session started, first question
    207: "14_interview_analyzing.png",  # 3.7  TC-I2 answer submitted, per-answer analysis
    210: "13_interview_listening.png",  # 3.8  TC-I3 emotion batch recorded during session
    213: "20_report_full.png",          # 3.9  TC-I4 report generated after completing
    219: "21_report_top.png",           # 3.10 TC-P1 Confidence & Competency Report scores
}

d = docx.Document(DOC)
paras = d.paragraphs

def set_image(para, path):
    blip = para._p.find(".//" + qn("a:blip"))
    if blip is None:
        return False
    rId, _image = d.part.get_or_add_image(path)
    blip.set(qn("r:embed"), rId)
    return True

done = 0
for idx, fname in MAPPING.items():
    path = os.path.join(SHOT, fname)
    if not os.path.exists(path):
        print("MISSING", fname); continue
    # image may be in idx or the paragraph right before the caption
    target = None
    for back in (0, 1, 2):
        cand = paras[idx - back]
        if cand._p.find(".//" + qn("a:blip")) is not None:
            target = cand; break
    if target is None:
        print("NO IMAGE SLOT for", idx, fname); continue
    if set_image(target, path):
        done += 1
        print(f"OK  para {idx:>3}  {paras[idx].text.strip()[:45]:<47} <- {fname}")

d.save(DOC)
print(f"\nSAVED. {done}/{len(MAPPING)} slots updated with real live screenshots.")

