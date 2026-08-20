"""
When two honest jurors must be made to disagree.

Direct mode only ever runs the leader, so the validator path cannot be driven
end to end here. What can be driven is the rule the validator applies, which the
contract exposes as preview_agreement — the same function, same arguments.

The case that matters is the last one in this file: two verdicts inside the same
band and two points apart, which the old rule waved through, sending the appeal
bond to opposite parties depending on which juror happened to be leader.
"""

import pytest

THRESHOLD = 80


@pytest.fixture
def contract(direct_deploy, direct_vm, direct_alice):
    direct_vm.sender = direct_alice
    return direct_deploy("contracts/glossa.py", 60)


def agree(
    c,
    leader_score,
    validator_score,
    *,
    leader_mt=0,
    validator_mt=0,
    leader_injection=False,
    validator_injection=False,
    leader_brief=False,
    validator_brief=False,
    is_appeal=False,
    appellant_is_client=True,
    prior_score=0,
    prior_band="",
):
    return c.preview_agreement(
        leader_score, leader_mt, leader_injection, leader_brief,
        validator_score, validator_mt, validator_injection, validator_brief,
        THRESHOLD, is_appeal, appellant_is_client, prior_score, prior_band,
    )


# --- the ordinary case ----------------------------------------------------

def test_close_verdicts_in_one_band_agree(contract):
    assert agree(contract, 88, 84) is True


def test_a_gap_wider_than_the_tolerance_disagrees(contract):
    assert agree(contract, 95, 79) is False


# --- boundaries that change the band --------------------------------------

@pytest.mark.parametrize(
    "leader,validator",
    [
        (80, 79),   # across the buyer's threshold
        (50, 49),   # across the rejection floor
        (65, 64),   # across the repairable margin
    ],
)
def test_one_point_across_a_band_line_disagrees(contract, leader, validator):
    assert agree(contract, leader, validator) is False


def test_machine_translation_cutoff_disagrees(contract):
    """Same score, and only the signature estimate differs — but one is fraud."""
    assert agree(contract, 54, 54, leader_mt=85, validator_mt=84) is False


@pytest.mark.parametrize("flag", ["injection", "brief"])
def test_a_manipulation_flag_seen_by_only_one_juror_disagrees(contract, flag):
    kwargs = {f"leader_{flag}": True} if flag == "brief" else {"leader_injection": True}
    assert agree(contract, 90, 90, **kwargs) is False


# --- the boundary this file exists for ------------------------------------

def test_the_bond_margin_is_agreed_on_too(contract):
    """
    Buyer appealed a PASS at 90. Two jurors land on 84 and 86: same band, two
    points apart, comfortably inside the tolerance — and on opposite sides of
    the five-point margin that decides who keeps the bond.
    """
    ctx = dict(is_appeal=True, appellant_is_client=True, prior_score=90, prior_band="PASS")

    assert contract.preview_appeal_outcome(True, 84, "PASS", 90, "PASS") is True
    assert contract.preview_appeal_outcome(True, 86, "PASS", 90, "PASS") is False

    assert agree(contract, 84, 86, **ctx) is False
    # Off an appeal there is no bond to misdirect, so the same pair is fine.
    assert agree(contract, 84, 86) is True


def test_same_side_of_the_bond_margin_still_agrees(contract):
    ctx = dict(is_appeal=True, appellant_is_client=True, prior_score=90, prior_band="PASS")
    assert agree(contract, 84, 85, **ctx) is True


def test_the_margin_is_agreed_for_a_translator_appellant_too(contract):
    ctx = dict(is_appeal=True, appellant_is_client=False, prior_score=60, prior_band="PARTIAL")
    assert contract.preview_appeal_outcome(False, 65, "PARTIAL", 60, "PARTIAL") is True
    assert contract.preview_appeal_outcome(False, 64, "PARTIAL", 60, "PARTIAL") is False
    assert agree(contract, 65, 64, **ctx) is False
