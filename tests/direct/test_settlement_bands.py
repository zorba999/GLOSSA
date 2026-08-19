"""
Every boundary at which a verdict becomes a different payout.

These are the cases the equivalence rule has to make validators agree on, so
they are also the cases worth pinning down: a change to _derive_band that moves
any of these lines is a change to who gets paid.
"""

import pytest

from conftest import PRICE, STAKE, judged_job, verdict

THRESHOLD = 80


@pytest.mark.parametrize(
    "score,expected",
    [
        (100, "PASS"),
        (80, "PASS"),       # exactly at the buyer's threshold
        (79, "REVISE"),     # one point under
        (65, "REVISE"),     # threshold - 15, the last repairable score
        (64, "PARTIAL"),    # threshold - 16, no longer repairable
        (50, "PARTIAL"),    # the rejection floor itself
        (49, "FAIL"),       # one point under the floor
        (0, "FAIL"),
    ],
)
def test_score_boundaries(direct_vm, direct_deploy, direct_alice, direct_bob, score, expected):
    c = direct_deploy("contracts/glossa.py", 60)
    job = judged_job(direct_vm, c, direct_alice, direct_bob, verdict(score=score), threshold=THRESHOLD)
    assert c.get_job(job)["band"] == expected


@pytest.mark.parametrize(
    "mt,score,expected",
    [
        (85, 54, "FRAUD"),   # machine output dressed up as work
        (84, 54, "PARTIAL"),  # just under the signature line
        (85, 55, "PARTIAL"),  # strong signature but the work still stands up
        (100, 20, "FRAUD"),
    ],
)
def test_machine_translation_boundary(direct_vm, direct_deploy, direct_alice, direct_bob, mt, score, expected):
    c = direct_deploy("contracts/glossa.py", 60)
    job = judged_job(direct_vm, c, direct_alice, direct_bob, verdict(score=score, mt=mt), threshold=THRESHOLD)
    assert c.get_job(job)["band"] == expected


def test_injection_outranks_a_high_score(direct_vm, direct_deploy, direct_alice, direct_bob):
    c = direct_deploy("contracts/glossa.py", 60)
    job = judged_job(direct_vm, c, direct_alice, direct_bob, verdict(score=99, injection=True))
    j = c.get_job(job)
    assert j["band"] == "FRAUD"
    assert int(j["paid_translator"]) == 0
    assert int(j["paid_client"]) == PRICE + STAKE


@pytest.mark.parametrize(
    "band_score,to_translator,to_client",
    [
        (90, PRICE + STAKE, 0),                                  # PASS
        (60, (PRICE * 60) // 100 + STAKE, PRICE - (PRICE * 60) // 100),  # PARTIAL
        (20, STAKE // 2, PRICE + (STAKE - STAKE // 2)),          # FAIL
    ],
)
def test_payout_split_per_band(direct_vm, direct_deploy, direct_alice, direct_bob, band_score, to_translator, to_client):
    c = direct_deploy("contracts/glossa.py", 60)
    job = judged_job(direct_vm, c, direct_alice, direct_bob, verdict(score=band_score), threshold=THRESHOLD)
    j = c.get_job(job)
    assert int(j["paid_translator"]) == to_translator
    assert int(j["paid_client"]) == to_client
    # Nothing minted, nothing stranded.
    assert int(j["paid_translator"]) + int(j["paid_client"]) == PRICE + STAKE


def test_revise_loops_back_instead_of_paying(direct_vm, direct_deploy, direct_alice, direct_bob):
    c = direct_deploy("contracts/glossa.py", 60)
    job = judged_job(direct_vm, c, direct_alice, direct_bob, verdict(score=70), threshold=THRESHOLD)
    j = c.get_job(job)
    assert j["band"] == "REVISE"
    assert j["status"] == "REVISION"
    assert int(j["revisions_left"]) == 0
    assert int(j["paid_translator"]) == 0 and int(j["paid_client"]) == 0


def test_confirmed_omissions_cap_the_score(direct_vm, direct_deploy, direct_alice, direct_bob):
    """A panel cannot wave through a delivery it has just said drops content."""
    c = direct_deploy("contracts/glossa.py", 60)
    job = judged_job(
        direct_vm, c, direct_alice, direct_bob,
        verdict(score=95, omissions=["250 ml", "the referral paragraph"]),
        threshold=THRESHOLD,
    )
    j = c.get_job(job)
    assert int(j["score"]) == 75
    assert j["band"] == "REVISE"
