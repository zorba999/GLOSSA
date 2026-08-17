import { Mark } from "@/components/Bits";
import { CONTRACT_ADDRESS, NETWORK_NAME } from "@/lib/chains";

export const metadata = { title: "GLOSSA — method" };

const STEPS: [string, string][] = [
  [
    "The brief is frozen before the money is",
    "Language pair, register, audience and mandated terminology are written into contract storage at posting and cannot be edited afterwards. This is what makes the later verdict a judgment about the work rather than about whichever party argues harder. It also binds the buyer: a vague brief is theirs to answer for, and the panel is instructed to read ambiguity in the translator's favour.",
  ],
  [
    "Code looks before a model does",
    "Ordinary Python — deterministic, byte-identical on every validator — normalises numeral systems, then searches the delivery for every figure, URL and mandated rendering in the source, compares paragraph counts, measures length ratio and catches an untranslated copy-paste. Models are unreliable at this kind of character-level bookkeeping. Code is not.",
  ],
  [
    "Findings are candidates, not conclusions",
    "A figure whose digits are absent may simply have been spelled out in words. The panel is handed the list and asked to confirm which are genuinely missing; only confirmed omissions cap the score. Handing a model a wrong fact and calling it ground truth is how automated review earns its reputation.",
  ],
  [
    "Every juror back-translates",
    "Before scoring, each juror reconstructs the delivery into the source language and compares it against the original. That is what exposes an omitted clause or an inverted meaning even where a model's command of the target language is thin — and it is the reason this works for pairs no commercial reviewer covers.",
  ],
  [
    "Jurors are allowed to disagree",
    "Insisting on an identical integer from an open-ended judgment guarantees consensus failure. The equivalence rule instead requires agreement on the manipulation flag, the same side of the buyer's threshold, the same side of the rejection floor, and a gap no wider than fifteen points. Outside those bounds the leader is rotated rather than averaged.",
  ],
  [
    "Settlement is graduated",
    "Binary outcomes turn every imperfect job into a total-loss fight. Clearing the threshold pays in full; a near miss buys one revision with the segment list as the repair list; a merely usable delivery splits sixty-forty; rejection refunds the buyer and forfeits half the stake.",
  ],
  [
    "Manipulation is priced as fraud",
    "A delivery carrying instructions addressed to the reviewer is flagged, capped at twenty and settled as fraud with the whole stake forfeited. In a script the buyer cannot read, that attack would otherwise be free to attempt.",
  ],
  [
    "The appeal is a second panel, not a second opinion",
    "Either party can post a bond and have the work re-judged from the same material by a freshly drawn set of validators. Move the verdict your way and the bond comes back; fail and it goes to the other side. That is what an agency charges for, without the agency.",
  ],
  [
    "The verdict is reached before the money moves",
    "Adjudication decides the split but leaves it in escrow, and only a release call pays it out. An appeal has to be possible while the tokens are still here: a second panel cannot redistribute what has already landed in someone's wallet, and nothing can pull it back. Anyone may call the release, so neither party can strand the other's money by never showing up.",
  ],
];

export default function About() {
  return (
    <>
      <section className="pad section">
        <Mark n="04" label="METHOD" />
        <h1 className="display" style={{ fontSize: "clamp(2.4rem, 7vw, 6rem)" }}>
          What the chain
          <br />
          is actually for.
        </h1>
        <p className="lede dim" style={{ marginTop: 28, maxWidth: "46ch" }}>
          Not storage, and not an AI backend with extra steps. GenLayer is here because the decision that moves the money
          is subjective, has to be re-derivable by strangers, and has to be appealable by whoever lost.
        </p>
      </section>

      <section className="pad section rule-t">
        <div className="cols">
          {STEPS.map(([h, b], i) => (
            <div key={h}>
              <div className="micro faint" style={{ marginBottom: 12 }}>( {String(i + 1).padStart(2, "0")} )</div>
              <h2 className="h3">{h}</h2>
              <p className="dim" style={{ marginTop: 10, maxWidth: "44ch" }}>{b}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="pad section rule-t">
        <Mark n="05" label="HONEST LIMITS" />
        <div className="cols">
          <p style={{ maxWidth: "44ch" }}>
            Judging competence has a floor. For the thinnest-resourced languages a model's own command of the target is
            not enough on its own, and back-translation only carries so far. The intended answer there is a staked human
            attestor whose written argument the panel evaluates — the contract judges the reasoning, not the language.
            That path is designed but not yet built here.
          </p>
          <p style={{ maxWidth: "44ch" }}>
            Contract storage is public. The demo deliberately uses the kind of document that ends up published anyway.
            Confidential work belongs behind a commit-and-reveal scheme, or behind judgment over randomly sampled
            segments rather than the whole document — which also happens to be how this scales past a few thousand words.
          </p>
          <p style={{ maxWidth: "44ch" }}>
            The rubric is the product. The escrow is a day of plumbing; the prompt, the deterministic pass and the
            equivalence bounds are where the work is. They should be tuned against a labelled corpus of good, machine,
            omitted, mis-registered and adversarial deliveries — and re-tuned when the models underneath change.
          </p>
        </div>
      </section>

      <section className="pad section rule-t">
        <div className="micro faint" style={{ lineHeight: 2.4 }}>
          NETWORK {NETWORK_NAME}
          <br />
          CONTRACT <span className="mono" style={{ letterSpacing: 0, fontSize: 11 }}>{CONTRACT_ADDRESS || "not deployed"}</span>
          <br />
          SOURCE contracts/glossa.py
        </div>
      </section>
    </>
  );
}
