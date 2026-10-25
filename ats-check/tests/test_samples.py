from pathlib import Path

import pytest

from ats_check.checks import report

SAMPLES = Path(__file__).parent.parent / "samples"


def codes(name):
    return sorted({f["code"] for f in report(SAMPLES / name)["findings"]})


# Each sample has exactly the problems it was built with, and nothing else.
EXPECTED = {
    "clean.pdf": [],
    "two-column.pdf": ["contact-shares-line", "interleaved-columns"],
    "creative-headings.pdf": ["missing-section:education", "missing-section:experience", "missing-section:skills", "unrecognised-heading"],
    "spaced-headings.pdf": ["missing-section:education", "missing-section:experience", "missing-section:skills", "spaced-heading"],
    "image-header.pdf": ["image-may-hide-text", "no-email", "no-phone"],
    "scanned.pdf": ["no-text-layer"],
}


@pytest.mark.parametrize("name", EXPECTED)
def test_expected_findings(name):
    assert codes(name) == EXPECTED[name]


def test_every_sample_is_tested():
    assert sorted(p.name for p in SAMPLES.glob("*.pdf")) == sorted(EXPECTED)


def test_clean_cv_scores_full_marks_and_reads_everything():
    r = report(SAMPLES / "clean.pdf")
    assert r["score"] == 100
    assert r["columns"] == 1
    assert r["contact"] == {"email": "lindiwe.sample@example.com", "phone": "+27 21 000 0142"}
    assert r["sections"] == ["education", "experience", "languages", "skills", "summary"]
    assert r["naive_text"].splitlines()[0] == "Lindiwe Sample"


def test_two_columns_read_in_order_once_split():
    r = report(SAMPLES / "two-column.pdf")
    assert r["columns"] == 2
    naive = r["naive_text"].splitlines()
    assert "+27 21 000 0142 operational data into weekly reports that managers act on, and I check every" in naive
    ordered = r["column_text"].splitlines()
    assert ordered[0] == "Lindiwe Sample"
    assert ordered.index("+27 21 000 0142") < ordered.index("Skills") < ordered.index("Summary")
    assert "Data analyst with five years in logistics and retail reporting. I turn messy" in ordered


def test_spaced_heading_shows_what_the_parser_reads():
    messages = [f["message"] for f in report(SAMPLES / "spaced-headings.pdf")["findings"]]
    assert any('reads it as "E X P E R I E N C E"' in m for m in messages)


def test_scores():
    scores = {name: report(SAMPLES / name)["score"] for name in EXPECTED}
    assert scores == {
        "clean.pdf": 100,
        "two-column.pdf": 70,
        "creative-headings.pdf": 55,
        "spaced-headings.pdf": 60,
        "image-header.pdf": 65,
        "scanned.pdf": 0,
    }


def test_repeated_findings_are_capped():
    findings = report(SAMPLES / "creative-headings.pdf")["findings"]
    assert sum(f["cost"] for f in findings if f["code"] == "unrecognised-heading") == 15
    assert len([f for f in findings if f["code"] == "unrecognised-heading"]) == 5


def test_committed_samples_match_the_generator(tmp_path):
    import sys
    sys.path.insert(0, str(SAMPLES))
    from make_samples import SAMPLES as BUILT, build
    build(tmp_path)
    for name in BUILT:
        assert (tmp_path / name).read_bytes() == (SAMPLES / name).read_bytes(), name
