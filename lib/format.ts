export const GEN = 10n ** 18n;

export function toBig(v: string | number | bigint | undefined | null): bigint {
  if (v === undefined || v === null) return 0n;
  try {
    return BigInt(typeof v === "number" ? Math.trunc(v) : v);
  } catch {
    return 0n;
  }
}

/** Whole units with two decimals, no float rounding on the way there. */
export function fmtGen(v: string | number | bigint | undefined | null): string {
  const n = toBig(v);
  const whole = n / GEN;
  const frac = ((n % GEN) * 100n) / GEN;
  return `${whole}.${frac.toString().padStart(2, "0")}`;
}

export function short(addr?: string | null): string {
  if (!addr) return "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function sameAddr(a?: string | null, b?: string | null): boolean {
  return Boolean(a && b && a.toLowerCase() === b.toLowerCase());
}

export function when(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 16).replace("T", " ");
  return d.toISOString().slice(0, 16).replace("T", " ");
}
