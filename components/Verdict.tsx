"use client";

import { parseEvidence, parseHardReport, type Job } from "@/lib/glossa";
import { fmtGen, when } from "@/lib/format";
import { BandChip, ScoreRule } from "./Bits";
import JuryPanel from "./JuryPanel";

const BAND_COPY: Record<string, string> = {
  PASS: "Cleared the buyer's threshold. Fee and stake released to the translator.",
  REVISE: "Below the threshold but repairable. The segment list below is the repair list.",
  PARTIAL: "Usable but short of what was commissioned. Split settlement.",
  FAIL: "Rejected. Fee refunded, half the stake forfeited.",
  FRAUD: "Manipulation or machine output passed off as work. Fee refunded, whole stake forfeited.",
};

const SEVERITY_ORDER = ["critical", "major", "minor"];

export default function Verdict({ job }: { job: Job }) {
  const ev = parseEvidence(job.evidence);
  const hard = parseHardReport(job.hard_report);
  const segments = [...ev.segments].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
  );

  return (
    <div className="stack" style={{ marginTop: 8 }}>
      <div className="verdict">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20, flexWrap: "wrap" }}>
          <div>
            <div className="micro faint">VERDICT — ROUND {job.round}{job.round > 1 ? " (APPEALED)" : ""}</div>
            <div className="big-score mono" style={{ marginTop: 10 }}>{job.score}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <BandChip band={job.band} />
            <div className="micro faint" style={{ marginTop: 10 }}>{when(job.judged_at)}</div>
          </div>
        </div>

        <ScoreRule score={job.score} threshold={job.threshold} />

        <p style={{ maxWidth: "52ch", marginTop: 18 }}>{BAND_COPY[job.band] ?? ""}</p>

        <div style={{ display: "flex", gap: 40, marginTop: 22, flexWrap: "wrap" }}>
          <div>
            <div className="micro faint">TO TRANSLATOR</div>
            <div className="h3 mono" style={{ marginTop: 6 }}>{fmtGen(job.paid_translator)} GEN</div>
          </div>
          <div>
            <div className="micro faint">TO BUYER</div>
            <div className="h3 mono" style={{ marginTop: 6 }}>{fmtGen(job.paid_client)} GEN</div>
          </div>
          {ev.machine_translation_likelihood > 0 && (
            <div>
              <div className="micro faint">MACHINE-TRANSLATION SIGNATURE</div>
              <div className="h3 mono" style={{ marginTop: 6 }}>{ev.machine_translation_likelihood}%</div>
            </div>
          )}
        </div>
      </div>

      {ev.injection_attempt && (
        <div className="verdict chip-hatch">
          <div className="micro" style={{ marginBottom: 8 }}>MANIPULATION DETECTED</div>
          <p style={{ maxWidth: "56ch", margin: 0 }}>
            The delivery contained text addressed to the reviewing system rather than to the reader. Written in a script the
            buyer cannot read, this attack would have been invisible to them.
          </p>
        </div>
      )}

      <div className="cols">
        <div>
          <div className="micro faint" style={{ marginBottom: 10 }}>REASONING</div>
          <p style={{ maxWidth: "48ch" }}>{job.reasoning || "—"}</p>

          {ev.back_translation && (
            <>
              <div className="micro faint" style={{ margin: "26px 0 10px" }}>BACK-TRANSLATION USED TO CHECK IT</div>
              <blockquote className="quote dim" style={{ maxWidth: "48ch" }}>{ev.back_translation}</blockquote>
            </>
          )}
        </div>

        <div>
          <div className="micro faint" style={{ marginBottom: 10 }}>MECHANICAL PASS — COMPUTED BY CODE, NOT BY A MODEL</div>
          {hard ? (
            <div className="mono" style={{ fontSize: 12, lineHeight: 2 }}>
              <Line label="paragraphs" value={`${hard.source_paragraphs} → ${hard.delivery_paragraphs}`} bad={hard.delivery_paragraphs < hard.source_paragraphs} />
              <Line label="length ratio" value={`${hard.length_ratio_pct}%`} bad={hard.length_ratio_pct < 45} />
              <Line label="figures not found as digits" value={hard.missing_numbers.length ? hard.missing_numbers.join(" ") : "none"} bad={false} />
              <Line label="confirmed omissions" value={ev.confirmed_omissions.length ? ev.confirmed_omissions.join(" ") : "none"} bad={ev.confirmed_omissions.length > 0} />
              <Line label="glossary breaches" value={hard.missing_glossary_terms.length ? String(hard.missing_glossary_terms.length) : "none"} bad={hard.missing_glossary_terms.length > 0} />
              <Line label="dropped urls" value={hard.missing_urls.length ? String(hard.missing_urls.length) : "none"} bad={hard.missing_urls.length > 0} />
              <Line label="untranslated copy" value={hard.untranslated_copy ? "yes" : "no"} bad={hard.untranslated_copy} />
            </div>
          ) : (
            <div className="dim">—</div>
          )}
        </div>
      </div>

      {segments.length > 0 && (
        <div>
          <div className="micro faint" style={{ margin: "12px 0 10px" }}>SEGMENTS THE PANEL PENALISED</div>
          <div className="rule-t">
            {segments.map((s, i) => (
              <div key={i} style={{ padding: "16px 0", borderBottom: "1px solid var(--rule)" }}>
                <div style={{ display: "flex", gap: 14, alignItems: "baseline", flexWrap: "wrap" }}>
                  <span className="chip">{s.severity}</span>
                  <span className="mono" style={{ fontSize: 12.5, flex: 1, minWidth: 220 }}>{s.quote || "—"}</span>
                </div>
                <p className="dim" style={{ margin: "10px 0 0", maxWidth: "62ch" }}>{s.issue}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: 22 }}>
        <JuryPanel jobId={job.id} />
      </div>
    </div>
  );
}

function Line({ label, value, bad }: { label: string; value: string; bad: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, borderBottom: "1px solid var(--rule)" }}>
      <span className="faint">{label}</span>
      <span style={{ textAlign: "right", opacity: bad ? 1 : 0.62, fontWeight: bad ? 500 : 400, wordBreak: "break-word" }}>
        {value}
      </span>
    </div>
  );
}
