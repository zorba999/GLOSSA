"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useWallet } from "@/lib/wallet";
import { usePoll } from "@/lib/poll";
import { listJobs, getStats, type JobSummary } from "@/lib/glossa";
import { CONTRACT_ADDRESS } from "@/lib/chains";
import { fmtGen, when } from "@/lib/format";
import { BandChip, Mark, Stat } from "@/components/Bits";

export default function Home() {
  const { readClient } = useWallet();
  const [jobs, setJobs] = useState<JobSummary[] | null>(null);
  const [stats, setStats] = useState<{ jobs: number; escrowed: string; settled: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const [j, s] = await Promise.all([listJobs(readClient), getStats(readClient)]);
      setJobs(j);
      setStats(s);
    } catch {
      setJobs((prev) => prev ?? []);
    }
  }, [readClient]);

  usePoll(load, 30000);

  return (
    <>
      {/* ---------------------------------------------------------------- */}
      <section className="pad section" style={{ paddingTop: "clamp(48px, 9vw, 130px)" }}>
        <p className="micro dim" style={{ marginBottom: 26 }}>( 00 ) &nbsp; THE PREMISE</p>
        <h1 className="display">
          You paid for a language
          <br />
          you cannot read.
        </h1>
        <div
          style={{
            marginTop: "clamp(28px, 5vw, 64px)",
            display: "grid",
            gap: "clamp(20px, 4vw, 56px)",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
          }}
        >
          <p className="lede">
            Translation into Tigrinya, Faroese or Quechua is a credence good: the buyer has no way to tell diligence from
            machine output, so the market cannot price honesty.
          </p>
          <p className="lede">
            GLOSSA escrows the fee and hands the delivery to a jury of GenLayer validators. They judge it independently
            against a rubric frozen before the work began, and must agree before a single token moves.
          </p>
          <div className="stack">
            <Link href="/post" className="btn btn-solid" style={{ display: "inline-block" }}>
              Commission a translation
            </Link>
            <div className="micro faint" style={{ lineHeight: 2 }}>
              CONTRACT
              <br />
              <span className="mono" style={{ letterSpacing: 0, fontSize: 10.5 }}>
                {CONTRACT_ADDRESS || "not deployed"}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      <section className="pad section rule-t">
        <Mark n="01" label="WHAT THE CONTRACT ACTUALLY DOES" />
        <div className="cols">
          {[
            [
              "It reads before it judges",
              "Code — not a model — checks first: numeral systems are normalised, then every figure, URL and mandated term from the source is searched for in the delivery, paragraph counts are compared, and an untranslated copy-paste is caught outright. The panel is handed those findings as candidates and has to confirm which are genuine before they can cost anyone money.",
            ],
            [
              "It back-translates",
              "Each juror reconstructs the delivery back into the source language before scoring. That is what exposes an omitted clause or a reversed meaning even when a model's command of the target language is imperfect.",
            ],
            [
              "It expects jurors to differ",
              "Demanding an identical integer from an open judgment would never reach consensus. Jurors must agree on the injection flag, land on the same side of the buyer's threshold and the rejection floor, and stay within fifteen points. Inside that, they may disagree.",
            ],
            [
              "It treats manipulation as fraud",
              "A delivery containing instructions aimed at the reviewer — asking for a score, claiming prior approval — is flagged, capped at twenty, and settles as fraud with the stake forfeited. Written in a script the buyer cannot read, that attack would otherwise be invisible.",
            ],
          ].map(([h, b]) => (
            <div key={h}>
              <h3 className="h3">{h}</h3>
              <p className="dim" style={{ marginTop: 10, maxWidth: "42ch" }}>{b}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      <section className="pad section rule-t">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 16 }}>
          <Mark n="02" label="THE REGISTRY" />
          <div style={{ display: "flex", gap: 40, marginBottom: 28 }}>
            <Stat label="COMMISSIONS" value={String(stats?.jobs ?? "—")} />
            <Stat label="ESCROWED" value={stats ? fmtGen(stats.escrowed) : "—"} />
            <Stat label="SETTLED" value={stats ? fmtGen(stats.settled) : "—"} />
          </div>
        </div>

        <div className="rule-t">
          {jobs === null && (
            <div className="row"><span className="row-idx">—</span><span className="dim">reading chain<span className="spin">…</span></span></div>
          )}
          {jobs?.length === 0 && (
            <div className="row">
              <span className="row-idx">—</span>
              <span className="dim">Nothing commissioned yet. <Link href="/post" style={{ textDecoration: "underline" }}>Post the first job.</Link></span>
            </div>
          )}
          {jobs?.map((j) => (
            <Link key={j.id} href={`/job/${j.id}`} className="row">
              <span className="row-idx">{String(j.id).padStart(3, "0")}</span>
              <span>
                <span className="pair">
                  {j.src_lang} <span className="faint">→</span> {j.tgt_lang}
                </span>
                <span className="micro faint hide-sm" style={{ display: "block", marginTop: 8 }}>
                  {when(j.created_at)}
                </span>
              </span>
              <span className="mono hide-sm" style={{ fontSize: 12 }}>{fmtGen(j.price)} GEN</span>
              <span className="mono hide-sm" style={{ fontSize: 12 }}>{j.band ? `${j.score}/100` : "—"}</span>
              <span style={{ textAlign: "right" }}>
                <BandChip band={j.band || undefined} status={j.status} />
              </span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
