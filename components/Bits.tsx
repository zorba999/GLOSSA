import type { Band } from "@/lib/glossa";

export function Mark({ n, label }: { n: string; label: string }) {
  return (
    <div className="mark micro">
      <span>( {n} )</span>
      <span>{label}</span>
    </div>
  );
}

const HATCHED: Band[] = ["FAIL", "FRAUD"];

export function BandChip({ band, status }: { band?: Band; status?: string }) {
  if (band) {
    const cls = band === "PASS" ? "chip chip-solid" : HATCHED.includes(band) ? "chip chip-hatch" : "chip";
    return <span className={cls}>{band}</span>;
  }
  return <span className="chip">{status ?? "—"}</span>;
}

/**
 * One hundred ticks. The buyer's acceptance threshold is drawn into the rule
 * itself, so a score is never shown without the line it had to clear.
 */
export function ScoreRule({ score, threshold }: { score: number; threshold: number }) {
  return (
    <div>
      <div className="ticks" aria-hidden>
        {Array.from({ length: 100 }, (_, i) => {
          const at = i + 1;
          const cls = at === threshold ? "tick mark" : at <= score ? "tick on" : "tick";
          return <span key={i} className={cls} />;
        })}
      </div>
      <div className="micro faint" style={{ display: "flex", justifyContent: "space-between" }}>
        <span>0</span>
        <span>THRESHOLD {threshold}</span>
        <span>100</span>
      </div>
    </div>
  );
}

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="micro faint">{label}</div>
      <div className="h3 mono" style={{ marginTop: 6 }}>{value}</div>
    </div>
  );
}
