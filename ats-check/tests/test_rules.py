import pytest

from ats_check.checks import EMAIL, LOOKUP, PHONE, SPACED, normalise


@pytest.mark.parametrize("text", ["+27 21 000 0142", "021 000 0142", "082-000-0142", "+44 20 7946 0000"])
def test_phone_numbers_found(text):
    assert PHONE.search(text)


@pytest.mark.parametrize("text", ["2019 to 2022", "40 stores", "BCom Statistics, 2018"])
def test_years_and_counts_are_not_phone_numbers(text):
    assert not PHONE.search(text)


def test_email():
    assert EMAIL.search("write to a.b+cv@mail.example.com today").group(0) == "a.b+cv@mail.example.com"


@pytest.mark.parametrize("heading,section", [
    ("Work Experience", "experience"), ("EMPLOYMENT HISTORY", "experience"),
    ("Qualifications", "education"), ("Key Skills:", "skills"), ("Profile", "summary"),
])
def test_common_headings_recognised(heading, section):
    assert LOOKUP[normalise(heading)] == section


@pytest.mark.parametrize("heading", ["My Journey", "Toolbox", "Where I Learnt"])
def test_creative_headings_not_recognised(heading):
    assert normalise(heading) not in LOOKUP


def test_spaced_letters():
    assert SPACED.match("E X P E R I E N C E")
    assert not SPACED.match("I am a data analyst")
