"""
A revision is not an appeal, and the contract used to treat it as one.

Because the appeal logic keyed off the adjudication count, a REVISE verdict
consumed round one and the repaired delivery's verdict then landed on round two
— which meant it was disbursed on the spot, with no interval and no appeal left
to file. The party who had just lost a re-judged job had no recourse at all.
"""

from conftest import BOND, PRICE, STAKE, as_hex, judged_job, mock_panel, verdict

WINDOW = 3600
THRESHOLD = 80


def revised_job(vm, c, buyer, translator, second_verdict):
    """Drive a job through REVISE, a repair, and a second adjudication."""
    job = judged_job(vm, c, buyer, translator, verdict(score=70), threshold=THRESHOLD)
    assert c.get_job(job)["status"] == "REVISION"

    vm.sender = translator
    c.deliver(job, "Una entrega revisada, con las correcciones que el panel pidio.")

    mock_panel(vm, second_verdict)
    vm.sender = buyer
    c.adjudicate(job)
    return job


def test_a_revised_delivery_gets_its_own_interval(direct_vm, direct_deploy, direct_alice, direct_bob):
    c = direct_deploy("contracts/glossa.py", WINDOW)
    job = revised_job(direct_vm, c, direct_alice, direct_bob, verdict(score=90))

    j = c.get_job(job)
    assert int(j["round"]) == 2
    assert j["band"] == "PASS"
    # The money is provisional, exactly as it would be on a first verdict.
    assert j["status"] == "JUDGED", "a repaired delivery was settled without a window"
    assert int(j["appeal_seconds_left"]) > 0


def test_release_is_still_gated_after_a_revision(direct_vm, direct_deploy, direct_alice, direct_bob):
    c = direct_deploy("contracts/glossa.py", WINDOW)
    job = revised_job(direct_vm, c, direct_alice, direct_bob, verdict(score=90))

    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("appeal window is still open"):
        c.release(job)


def test_the_appeal_survives_a_revision(direct_vm, direct_deploy, direct_alice, direct_bob):
    c = direct_deploy("contracts/glossa.py", WINDOW)
    job = revised_job(direct_vm, c, direct_alice, direct_bob, verdict(score=90))

    direct_vm.sender = direct_alice
    direct_vm.value = BOND
    c.appeal(job)
    direct_vm.value = 0

    j = c.get_job(job)
    assert j["status"] == "DELIVERED"
    assert j["appellant"].lower() == as_hex(direct_alice)


def test_the_bond_is_measured_against_the_verdict_that_was_appealed(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    """
    Not against round one. Round one here was a REVISE at 70 — a repair notice,
    never a settlement. The buyer is appealing the PASS at 90 that followed it.
    """
    c = direct_deploy("contracts/glossa.py", WINDOW)
    job = revised_job(direct_vm, c, direct_alice, direct_bob, verdict(score=90))

    direct_vm.sender = direct_alice
    direct_vm.value = BOND
    c.appeal(job)
    direct_vm.value = 0

    j = c.get_job(job)
    assert int(j["appealed_score"]) == 90
    assert j["appealed_band"] == "PASS"

    mock_panel(direct_vm, verdict(score=30))
    direct_vm.sender = direct_alice
    c.adjudicate(job)

    j = c.get_job(job)
    assert int(j["round"]) == 3
    assert j["status"] == "SETTLED", "the appeal round should settle at once"
    # 30 against the appealed 90: the buyer was right, so the bond returns.
    assert int(j["paid_client"]) >= BOND
    assert int(j["paid_translator"]) + int(j["paid_client"]) == PRICE + STAKE + BOND


def test_only_one_revision_is_offered(direct_vm, direct_deploy, direct_alice, direct_bob):
    c = direct_deploy("contracts/glossa.py", WINDOW)
    job = revised_job(direct_vm, c, direct_alice, direct_bob, verdict(score=70))

    j = c.get_job(job)
    assert int(j["revisions_left"]) == 0
    # A second REVISE has nowhere to loop back to, so it settles as one.
    assert j["status"] == "JUDGED"
    assert j["band"] == "REVISE"
    assert int(j["paid_translator"]) == (PRICE * 60) // 100 + STAKE


def test_a_job_that_never_revised_behaves_as_before(direct_vm, direct_deploy, direct_alice, direct_bob):
    c = direct_deploy("contracts/glossa.py", WINDOW)
    job = judged_job(direct_vm, c, direct_alice, direct_bob, verdict(score=90), threshold=THRESHOLD)

    j = c.get_job(job)
    assert int(j["round"]) == 1
    assert j["status"] == "JUDGED"
    assert int(j["revisions_left"]) == 1
