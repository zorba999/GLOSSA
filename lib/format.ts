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

/**
 * Chain errors arrive as viem's internal prose, which tells a visitor nothing.
 * The two they will actually hit are the studio rate limit and a plain outage.
 */
export function friendlyError(e: any): string {
  const raw = String(e?.details ?? e?.shortMessage ?? e?.message ?? e ?? "");
  if (/rate limit/i.test(raw)) {
    return "The studio network is rate-limiting reads (30 a minute, 500 an hour, shared across everyone on your connection). Wait a moment and try again.";
  }
  if (/failed to fetch|fetch failed|network|ETIMEDOUT|ECONNRESET/i.test(raw)) {
    return "Cannot reach the GenLayer network right now. Check your connection, or wait out the studio rate limit.";
  }
  if (/insufficient/i.test(raw)) return "Not enough GEN in this wallet. Use the faucet in the wallet menu.";
  return raw.replace(/\s*Version:\s*viem@[\d.]+\s*/i, "").trim() || "Something went wrong.";
}

export function when(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 16).replace("T", " ");
  return d.toISOString().slice(0, 16).replace("T", " ");
}
