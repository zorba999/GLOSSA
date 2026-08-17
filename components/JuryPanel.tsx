"use client";

import { useEffect, useState } from "react";
import { findJury, type JuryRecord } from "@/lib/glossa";
import { useWallet } from "@/lib/wallet";
import { IS_STUDIO } from "@/lib/chains";
import { short } from "@/lib/format";

/**
 * The panel that decided, read back off chain: who led, who validated, which
 * model each one ran, and how each voted. Without this the verdict is just an
 * app telling you a number.
 */
export default function JuryPanel({ jobId }: { jobId: number }) {
  const { readClient } = useWallet();
  const [jury, setJury] = useState<JuryRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const r = await findJury(readClient, jobId);
      if (!alive) return;
      setJury(r);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [readClient, jobId]);

  if (!IS_STUDIO) return null;
  if (loading) return <div className="micro faint">READING THE PANEL<span className="spin">…</span></div>;
  if (!jury) return null;

  const agreed = jury.jurors.filter((j) => j.role === "validator" && j.vote === "agree").length;
  const validators = jury.jurors.filter((j) => j.role === "validator").length;

  return (
    <div>
      <div
        className="micro faint"
        style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 12, flexWrap: "wrap" }}
      >
        <span>THE PANEL — {agreed} OF {validators} VALIDATORS AGREED WITH THE LEADER</span>
        <span className="mono" style={{ letterSpacing: 0, fontSize: 10 }}>{jury.hash.slice(0, 18)}…</span>
      </div>

      <div className="jury">
        {jury.jurors.map((j, i) => (
          <div key={i} className={`juror ${j.vote === "agree" ? "agree" : ""}`}>
            <div className="micro" style={{ opacity: 0.7 }}>
              {j.role === "leader" ? "LEADER" : `VALIDATOR ${String(i).padStart(2, "0")}`}
            </div>
            <div>
              <div className="mono" style={{ fontSize: 11, lineHeight: 1.4, wordBreak: "break-word" }}>
                {j.model}
              </div>
              {j.address && (
                <div className="mono" style={{ fontSize: 9.5, opacity: 0.55, marginTop: 4 }}>
                  {short(j.address)}
                  {j.stake ? ` · stake ${j.stake}` : ""}
                </div>
              )}
            </div>
            <div className="micro" style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span className="vote-dot" style={{ opacity: j.vote === "agree" ? 1 : 0.35 }} />
              {j.role === "leader" ? j.execution || "PROPOSED" : j.vote.toUpperCase()}
            </div>
          </div>
        ))}
      </div>

      <p className="micro faint" style={{ marginTop: 12, lineHeight: 2, letterSpacing: "0.08em" }}>
        EACH VALIDATOR RE-JUDGED THE DELIVERY ON ITS OWN AND COMPARED DECISION FIELDS, NOT PROSE.
        <br />
        DISAGREEMENT ROTATES THE LEADER RATHER THAN AVERAGING THE ANSWER.
      </p>
    </div>
  );
}
