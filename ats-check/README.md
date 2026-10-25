# ats-check

**Shows what an applicant tracking system actually reads from a CV PDF, and what it misses. It reads the text the way many parsers do, line by line across the page, then says what went wrong and where, with a score out of 100.**

A two-column CV, read line by line:

```
$ python -m ats_check samples/two-column.pdf --text
samples/two-column.pdf
  Score: 70/100
  Pages: 1   Columns: 2
  Sections found: contact, education, experience, languages, skills, summary
  Email: lindiwe.sample@example.com   Phone: +27 21 000 0142
  What goes wrong:
     -20  Page 1 has two columns. Read line by line, 8 lines mix text from both, for example: "Contact Summary".
      -5  The email address shares a line with text from the other column: "lindiwe.sample@example.com Data analyst with five years in logistics and retail reporting. I turn messy".
      -5  The phone number shares a line with text from the other column: "+27 21 000 0142 operational data into weekly reports that managers act on, and I check every".

  What a parser reads, line by line across the page:

    Lindiwe Sample
    Contact Summary
    lindiwe.sample@example.com Data analyst with five years in logistics and retail reporting. I turn messy
    +27 21 000 0142 operational data into weekly reports that managers act on, and I check every
    Cape Town figure against its source before it goes out.
    Skills Experience
    SQL Data Analyst, a freight company, Cape Town 2022 to now
    ...
    Reconciliation Reporting Assistant, a retail chain, Cape Town 2019 to 2022
```

The skill "Reconciliation" in the sidebar has fused with the job title next to it, and the town has run into the summary. A person sees two neat columns, but a parser that reads across the page doesn't.

## What it shows

| Check | What it looks for |
| --- | --- |
| **Reading order** | Finds a gutter between columns: an empty vertical strip with text on both sides on at least three lines. It counts the lines where a line-by-line read mixes the two columns, and prints the page in column order beside the naive order. |
| **Section headings** | Finds lines that look like headings (bold, larger than the body text, or in capitals) and checks them against the names parsers know: Experience, Work History, Education, Qualifications, Skills and so on. It flags creative headings ("My Journey") and the core sections that end up missing. |
| **Letter-spaced headings** | `E X P E R I E N C E` looks like a heading to a person, but a parser sees ten one-letter words. |
| **Text in pictures** | A page with pictures and no text behind it (a scan or a photo), and any picture big enough to hold a line of text, such as a designed header with the name and contact details in it. |
| **Contact details** | An email address and a phone number (South African and international formats) in the text layer, and whether either one shares a line with the other column. |
| **Score** | 100 minus the cost of each finding, with every cost listed. Repeats are capped, so five creative headings don't count five times over. |

## The sample CVs

Six one-page CVs for one invented person, each built with a single problem (the clean one has none). `samples/make_samples.py` makes them, and the tests check that each one gets exactly its own findings and nothing else.

| Sample | Built with | Score | Findings |
| --- | --- | ---: | --- |
| `clean.pdf` | One column, plain headings, contact details as text | 100 | None |
| `two-column.pdf` | A sidebar for contact, skills and languages | 70 | Columns interleave on 8 lines; email and phone each share a line with the summary |
| `spaced-headings.pdf` | Headings in letter-spaced capitals | 60 | Four letter-spaced headings, so Experience, Education and Skills go unrecognised |
| `image-header.pdf` | Name, email and phone drawn as a picture | 65 | A picture at the top big enough to hold text; no email or phone in the text |
| `creative-headings.pdf` | "My Journey", "Where I Learnt", "My Toolbox" | 55 | Five headings no parser knows, so the three core sections are missing |
| `scanned.pdf` | The whole page as one picture | 0 | No text layer: a parser reads nothing |

These scores come from `python -m ats_check samples/*.pdf`, and `tests/test_samples.py` checks the same figures.

## The part worth copying

- **Show the reading, not just a verdict.** `--text` prints exactly what a line-by-line parser gets, so the problem shows itself: "Reconciliation Reporting Assistant" convinces more than "your layout has two columns".
- **Each sample has one fault.** Every test sample is built with exactly one problem, and the tests check it gets that finding and no others. A false alarm on the clean CV fails as surely as a missed problem.
- **The samples are built, not collected.** The PDFs come from a script with a fixed output, and a test fails if the committed files drift from what it makes. Nobody's real CV is in the repository.
- **Every point is accounted for.** The score is 100 minus a listed cost per finding, so a reader can see why a CV got 60, and which fix earns back the most.

## How it is built

| | |
| --- | --- |
| **Reading** | [pdfplumber](https://github.com/jsvine/pdfplumber) gives every word with its position, font and size, plus the pictures on each page. `extract_text()` is the naive, line-by-line reading. |
| **Columns** | `ats_check/reader.py` marks which horizontal points any word covers and takes the widest uncovered strip away from the margins. It counts as a gutter only if at least three lines have text on both sides of it. Lines are then split at the gutter for the column-order reading. |
| **Checks** | `ats_check/checks.py`. Each finding is a code, a cost and a sentence. The tests match on the codes. |
| **Command line** | `python -m ats_check cv.pdf [more.pdf] [--text] [--json]`. `--json` gives the score, sections, contact details, findings and both readings for use elsewhere. |
| **Samples** | `samples/make_samples.py` draws the CVs with reportlab, and the picture-of-text parts with Pillow. |
| **Tests** | 30 pytest tests: each sample's findings and score, the column-order reading, phone, email and heading rules, and the samples matching their generator. |
| **CI** | `.github/workflows/ats-check.yml` in the repository root runs the tests on Python 3.12 whenever this folder changes. Actions are pinned to exact commits. |

## Try it on your own machine

Python 3.12.

```bash
python -m venv .venv
.venv/Scripts/activate        # on macOS or Linux: source .venv/bin/activate
pip install -r requirements-dev.txt
python -m ats_check samples/*.pdf
python -m pytest
```

To check your own CV: `python -m ats_check path/to/cv.pdf --text`. Only pdfplumber is needed for that (`requirements.txt`). Nothing leaves your machine.

## Things worth knowing

**Parsers differ.** Some read in column order, some line by line, and some run OCR on pictures. This tool shows the line-by-line case because it is common and is the one that hurts. A clean result here doesn't guarantee every system reads the CV well; a bad one means at least some won't.

**It can't see inside pictures.** It flags a picture big enough to hold text, because without OCR it can't tell a logo from a header full of contact details. It doesn't guess which one it is; the missing email and phone are what confirm it.

**Headings are matched by name.** The list of section names is in `ats_check/checks.py`. Unusual but legitimate headings, such as "Publications", may be flagged as unrecognised. Add them to the list if they matter in your field.

**The idea comes from CV work I do professionally.** It was rebuilt from scratch on invented samples, and no work code, data or CV is in this folder.

## Folders

```
ats_check/reader.py         words, lines, pictures and the column gutter, from pdfplumber
ats_check/checks.py         the checks, their costs and the report
ats_check/__main__.py       the command line
samples/make_samples.py     builds the six sample CVs
samples/*.pdf               the sample CVs (one invented person)
tests/                      findings per sample, scores, rules, generator match
```

## Licence

MIT, in the [repository root](../LICENSE).
