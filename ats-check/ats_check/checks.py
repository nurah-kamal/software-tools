"""The checks. Each finding has a code (what the tests look for), how many
points it costs, and a sentence saying what goes wrong and where."""

import re
from dataclasses import asdict, dataclass
from statistics import median

from .reader import column_text, read

SECTIONS = {
    "summary": ["summary", "profile", "professional summary", "personal statement", "objective", "career objective", "about me"],
    "experience": ["experience", "work experience", "professional experience", "employment", "employment history", "work history", "career history"],
    "education": ["education", "qualifications", "academic background", "education and training"],
    "skills": ["skills", "key skills", "technical skills", "core skills", "competencies", "skills and competencies"],
    "languages": ["languages"],
    "certifications": ["certifications", "certificates", "licences", "licenses"],
    "projects": ["projects"],
    "references": ["references"],
    "contact": ["contact", "contact details", "contact information"],
    "achievements": ["achievements", "awards"],
    "interests": ["interests", "hobbies"],
    "volunteering": ["volunteering", "volunteer work", "community work"],
}
CORE = ["experience", "education", "skills"]
LOOKUP = {name: section for section, names in SECTIONS.items() for name in names}

EMAIL = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")
PHONE = re.compile(r"(?:\+27|\b0)[\s-]?\d{2}[\s-]?\d{3}[\s-]?\d{4}\b|\+\d{1,3}[\s-]?\d[\d\s-]{7,12}\d")
SPACED = re.compile(r"^(?:[A-Za-z] ){3,}[A-Za-z]$")


@dataclass
class Finding:
    code: str
    cost: int
    message: str


def normalise(text):
    return re.sub(r"[^a-z ]", "", text.lower()).strip()


def heading_like(line, body_size):
    words = line.text.split()
    if SPACED.match(line.text.strip()):
        return line.bold or line.size > body_size + 1 or line.text.isupper()
    if not words or len(words) > 5 or line.text.rstrip().endswith((".", ",")):
        return False
    return line.bold or line.size > body_size + 1 or (line.text.isupper() and len(line.text) > 3)


def check(path):
    pages = read(path)
    findings = []
    text_pages = [p for p in pages if p.char_count >= 50]

    # Text that is a picture.
    for p in pages:
        page_area = p.width * p.height
        for img in p.images:
            area = (img["x1"] - img["x0"]) * (img["bottom"] - img["top"])
            if p.char_count < 50:
                findings.append(Finding("no-text-layer", 100, f"Page {p.number} is a picture with no text behind it, like a scan or a photo. A parser reads nothing from it."))
                break
            if area > 0.02 * page_area and (img["x1"] - img["x0"]) > 0.3 * p.width:
                where = "at the top of" if img["top"] < p.height * 0.25 else "on"
                findings.append(Finding("image-may-hide-text", 10, f"A picture {where} page {p.number} ({round(img['x1'] - img['x0'])} by {round(img['bottom'] - img['top'])} points) is big enough to hold text. Anything written in it is invisible to a parser."))

    if not text_pages:
        return pages, findings, ""

    naive = "\n".join(p.naive_text for p in pages)
    ordered = "\n".join(column_text(p) for p in pages)

    # Reading order.
    for p in pages:
        if p.gutter is None:
            continue
        mixed = [r for r in p.row_lines if any(w["x1"] <= p.gutter[0] for w in r.words) and any(w["x0"] >= p.gutter[1] for w in r.words)]
        example = mixed[0].text if mixed else ""
        findings.append(Finding("interleaved-columns", 20, f"Page {p.number} has two columns. Read line by line, {len(mixed)} lines mix text from both, for example: \"{example}\"."))
        for label, pattern in (("email address", EMAIL), ("phone number", PHONE)):
            hit = next((r.text for r in mixed if pattern.search(r.text)), None)
            if hit:
                findings.append(Finding("contact-shares-line", 5, f"The {label} shares a line with text from the other column: \"{hit}\"."))

    # Section headings.
    found = {}
    body_size = median(w["size"] for p in text_pages for w in p.words)
    for p in text_pages:
        for line in p.lines:
            if not heading_like(line, body_size):
                continue
            raw = line.text.strip()
            if SPACED.match(raw):
                joined = raw.replace(" ", "")
                section = LOOKUP.get(normalise(joined))
                findings.append(Finding("spaced-heading", 5, f"The heading \"{joined}\" is letter-spaced, so a parser reads it as \"{raw}\"{' and does not recognise it' if section else ''}."))
                continue
            section = LOOKUP.get(normalise(raw))
            if section:
                found.setdefault(section, raw)
            elif line.size >= body_size + 1 or line.bold:
                if not (EMAIL.search(raw) or PHONE.search(raw)) and line is not p.lines[0] and not re.search(r"\d{4}", raw):
                    findings.append(Finding("unrecognised-heading", 5, f"\"{raw}\" looks like a heading but is not a section name a parser knows."))
    for section in CORE:
        if section not in found:
            findings.append(Finding(f"missing-section:{section}", 10, f"No heading a parser would read as {section.title()}."))

    # Contact details.
    if not EMAIL.search(ordered):
        findings.append(Finding("no-email", 15, "No email address in the text."))
    if not PHONE.search(ordered):
        findings.append(Finding("no-phone", 10, "No phone number in the text."))

    findings = cap(findings, "unrecognised-heading", 15)
    findings = cap(findings, "spaced-heading", 10)
    return pages, findings, ordered


def cap(findings, code, most):
    spent = 0
    out = []
    for f in findings:
        if f.code == code:
            f = Finding(f.code, max(0, min(f.cost, most - spent)), f.message)
            spent += f.cost
        out.append(f)
    return out


def report(path):
    pages, findings, ordered = check(path)
    score = max(0, 100 - sum(f.cost for f in findings))
    email = EMAIL.search(ordered)
    phone = PHONE.search(ordered)
    sections = sorted({LOOKUP[normalise(line.text)] for p in pages for line in p.lines if normalise(line.text) in LOOKUP})
    return {
        "file": str(path),
        "score": score,
        "pages": len(pages),
        "columns": max((2 if p.gutter else 1) for p in pages),
        "sections": sections,
        "contact": {"email": email.group(0) if email else None, "phone": phone.group(0) if phone else None},
        "findings": [asdict(f) for f in findings],
        "naive_text": "\n".join(p.naive_text for p in pages),
        "column_text": ordered,
    }
