"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/lib/wallet";
import { listJobs, waitAccepted, write } from "@/lib/glossa";
import { GEN, fmtGen, friendlyError } from "@/lib/format";
import { Mark } from "@/components/Bits";

const PRESET = {
  src: "English",
  tgt: "Tigrinya",
  audience:
    "Community health volunteers with basic literacy. Plain instructional register, not clinical or academic. Second person, short sentences. Every dosage figure and phone number must survive verbatim.",
  glossary: "oral rehydration solution => ናይ ኣፍ ማይ መተካእታ\nloose stool => ልቅ ሰገራ\ndistrict office => ቤት ጽሕፈት ወረዳ",
  source: `Cholera treatment: guidance for community health volunteers

Oral rehydration solution must be prepared with 1 litre of clean water and one full sachet. Give 250 ml after every loose stool for adults, and 100 ml for children under five years old.

A patient who cannot keep fluids down for more than 4 hours must be referred to the clinic on the same day. Do not wait until the following morning.

Report every suspected case to the district office within 24 hours, using the number 0800 121 314. Written records must be kept for 12 months.`,
};

/**
 * A vague brief is the buyer's own fault, and the contract's jury is told to
 * treat it that way. Better to say so here, before the money is escrowed,
 * than in a verdict three days later.
 */
function briefAudit(audience: string, glossary: string, source: string) {
  const notes: { ok: boolean; text: string }[] = [];
  notes.push({ ok: audience.trim().length >= 60, text: "Register and audience described in a sentence or more" });
  notes.push({ ok: /\d/.test(source) ? glossary.trim().length > 0 : true, text: "Terminology fixed for the terms that matter" });
  notes.push({ ok: source.trim().split(/\n\s*\n/).length > 1, text: "Source has paragraph structure the jury can count" });
  notes.push({ ok: source.trim().length >= 200, text: "Enough source text to judge (200+ characters)" });
  const score = notes.filter((n) => n.ok).length;
  return { notes, score, total: notes.length };
}

export default function PostJob() {
  const w = useWallet();
  const router = useRouter();

  const [src, setSrc] = useState("");
  const [tgt, setTgt] = useState("");
  const [audience, setAudience] = useState("");
  const [glossary, setGlossary] = useState("");
  const [source, setSource] = useState("");
  const [threshold, setThreshold] = useState(80);
  const [fee, setFee] = useState("3");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const audit = useMemo(() => briefAudit(audience, glossary, source), [audience, glossary, source]);
  const feeWei = useMemo(() => {
    const [a, b = ""] = fee.split(".");
    try {
      return BigInt(a || 0) * GEN + BigInt((b + "000000000000000000").slice(0, 18));
    } catch {
      return 0n;
    }
  }, [fee]);

  const canSubmit = Boolean(w.address) && src.trim() && tgt.trim() && source.trim().length >= 40 && !busy;

  const submit = async () => {
    setErr(null);
    if (!w.address) return setErr("Connect a wallet first.");
    if (feeWei > w.balance) return setErr(`Fee exceeds your balance of ${fmtGen(w.balance)} GEN. Use the faucet in the wallet menu.`);

    setBusy("Escrowing the fee…");
    try {
      const hash = await write(w.client, "post_job", [src.trim(), tgt.trim(), audience, glossary, source, threshold], feeWei);
      setBusy("Waiting for consensus…");
      await waitAccepted(w.client, hash);
      const jobs = await listJobs(w.readClient);
      const mine = jobs.find((j) => j.client.toLowerCase() === w.address!.toLowerCase());
      await w.refreshBalance();
      router.push(mine ? `/job/${mine.id}` : "/");
    } catch (e: any) {
      setErr(friendlyError(e));
      setBusy(null);
    }
  };

  return (
    <section className="pad section">
      <Mark n="03" label="COMMISSION" />
      <h1 className="h2" style={{ maxWidth: "18ch" }}>Freeze the brief. Then escrow the fee.</h1>
      <p className="dim" style={{ marginTop: 14, maxWidth: "56ch" }}>
        Everything below is written into the contract and cannot be changed afterwards. It is the whole of what the jury
        will hold the translator to — and the whole of what it will hold you to.
      </p>

      <div className="cols" style={{ marginTop: "clamp(28px, 4vw, 56px)", alignItems: "start" }}>
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22 }}>
            <label className="field">
              <span className="micro">SOURCE LANGUAGE</span>
              <input value={src} onChange={(e) => setSrc(e.target.value)} placeholder="English" />
            </label>
            <label className="field">
              <span className="micro">TARGET LANGUAGE</span>
              <input value={tgt} onChange={(e) => setTgt(e.target.value)} placeholder="Tigrinya" />
            </label>
          </div>

          <label className="field">
            <span className="micro">REGISTER & AUDIENCE</span>
            <textarea
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              style={{ minHeight: 110 }}
              placeholder="Who reads this, at what reading level, in what voice. A translation can be word-perfect and still fail here."
            />
          </label>

          <label className="field">
            <span className="micro">MANDATED TERMINOLOGY — ONE PER LINE, term =&gt; rendering</span>
            <textarea value={glossary} onChange={(e) => setGlossary(e.target.value)} style={{ minHeight: 90 }} placeholder="district office => ..." />
          </label>

          <label className="field">
            <span className="micro">SOURCE TEXT</span>
            <textarea value={source} onChange={(e) => setSource(e.target.value)} style={{ minHeight: 240 }} />
            <span className="micro faint" style={{ display: "block", marginTop: 6 }}>
              {source.length} / 12000 CHARACTERS
            </span>
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22 }}>
            <label className="field">
              <span className="micro">FEE IN ESCROW — GEN</span>
              <input value={fee} onChange={(e) => setFee(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" />
            </label>
            <label className="field">
              <span className="micro">ACCEPTANCE THRESHOLD — {threshold}/100</span>
              <input type="range" min={50} max={95} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} style={{ padding: "18px 0" }} />
            </label>
          </div>
        </div>

        {/* -------------------------------------------------------------- */}
        <aside className="stack" style={{ position: "sticky", top: 72 }}>
          <div className="verdict stack">
            <div className="micro faint">BRIEF AUDIT — {audit.score}/{audit.total}</div>
            {audit.notes.map((n) => (
              <div key={n.text} style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                <span className="mono" style={{ fontSize: 12, opacity: n.ok ? 1 : 0.35 }}>{n.ok ? "▮" : "▯"}</span>
                <span style={{ fontSize: 13, opacity: n.ok ? 1 : 0.55 }}>{n.text}</span>
              </div>
            ))}
            <p className="micro dim" style={{ letterSpacing: "0.06em", lineHeight: 1.9, marginTop: 4 }}>
              THE JURY IS INSTRUCTED TO HOLD AN UNCLEAR BRIEF AGAINST THE BUYER, NOT THE TRANSLATOR.
            </p>
          </div>

          <button className="btn" style={{ width: "100%" }} onClick={() => {
            setSrc(PRESET.src); setTgt(PRESET.tgt); setAudience(PRESET.audience);
            setGlossary(PRESET.glossary); setSource(PRESET.source);
          }}>
            Load example brief
          </button>

          <div className="note">
            <div className="micro faint" style={{ marginBottom: 8 }}>SETTLEMENT</div>
            <div style={{ fontSize: 13, lineHeight: 1.7 }}>
              <div>Score ≥ {threshold} → translator paid in full</div>
              <div>{threshold - 15}–{threshold - 1} → one revision, then 60%</div>
              <div>50–{threshold - 16} → 60% translator, 40% refunded</div>
              <div>Below 50 → refunded, half the stake forfeited</div>
              <div>Manipulation → refunded, whole stake forfeited</div>
            </div>
          </div>

          <button className="btn btn-solid" style={{ width: "100%" }} onClick={submit} disabled={!canSubmit}>
            {busy ?? `Escrow ${fee || 0} GEN`}
          </button>
          {!w.address && <div className="micro faint" style={{ letterSpacing: "0.06em" }}>CONNECT A WALLET TO POST.</div>}
          {err && <div className="note micro" style={{ letterSpacing: "0.05em", lineHeight: 1.8 }}>{err}</div>}
        </aside>
      </div>
    </section>
  );
}
