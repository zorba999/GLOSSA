"""
Documents too long to show the panel whole.

Truncating to the first N characters is the obvious approach and the wrong one:
it tells a translator exactly where they can stop trying. These tests pin the
property that matters — the excerpt reaches the end of the document — by making
the mock refuse to answer any prompt that does not contain the closing
paragraph.
"""

from conftest import deliver_job, mock_panel, open_job, verdict

PARA = (
    "Paragraph {n}. The committee inspects the seal, the rising main and the "
    "apron, then records what it found in the book kept at the pump house so "
    "that the next visit can be compared against this one without relying on "
    "anyone remembering it."
)


def long_document(n=40, marker_first="OPENING-MARKER", marker_last="CLOSING-MARKER"):
    paras = [marker_first + ". " + PARA.format(n=1)]
    for i in range(2, n):
        paras.append(PARA.format(n=i))
    paras.append(marker_last + ". " + PARA.format(n=n))
    return "\n\n".join(paras)


def test_document_exceeds_the_prompt_budget():
    """Guard the premise: if this stops being true the tests below prove nothing."""
    assert len(long_document()) > 5000


def test_excerpt_reaches_the_closing_paragraph(direct_vm, direct_deploy, direct_alice, direct_bob):
    c = direct_deploy("contracts/glossa.py", 60)
    source = long_document()
    delivery = long_document(marker_first="APERTURA", marker_last="CIERRE")

    # Only answers a prompt containing both ends of the document.
    direct_vm.mock_llm(r"(?s).*OPENING-MARKER.*CLOSING-MARKER.*", verdict(score=88))

    job = open_job(direct_vm, c, direct_alice, source=source)
    deliver_job(direct_vm, c, job, direct_bob, delivery=delivery)
    direct_vm.sender = direct_alice
    c.adjudicate(job)

    assert c.get_job(job)["band"] == "PASS"


def test_excerpt_is_numbered_and_flagged_as_partial(direct_vm, direct_deploy, direct_alice, direct_bob):
    """The panel is told which paragraphs it is holding, and that it is not the whole file."""
    c = direct_deploy("contracts/glossa.py", 60)
    direct_vm.mock_llm(
        r"(?s).*too long to show whole.*paragraph 1 of 40.*",
        verdict(score=88),
    )
    job = open_job(direct_vm, c, direct_alice, source=long_document())
    deliver_job(direct_vm, c, job, direct_bob, delivery=long_document(marker_first="A", marker_last="Z"))
    direct_vm.sender = direct_alice
    c.adjudicate(job)
    assert c.get_job(job)["band"] == "PASS"


def test_short_document_is_shown_in_full(direct_vm, direct_deploy, direct_alice, direct_bob):
    c = direct_deploy("contracts/glossa.py", 60)
    direct_vm.mock_llm(r"(?s).*seeing the document in full.*", verdict(score=88))
    job = open_job(direct_vm, c, direct_alice)
    deliver_job(direct_vm, c, job, direct_bob)
    direct_vm.sender = direct_alice
    c.adjudicate(job)
    assert c.get_job(job)["band"] == "PASS"


def test_mechanical_pass_still_covers_the_whole_document(direct_vm, direct_deploy, direct_alice, direct_bob):
    """
    Sampling is only defensible because the deterministic checks are not
    sampled. A figure dropped from the unsampled tail still has to surface.
    """
    import json

    c = direct_deploy("contracts/glossa.py", 60)
    source = long_document() + "\n\nFinal note: call 0800 445 902 before the 5th."
    delivery = long_document(marker_first="APERTURA", marker_last="CIERRE")

    mock_panel(direct_vm, verdict(score=88))
    job = open_job(direct_vm, c, direct_alice, source=source)
    deliver_job(direct_vm, c, job, direct_bob, delivery=delivery)
    direct_vm.sender = direct_alice
    c.adjudicate(job)

    hard = json.loads(c.get_job(job)["hard_report"])
    # "5" is not expected here: the numbered paragraphs mean it occurs in the
    # delivery too, and the check is about figures that genuinely went missing.
    for figure in ("0800", "445", "902"):
        assert figure in hard["missing_numbers"], hard["missing_numbers"]
