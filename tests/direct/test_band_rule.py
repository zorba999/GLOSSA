"""
The settlement rule on its own, swept across its whole input space.

test_settlement_bands.py drives these boundaries through a real adjudication,
which is the honest end-to-end check but costs a panel run per case. This sweeps
the rule directly, so a change that moves any line — the threshold, the
rejection floor, the repairable margin, the machine-translation cut-off, either
injection flag — fails here first and loudly.
"""

import pytest


@pytest.fixture
def contract(direct_deploy, direct_vm, direct_alice):
    direct_vm.sender = direct_alice
    return direct_deploy("contracts/glossa.py", 60)


def band(contract, score, threshold=80, injection=False, mt=0, brief=False):
    return contract.preview_band(score, threshold, injection, mt, brief)


@pytest.mark.parametrize("threshold", [50, 65, 80, 95])
def test_threshold_is_inclusive_at_every_setting(contract, threshold):
    assert band(contract, threshold, threshold) == "PASS"
    if threshold > 50:
        assert band(contract, threshold - 1, threshold) != "PASS"


@pytest.mark.parametrize("threshold", [65, 80, 95])
def test_repairable_margin_is_fifteen_points(contract, threshold):
    assert band(contract, threshold - 15, threshold) == "REVISE"
    below = band(contract, threshold - 16, threshold)
    assert below in ("PARTIAL", "FAIL")


def test_rejection_floor_sits_at_fifty(contract):
    assert band(contract, 50) == "PARTIAL"
    assert band(contract, 49) == "FAIL"


def test_no_gap_or_overlap_across_the_whole_range(contract):
    """Every score maps to exactly one band, and the bands only move one way."""
    order = ["FAIL", "PARTIAL", "REVISE", "PASS"]
    seen = [band(contract, s) for s in range(0, 101)]
    assert set(seen) <= set(order)
    ranks = [order.index(b) for b in seen]
    assert ranks == sorted(ranks), "a higher score must never settle worse"


@pytest.mark.parametrize("score", [0, 54])
def test_machine_translation_is_fraud_only_below_fiftyfive(contract, score):
    assert band(contract, score, mt=85) == "FRAUD"
    assert band(contract, score, mt=84) != "FRAUD"


@pytest.mark.parametrize("score", [55, 80, 100])
def test_strong_signature_does_not_condemn_work_that_stands_up(contract, score):
    assert band(contract, score, mt=100) != "FRAUD"


@pytest.mark.parametrize("score", [0, 50, 99, 100])
def test_delivery_injection_is_fraud_at_any_score(contract, score):
    assert band(contract, score, injection=True) == "FRAUD"


@pytest.mark.parametrize("score", [0, 50, 100])
def test_brief_injection_outranks_everything(contract, score):
    assert band(contract, score, brief=True) == "BAD_BRIEF"
    assert band(contract, score, injection=True, mt=100, brief=True) == "BAD_BRIEF"
