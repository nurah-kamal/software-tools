"""What a parser gets out of a PDF: words with positions, the text in naive
reading order, and the pictures on each page."""

from dataclasses import dataclass, field
from statistics import median

import pdfplumber

LINE_TOLERANCE = 3   # points: words this close vertically are on one line
GUTTER_MIN = 12      # points: the narrowest empty strip counted as a gap between columns


@dataclass
class Line:
    words: list
    top: float

    @property
    def text(self):
        return " ".join(w["text"] for w in self.words)

    @property
    def x0(self):
        return min(w["x0"] for w in self.words)

    @property
    def size(self):
        return max(w["size"] for w in self.words)

    @property
    def bold(self):
        return all("bold" in w["fontname"].lower() for w in self.words)


@dataclass
class Page:
    number: int
    width: float
    height: float
    naive_text: str
    words: list
    images: list
    char_count: int
    gutter: tuple | None = None
    lines: list = field(default_factory=list)       # visual lines, split at the gutter
    row_lines: list = field(default_factory=list)   # whole rows across the page

    @property
    def body_size(self):
        return median(w["size"] for w in self.words) if self.words else 0


def group_lines(words):
    lines = []
    for w in sorted(words, key=lambda w: (round(w["top"]), w["x0"])):
        if lines and abs(lines[-1].top - w["top"]) <= LINE_TOLERANCE:
            lines[-1].words.append(w)
        else:
            lines.append(Line([w], w["top"]))
    for line in lines:
        line.words.sort(key=lambda w: w["x0"])
    return lines


def find_gutter(words, width):
    """The widest strip of the page no word crosses, away from the margins,
    with text on both sides of it on at least three lines."""
    if not words:
        return None
    left = min(w["x0"] for w in words)
    right = max(w["x1"] for w in words)
    covered = [False] * (int(width) + 2)
    for w in words:
        for x in range(int(w["x0"]), int(w["x1"]) + 1):
            covered[x] = True
    best = None
    start = None
    for x in range(int(left) + 40, int(right) - 40):
        if not covered[x] and start is None:
            start = x
        if (covered[x] or x == int(right) - 41) and start is not None:
            if x - start >= GUTTER_MIN and (best is None or x - start > best[1] - best[0]):
                best = (start, x)
            start = None
    if best is None:
        return None
    rows = group_lines(words)
    both = sum(1 for r in rows if r.x0 < best[0] and any(w["x0"] >= best[1] for w in r.words))
    return best if both >= 3 else None


def split_at(lines, gutter):
    if gutter is None:
        return lines
    out = []
    for line in lines:
        left = [w for w in line.words if w["x1"] <= gutter[0]]
        right = [w for w in line.words if w["x0"] >= gutter[1]]
        out += [Line(part, line.top) for part in (left, right) if part]
    return out


def read(path):
    pages = []
    with pdfplumber.open(path) as pdf:
        for i, p in enumerate(pdf.pages, start=1):
            words = p.extract_words(extra_attrs=["fontname", "size"], keep_blank_chars=False, use_text_flow=False)
            page = Page(
                number=i,
                width=float(p.width),
                height=float(p.height),
                naive_text=p.extract_text() or "",
                words=words,
                images=[{k: float(img[k]) for k in ("x0", "x1", "top", "bottom")} for img in p.images],
                char_count=len(p.chars),
            )
            page.gutter = find_gutter(words, page.width)
            page.row_lines = group_lines(words)
            page.lines = split_at(page.row_lines, page.gutter)
            pages.append(page)
    return pages


def column_text(page):
    """The page read one column at a time, the order a person reads it."""
    if page.gutter is None:
        return "\n".join(line.text for line in page.lines)
    # Anything above the point where the columns start (usually the name) comes first.
    split_rows = [r.top for r in page.row_lines if len(split_at([r], page.gutter)) == 2]
    start = min(split_rows) - LINE_TOLERANCE if split_rows else 0
    above = [line for line in page.lines if line.top < start]
    rest = [line for line in page.lines if line.top >= start]
    left = [line for line in rest if line.x0 < page.gutter[0]]
    right = [line for line in rest if line.x0 >= page.gutter[1]]
    return "\n".join(line.text for line in above + left + right)
