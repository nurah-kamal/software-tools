"""Builds the sample CVs in this folder. Every person, company and detail is invented.

    python samples/make_samples.py

Each file has one layout problem on purpose (clean.pdf has none), and
tests/test_samples.py checks that ats-check finds exactly that problem.
"""

from io import BytesIO
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

HERE = Path(__file__).parent
W, H = A4

NAME = "Lindiwe Sample"
EMAIL = "lindiwe.sample@example.com"
PHONE = "+27 21 000 0142"
PLACE = "Cape Town"

SUMMARY = [
    "Data analyst with five years in logistics and retail reporting. I turn messy",
    "operational data into weekly reports that managers act on, and I check every",
    "figure against its source before it goes out.",
]
EXPERIENCE = [
    ("Data Analyst, a freight company, Cape Town", "2022 to now", [
        "Built the weekly on-time delivery report in SQL and Power BI.",
        "Cut month-end reconciliation from three days to one.",
        "Trained four colleagues to maintain the reports.",
    ]),
    ("Reporting Assistant, a retail chain, Cape Town", "2019 to 2022", [
        "Produced daily sales and stock reports for 40 stores.",
        "Found and fixed a double-counting fault in returns.",
    ]),
]
EDUCATION = [("BCom Statistics", "2018")]
SKILLS = ["SQL", "Power BI", "Python", "Excel", "Data cleaning", "Reconciliation"]
LANGUAGES = ["English", "isiXhosa", "Afrikaans"]


class Page:
    """A cursor down one page of a reportlab canvas."""

    def __init__(self, c, x=50, y=H - 60, width=W - 100):
        self.c, self.x, self.y, self.width = c, x, y, width

    def text(self, s, size=10, font="Helvetica", gap=4, char_space=0, x=None):
        self.c.setFont(font, size)
        t = self.c.beginText(self.x if x is None else x, self.y)
        t.setFont(font, size)
        t.setCharSpace(char_space)
        t.textLine(s)
        self.c.drawText(t)
        self.y -= size + gap

    def heading(self, s, char_space=0):
        self.y -= 8
        self.text(s, size=12, font="Helvetica-Bold", gap=6, char_space=char_space)

    def body(self, lines):
        for line in lines:
            self.text(line)

    def experience(self):
        for role, when, points in EXPERIENCE:
            self.text(f"{role}   {when}", font="Helvetica-Bold")
            for p in points:
                self.text(f"- {p}", x=self.x + 10)
            self.y -= 4


def standard_body(p, headings):
    p.heading(headings["summary"])
    p.body(SUMMARY)
    p.heading(headings["experience"])
    p.experience()
    p.heading(headings["education"])
    for what, year in EDUCATION:
        p.text(f"{what}, {year}")
    p.heading(headings["skills"])
    p.text(", ".join(SKILLS))
    p.heading(headings["languages"])
    p.text(", ".join(LANGUAGES))


PLAIN = {"summary": "Summary", "experience": "Experience", "education": "Education",
         "skills": "Skills", "languages": "Languages"}


def header(p, char_space=0):
    p.text(NAME, size=20, font="Helvetica-Bold", gap=8, char_space=char_space)
    p.text(f"{EMAIL}  |  {PHONE}  |  {PLACE}")


def clean(c):
    p = Page(c)
    header(p)
    standard_body(p, PLAIN)


def creative_headings(c):
    p = Page(c)
    header(p)
    standard_body(p, {"summary": "Hello there", "experience": "My Journey",
                      "education": "Where I Learnt", "skills": "My Toolbox",
                      "languages": "How I Talk"})


def spaced_headings(c):
    p = Page(c)
    header(p)
    p.heading("SUMMARY", char_space=4)
    p.body(SUMMARY)
    p.heading("EXPERIENCE", char_space=4)
    p.experience()
    p.heading("EDUCATION", char_space=4)
    for what, year in EDUCATION:
        p.text(f"{what}, {year}")
    p.heading("SKILLS", char_space=4)
    p.text(", ".join(SKILLS))


def two_column(c):
    # A sidebar on the left and the main column on the right, with lines at the
    # same height on both sides, the way most designed templates are laid out.
    left = Page(c, x=40, width=150)
    right = Page(c, x=220, width=W - 260)
    right.text(NAME, size=20, font="Helvetica-Bold", gap=8)
    left.y = right.y
    left.heading("Contact")
    for line in (EMAIL, PHONE, PLACE):
        left.text(line, size=9)
    left.heading("Skills")
    for s in SKILLS:
        left.text(s, size=9)
    left.heading("Languages")
    for s in LANGUAGES:
        left.text(s, size=9)
    right.heading("Summary")
    right.body(SUMMARY)
    right.heading("Experience")
    right.experience()
    right.heading("Education")
    for what, year in EDUCATION:
        right.text(f"{what}, {year}")


def rendered(lines, width_px, size=28, pad=12):
    """Text drawn into a picture, as design tools do with a fancy header."""
    font = ImageFont.load_default(size=size)
    height = pad * 2 + len(lines) * (size + 10)
    img = Image.new("RGB", (width_px, height), "white")
    d = ImageDraw.Draw(img)
    for i, line in enumerate(lines):
        d.text((pad, pad + i * (size + 10)), line, fill="black", font=font)
    buf = BytesIO()
    img.save(buf, "PNG")
    buf.seek(0)
    return ImageReader(buf), img.size


def image_header(c):
    pic, (w, h) = rendered([NAME, f"{EMAIL}  |  {PHONE}  |  {PLACE}"], 1400)
    draw_w = W - 100
    draw_h = draw_w * h / w
    c.drawImage(pic, 50, H - 40 - draw_h, draw_w, draw_h)
    p = Page(c, y=H - 60 - draw_h)
    standard_body(p, PLAIN)


def scanned(c):
    # The whole CV as one picture of a page, the way a scan or a photo arrives.
    lines = [NAME, f"{EMAIL} | {PHONE} | {PLACE}", "", "Summary", *SUMMARY, "", "Experience"]
    for role, when, points in EXPERIENCE:
        lines += [f"{role}   {when}", *[f"- {p}" for p in points]]
    lines += ["", "Education", *[f"{a}, {b}" for a, b in EDUCATION], "", "Skills", ", ".join(SKILLS)]
    pic, (w, h) = rendered(lines, 1240, size=22)
    c.drawImage(pic, 30, H - 30 - (W - 60) * h / w, W - 60, (W - 60) * h / w)


SAMPLES = {
    "clean.pdf": clean,
    "two-column.pdf": two_column,
    "creative-headings.pdf": creative_headings,
    "spaced-headings.pdf": spaced_headings,
    "image-header.pdf": image_header,
    "scanned.pdf": scanned,
}


def build(out_dir=HERE):
    for name, draw in SAMPLES.items():
        c = canvas.Canvas(str(out_dir / name), pagesize=A4, invariant=1)
        c.setTitle(f"{NAME} CV")
        c.setAuthor("ats-check samples")
        draw(c)
        c.showPage()
        c.save()


if __name__ == "__main__":
    build()
    print(f"Wrote {len(SAMPLES)} sample CVs to {HERE}")
