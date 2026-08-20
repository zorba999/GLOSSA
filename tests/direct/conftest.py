"""
Shared fixtures and helpers for direct-mode tests.

The unlink shim below is a Windows workaround, not a project decision: the
gltest loader writes the deploy payload to a temp file, dup2s it onto stdin and
then unlinks it while the descriptor is still open. POSIX allows that; Windows
raises PermissionError and every direct test fails before it starts. Swallowing
that one error leaves the harness behaving as it does on Linux, apart from a
stray file in the temp directory.
"""

import json
import os

_real_unlink = os.unlink


def _tolerant_unlink(path, *args, **kwargs):
    try:
        return _real_unlink(path, *args, **kwargs)
    except PermissionError:
        return None


os.unlink = _tolerant_unlink


GEN = 10 ** 18
PRICE = 2 * GEN
STAKE = PRICE // 5
BOND = PRICE // 4

# No digits and no glossary, so the mechanical pass has nothing to flag and
# these tests isolate the band logic instead of tripping over a score cap.
SOURCE = (
    "Care of a village well: what the committee checks each month\n\n"
    "Look at the seal on the handpump and at the rising main. Replace the seal "
    "if the flow has weakened since the last visit.\n\n"
    "Write the reading in the book and send it to the district water office "
    "before the first weekend of the month.\n\n"
    "If the water turns cloudy for several days, stop the pump and report it "
    "the same day rather than waiting."
)

DELIVERY = (
    "Cuidado del pozo comunitario: lo que revisa el comite cada mes\n\n"
    "Observe el sello de la bomba manual y la tuberia ascendente. Cambie el "
    "sello si el caudal ha bajado desde la ultima visita.\n\n"
    "Anote la lectura en el cuaderno y enviela a la oficina distrital de agua "
    "antes del primer fin de semana del mes.\n\n"
    "Si el agua se enturbia durante varios dias, detenga la bomba y reportelo "
    "el mismo dia en lugar de esperar."
)

BRIEF = "Village water committee members with basic literacy. Plain instructional register, second person."


def verdict(score=90, injection=False, brief_injection=False, mt=10, omissions=None, segments=None):
    """A well-formed panel response, so a test can vary one field at a time."""
    return json.dumps(
        {
            "score": score,
            "injection_attempt": injection,
            "brief_injection": brief_injection,
            "machine_translation_likelihood": mt,
            "confirmed_omissions": omissions or [],
            "back_translation": "Care of a village well; monthly checks by the committee.",
            "reasoning": "Faithful rendering at the commissioned register.",
            "segments": segments or [],
        }
    )


def as_hex(addr) -> str:
    """direct_* fixtures give raw bytes; contract views return checksummed hex."""
    if isinstance(addr, (bytes, bytearray)):
        return "0x" + bytes(addr).hex()
    return str(addr).lower()


def mock_panel(vm, response):
    """
    Answer any adjudication prompt with a fixed verdict.

    Clearing first matters: registered mocks accumulate and the earliest match
    wins, so re-mocking for a second round silently kept returning the first
    round's verdict.
    """
    vm.clear_mocks()
    vm.mock_llm(r"(?s).*one juror on a decentralised panel.*", response)


def open_job(vm, contract, buyer, audience=BRIEF, glossary="", source=SOURCE, threshold=80, price=PRICE):
    vm.deal(buyer, 100 * GEN)
    vm.sender = buyer
    vm.value = price
    contract.post_job("English", "Spanish", audience, glossary, source, threshold)
    vm.value = 0
    return int(contract.stats()["jobs"])


def deliver_job(vm, contract, job_id, translator, delivery=DELIVERY, stake=STAKE):
    vm.deal(translator, 100 * GEN)
    vm.sender = translator
    vm.value = stake
    contract.claim_job(job_id)
    vm.value = 0
    contract.deliver(job_id, delivery)
    return job_id


def judged_job(vm, contract, buyer, translator, response, delivery=DELIVERY, **kwargs):
    """Post, claim, deliver and adjudicate in one step."""
    job_id = open_job(vm, contract, buyer, **kwargs)
    deliver_job(vm, contract, job_id, translator, delivery=delivery)
    mock_panel(vm, response)
    vm.sender = buyer
    contract.adjudicate(job_id)
    return job_id
