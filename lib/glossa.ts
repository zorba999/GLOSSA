import type { GenLayerClient } from "genlayer-js/types";
import { CONTRACT_ADDRESS, IS_STUDIO } from "./chains";

export type Band = "PASS" | "REVISE" | "PARTIAL" | "FAIL" | "FRAUD" | "";
export type Status = "OPEN" | "CLAIMED" | "DELIVERED" | "REVISION" | "SETTLED" | "CANCELLED";

export type JobSummary = {
  id: number;
  client: string;
  translator: string;
  src_lang: string;
  tgt_lang: string;
  price: string;
  stake: string;
  threshold: number;
  status: Status;
  round: number;
  revisions_left: number;
  score: number;
  band: Band;
  created_at: string;
  judged_at: string;
  appellant: string;
  source_preview?: string;
};

export type Job = JobSummary & {
  audience: string;
  glossary: string;
  source_text: string;
  delivery: string;
  reasoning: string;
  evidence: string;
  hard_report: string;
  appeal_bond: string;
  paid_translator: string;
  paid_client: string;
};

export type Evidence = {
  segments: { quote: string; issue: string; severity: string }[];
  confirmed_omissions: string[];
  back_translation: string;
  machine_translation_likelihood: number;
  injection_attempt: boolean;
};

export type HardReport = {
  missing_numbers: string[];
  missing_urls: string[];
  missing_glossary_terms: string[];
  source_paragraphs: number;
  delivery_paragraphs: number;
  length_ratio_pct: number;
  untranslated_copy: boolean;
};

export const ZERO = "0x0000000000000000000000000000000000000000";

export function parseEvidence(raw: string): Evidence {
  try {
    const e = JSON.parse(raw || "{}");
    return {
      segments: Array.isArray(e.segments) ? e.segments : [],
      confirmed_omissions: Array.isArray(e.confirmed_omissions) ? e.confirmed_omissions : [],
      back_translation: e.back_translation || "",
      machine_translation_likelihood: Number(e.machine_translation_likelihood || 0),
      injection_attempt: Boolean(e.injection_attempt),
    };
  } catch {
    return { segments: [], confirmed_omissions: [], back_translation: "", machine_translation_likelihood: 0, injection_attempt: false };
  }
}

export function parseHardReport(raw: string): HardReport | null {
  try {
    const h = JSON.parse(raw || "{}");
    if (typeof h.length_ratio_pct !== "number") return null;
    return h as HardReport;
  } catch {
    return null;
  }
}

export async function listJobs(client: GenLayerClient<any>): Promise<JobSummary[]> {
  const res = (await client.readContract({
    address: CONTRACT_ADDRESS,
    functionName: "list_jobs",
    args: [],
  })) as unknown as JobSummary[];
  return [...(res ?? [])].sort((a, b) => Number(b.id) - Number(a.id));
}

export async function getJob(client: GenLayerClient<any>, id: number): Promise<Job> {
  return (await client.readContract({
    address: CONTRACT_ADDRESS,
    functionName: "get_job",
    args: [id],
  })) as unknown as Job;
}

export async function getStats(client: GenLayerClient<any>) {
  return (await client.readContract({
    address: CONTRACT_ADDRESS,
    functionName: "stats",
    args: [],
  })) as unknown as { jobs: number; escrowed: string; settled: string };
}

export async function translatorCard(client: GenLayerClient<any>, who: string) {
  return (await client.readContract({
    address: CONTRACT_ADDRESS,
    functionName: "translator_card",
    args: [who],
  })) as unknown as { address: string; settled_jobs: number; mean_score: number };
}

export async function write(
  client: GenLayerClient<any>,
  functionName: string,
  args: any[],
  value: bigint = 0n,
): Promise<`0x${string}`> {
  return (await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName,
    args,
    value,
  })) as `0x${string}`;
}

export async function waitAccepted(client: GenLayerClient<any>, hash: `0x${string}`) {
  // The SDK brands hashes with a length check that a plain template literal
  // cannot satisfy; the value is a real 32-byte hash either way.
  return client.waitForTransactionReceipt({ hash: hash as any, status: "ACCEPTED" as any, retries: 200, interval: 4000 });
}

/* ------------------------------------------------------------------ */
/* The jury, as recorded on chain                                      */
/*                                                                     */
/* consensus_data carries every validator's vote and the model that    */
/* cast it. Surfacing that is the difference between "an AI decided"   */
/* and "here is the panel, here is how it split".                      */
/* ------------------------------------------------------------------ */

export type Juror = {
  role: "leader" | "validator";
  vote: string;
  model: string;
  provider: string;
  execution: string;
};

export type JuryRecord = { hash: string; status: string; jurors: Juror[] };

function juror(entry: any, role: Juror["role"]): Juror {
  const cfg = entry?.node_config ?? {};
  return {
    role,
    vote: String(entry?.vote ?? "—"),
    model: String(cfg.model ?? cfg.provider ?? "—"),
    provider: String(cfg.provider ?? ""),
    execution: String(entry?.execution_result ?? ""),
  };
}

export function jurorsFromTransaction(tx: any): Juror[] {
  const cd = tx?.consensus_data ?? {};
  const leaderRaw = Array.isArray(cd.leader_receipt) ? cd.leader_receipt[0] : cd.leader_receipt;
  const out: Juror[] = [];
  if (leaderRaw) out.push(juror(leaderRaw, "leader"));
  for (const v of cd.validators ?? []) out.push(juror(v, "validator"));
  return out;
}

/**
 * The transaction list already carries both the calldata and the consensus
 * data, so identifying a job's adjudication costs one RPC call rather than one
 * per candidate — which matters on a network that allows thirty a minute.
 *
 * GenLayer calldata encodes each value as a varint of (value << 3 | type), so
 * the first argument after the `args` marker is the job id.
 */
function firstArg(b64: string): number | null {
  try {
    const bin = typeof atob === "function" ? atob(b64) : Buffer.from(b64, "base64").toString("binary");
    const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));

    const marker = [0x61, 0x72, 0x67, 0x73]; // "args"
    let at = -1;
    for (let i = 0; i + 3 < bytes.length; i += 1) {
      if (marker.every((m, k) => bytes[i + k] === m)) {
        at = i + 4;
        break;
      }
    }
    if (at < 0) return null;

    const varint = (pos: number): [bigint, number] => {
      let shift = 0n;
      let acc = 0n;
      let p = pos;
      for (;;) {
        const b = bytes[p];
        if (b === undefined) return [acc, p];
        acc |= BigInt(b & 0x7f) << shift;
        p += 1;
        if ((b & 0x80) === 0) return [acc, p];
        shift += 7n;
      }
    };

    const [header, afterHeader] = varint(at); // array header
    if ((header & 7n) !== 5n) return null;
    const [first] = varint(afterHeader);
    return Number(first >> 3n);
  } catch {
    return null;
  }
}

function calldataB64(tx: any): string {
  const cd = tx?.data?.calldata;
  if (typeof cd === "string") return cd;
  return String(cd?.base64 ?? "");
}

/** Find the adjudication transaction for a job and read its panel back. */
export async function findJury(client: GenLayerClient<any>, jobId: number): Promise<JuryRecord | null> {
  if (!IS_STUDIO || !CONTRACT_ADDRESS) return null;
  try {
    const raw = (await client.request({
      method: "sim_getTransactionsForAddress" as any,
      params: [CONTRACT_ADDRESS] as any,
    })) as any[];

    // Newest first: an appealed job has more than one adjudication, and the
    // panel worth showing is the one that settled it.
    const matches = (Array.isArray(raw) ? raw : [])
      .filter((t) => String(t?.to_address ?? "").toLowerCase() === CONTRACT_ADDRESS.toLowerCase())
      .filter((t) => {
        const b64 = calldataB64(t);
        const decoded = typeof atob === "function" ? atob(b64) : Buffer.from(b64, "base64").toString("binary");
        return decoded.includes("adjudicate") && firstArg(b64) === jobId;
      })
      .sort((a, b) => String(b?.created_at ?? "").localeCompare(String(a?.created_at ?? "")));

    for (const t of matches) {
      const jurors = jurorsFromTransaction(t);
      if (!jurors.length) continue;
      return { hash: String(t.hash), status: String(t?.status ?? ""), jurors };
    }
  } catch {
    return null;
  }
  return null;
}
