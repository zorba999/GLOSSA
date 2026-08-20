"""
The appeal interval, and the verdict it has to preserve.

Two things were wrong before. Release could be called the instant a verdict
landed, so the window existed only in the documentation — a translator could
adjudicate and release in the same breath and the buyer never got a turn. And
the bond was settled by comparing the second verdict against job.score, which
adjudicate had already overwritten with that same verdict, so an appellant was
essentially incapable of winning.
"""

import pytest

from conftest import BOND, GEN, PRICE, STAKE, judged_job, mock_panel, verdict

WINDOW = 3600


def test_release_is_refused_while_the_window_is_open(direct_vm, direct_deploy, direct_alice, direct_bob):
    c = direct_deploy("contracts/glossa.py", WINDOW)
    job = judged_job(direct_vm, c, direct_alice, direct_bob, verdict(score=90))

    assert c.get_job(job)["status"] == "JUDGED"
    assert int(c.get_job(job)["appeal_seconds_left"]) > 0

    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("appeal window is still open"):
        c.release(job)

    assert c.get_job(job)["status"] == "JUDGED"


def test_release_works_when_no_interval_is_configured(direct_vm, direct_deploy, direct_alice, direct_bob):
    """
    A zero window is the same thing as an elapsed one, and it is the only way to
    reach that branch here: gltest freezes the message datetime at contract load,
    so warp() cannot move the contract's clock. Whether real elapsed time opens
    the gate is asserted in scripts/test-onchain.mjs, where time actually passes.
    """
    c = direct_deploy("contracts/glossa.py", 0)
    job = judged_job(direct_vm, c, direct_alice, direct_bob, verdict(score=90))

    assert int(c.get_job(job)["appeal_seconds_left"]) == 0
    direct_vm.sender = direct_bob
    c.release(job)

    j = c.get_job(job)
    assert j["status"] == "SETTLED"
    assert int(j["paid_translator"]) == PRICE + STAKE


def test_both_parties_can_waive_the_wait(direct_vm, direct_deploy, direct_alice, direct_bob):
    """Nobody should sit out an interval that exists to protect them."""
    c = direct_deploy("contracts/glossa.py", WINDOW)
    job = judged_job(direct_vm, c, direct_alice, direct_bob, verdict(score=90))

    direct_vm.sender = direct_alice
    c.waive_appeal(job)

    # One side alone is not enough.
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("appeal window is still open"):
        c.release(job)

    direct_vm.sender = direct_bob
    c.waive_appeal(job)
    c.release(job)

    assert c.get_job(job)["status"] == "SETTLED"


def test_outsiders_cannot_waive(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    c = direct_deploy("contracts/glossa.py", WINDOW)
    job = judged_job(direct_vm, c, direct_alice, direct_bob, verdict(score=90))

    direct_vm.sender = direct_charlie
    with direct_vm.expect_revert("only the two parties may waive"):
        c.waive_appeal(job)


def test_appeal_is_refused_once_the_window_has_closed(direct_vm, direct_deploy, direct_alice, direct_bob):
    c = direct_deploy("contracts/glossa.py", 0)
    job = judged_job(direct_vm, c, direct_alice, direct_bob, verdict(score=30))

    direct_vm.sender = direct_bob
    direct_vm.value = BOND
    with direct_vm.expect_revert("appeal window has closed"):
        c.appeal(job)
    direct_vm.value = 0


def test_the_appealed_verdict_survives_the_second_round(direct_vm, direct_deploy, direct_alice, direct_bob):
    c = direct_deploy("contracts/glossa.py", WINDOW)
    job = judged_job(direct_vm, c, direct_alice, direct_bob, verdict(score=90))
    assert c.get_job(job)["band"] == "PASS"

    direct_vm.sender = direct_alice
    direct_vm.value = BOND
    c.appeal(job)
    direct_vm.value = 0

    mock_panel(direct_vm, verdict(score=30))
    direct_vm.sender = direct_alice
    c.adjudicate(job)

    j = c.get_job(job)
    assert int(j["round"]) == 2
    assert int(j["score"]) == 30 and j["band"] == "FAIL"
    # The record of the verdict actually under challenge is still there.
    assert int(j["appealed_score"]) == 90
    assert j["appealed_band"] == "PASS"


def test_a_successful_appeal_returns_the_bond_to_the_appellant(direct_vm, direct_deploy, direct_alice, direct_bob):
    c = direct_deploy("contracts/glossa.py", WINDOW)
    job = judged_job(direct_vm, c, direct_alice, direct_bob, verdict(score=90))

    direct_vm.sender = direct_alice
    direct_vm.value = BOND
    c.appeal(job)
    direct_vm.value = 0

    mock_panel(direct_vm, verdict(score=30))
    direct_vm.sender = direct_alice
    c.adjudicate(job)

    j = c.get_job(job)
    assert j["status"] == "SETTLED"          # the appeal was the last word
    assert int(j["paid_client"]) >= BOND     # buyer was right, bond comes back
    assert int(j["paid_translator"]) + int(j["paid_client"]) == PRICE + STAKE + BOND


def test_a_failed_appeal_hands_the_bond_to_the_other_side(direct_vm, direct_deploy, direct_alice, direct_bob):
    c = direct_deploy("contracts/glossa.py", WINDOW)
    job = judged_job(direct_vm, c, direct_alice, direct_bob, verdict(score=90))

    direct_vm.sender = direct_alice
    direct_vm.value = BOND
    c.appeal(job)
    direct_vm.value = 0

    mock_panel(direct_vm, verdict(score=92))   # second panel agrees with the first
    direct_vm.sender = direct_alice
    c.adjudicate(job)

    j = c.get_job(job)
    assert int(j["appealed_score"]) == 90
    assert int(j["paid_translator"]) == PRICE + STAKE + BOND
    assert int(j["paid_client"]) == 0
