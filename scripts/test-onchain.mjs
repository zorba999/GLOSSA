/**
 * End-to-end on-chain test against a deployed GLOSSA contract.
 *
 *   node scripts/test-onchain.mjs
 *
 * Exercises the paths scripts/seed.mjs does not: cancellation, the two access
 * checks, the appeal round, and — the one that actually matters — whether the
 * tokens moved. Every assertion is read back from chain state or from wallet
 * balance deltas, never from what the script believes it submitted.
 *
 * Exits non-zero if anything fails.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient, createAccount, generatePrivateKey } from "genlayer-js";
import { studionet, localnet, testnetAsimov, testnetBradbury } from "genlayer-js/chains";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, ".env.local");
const env = {};
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2];
  }
}
Object.assign(env, process.env);

const CHAINS = { studionet, localnet, "testnet-asimov": testnetAsimov, "testnet-bradbury": testnetBradbury };
const chain = CHAINS[env.NEXT_PUBLIC_GENLAYER_NETWORK || "studionet"];
const CONTRACT = env.NEXT_PUBLIC_GLOSSA_ADDRESS;
if (!CONTRACT) throw new Error("NEXT_PUBLIC_GLOSSA_ADDRESS missing — deploy first");

const GEN = 10n ** 18n;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------------------------------------------ */
/* harness                                                             */
/* ------------------------------------------------------------------ */
let passed = 0;
const failures = [];

function check(name, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function rpc(fn, attempts = 8) {
  for (let i = 0; ; i += 1) {
    try {
      return await fn();
    } catch (e) {
      const msg = String(e?.details || e?.message || e);
      if (i >= attempts || !/rate limit|fetch failed|ETIMEDOUT|ECONNRESET/i.test(msg)) throw e;
      const wait = /per hour/i.test(msg) ? 300000 : 65000;
      console.log(`  … rate limited, waiting ${wait / 1000}s (${i + 1}/${attempts})`);
      await sleep(wait);
    }
  }
}

/* ------------------------------------------------------------------ */
/* actors                                                              */
/* ------------------------------------------------------------------ */
const buyer = createAccount(env.TEST_BUYER_KEY || generatePrivateKey());
const translator = createAccount(env.TEST_TRANSLATOR_KEY || generatePrivateKey());
const outsider = createAccount(env.TEST_OUTSIDER_KEY || generatePrivateKey());

const read = createClient({ chain });
const asBuyer = createClient({ chain, account: buyer });
const asTranslator = createClient({ chain, account: translator });
const asOutsider = createClient({ chain, account: outsider });

const balance = (who) => rpc(() => read.getBalance({ address: who }));

async function fund(who, label) {
  await rpc(() => read.request({ method: "sim_fundAccount", params: [who, Number(20n * GEN)] }));
  for (let i = 0; i < 12; i += 1) {
    await sleep(1500);
    if ((await balance(who)) > 0n) return;
  }
  throw new Error(`faucet did not credit ${label}`);
}

async function send(client, fn, args, value = 0n) {
  const hash = await rpc(() => client.writeContract({ address: CONTRACT, functionName: fn, args, value }));
  const receipt = await rpc(() =>
    client.waitForTransactionReceipt({ hash, status: "FINALIZED", retries: 90, interval: 8000 }),
  );
  return { hash, receipt };
}

/**
 * A call the contract is supposed to refuse. GenLayer still records the
 * transaction — the execution simply fails and no state changes — so the
 * assertion afterwards is always about state, never about this returning.
 * Waits only briefly: a rejected call has nothing worth waiting for.
 */
async function sendExpectingRejection(client, fn, args, value = 0n) {
  try {
    const hash = await rpc(() => client.writeContract({ address: CONTRACT, functionName: fn, args, value }));
    await rpc(() => client.waitForTransactionReceipt({ hash, status: "ACCEPTED", retries: 20, interval: 6000 })).catch(
      () => null,
    );
    return { hash };
  } catch (e) {
    return { rejectedAtSubmit: String(e?.message ?? e) };
  }
}

const getJob = (id) => rpc(() => read.readContract({ address: CONTRACT, functionName: "get_job", args: [id] }));
const listJobs = () => rpc(() => read.readContract({ address: CONTRACT, functionName: "list_jobs", args: [] }));
const stats = () => rpc(() => read.readContract({ address: CONTRACT, functionName: "stats", args: [] }));
const card = (who) => rpc(() => read.readContract({ address: CONTRACT, functionName: "translator_card", args: [who] }));

async function newJobId() {
  const jobs = await listJobs();
  return jobs.length ? Math.max(...jobs.map((j) => Number(j.id))) : 0;
}

/* ------------------------------------------------------------------ */

const SOURCE = `Water point maintenance: monthly checklist for village committees

Check the handpump seal and the rising main every 30 days. Replace the seal if water output falls below 12 litres per minute.

Record the reading in the logbook and send it to the district water office on 0800 445 902 before the 5th of each month.

If the water turns cloudy for more than 3 days, stop the pump and report it the same day.`;

const GOOD_ES = `Mantenimiento del punto de agua: lista de verificación mensual para los comités comunitarios

Revise el sello de la bomba manual y la tubería ascendente cada 30 días. Cambie el sello si el caudal baja de 12 litros por minuto.

Anote la lectura en el cuaderno de registro y envíela a la oficina distrital de agua al 0800 445 902 antes del día 5 de cada mes.

Si el agua se enturbia por más de 3 días, detenga la bomba y repórtelo el mismo día.`;

const BRIEF = [
  "English",
  "Spanish",
  "Village water committee members with basic literacy. Plain instructional register, second person, short sentences. Every figure and the phone number must survive verbatim.",
  "handpump => bomba manual\ndistrict water office => oficina distrital de agua",
  SOURCE,
  80,
];

const price = 2n * GEN;
const stake = price / 5n;
const bond = price / 4n;

console.log(`contract   ${CONTRACT}`);
console.log(`network    ${chain.name}`);
console.log(`buyer      ${buyer.address}`);
console.log(`translator ${translator.address}`);
console.log(`outsider   ${outsider.address}\n`);

console.log("── funding actors");
await fund(buyer.address, "buyer");
await fund(translator.address, "translator");
await fund(outsider.address, "outsider");
console.log("  funded\n");

/* ================================================================== */
console.log("── 1. escrow and cancellation");

const before1 = await balance(buyer.address);
await send(asBuyer, "post_job", BRIEF, price);
const jobA = await newJobId();
let a = await getJob(jobA);

check("job created", Number(a.id) === jobA);
check("status is OPEN", a.status === "OPEN");
check("fee recorded in escrow", BigInt(a.price) === price, `got ${a.price}`);
check("buyer recorded", a.client.toLowerCase() === buyer.address.toLowerCase());
check("no translator yet", a.translator === "0x0000000000000000000000000000000000000000");

const afterPost = await balance(buyer.address);
check("fee actually left the buyer's wallet", before1 - afterPost >= price, `delta ${before1 - afterPost}`);

// An outsider must not be able to cancel someone else's commission.
await sendExpectingRejection(asOutsider, "cancel_job", [jobA]);
a = await getJob(jobA);
check("outsider cannot cancel", a.status === "OPEN", `status became ${a.status}`);

await send(asBuyer, "cancel_job", [jobA]);
a = await getJob(jobA);
const afterCancel = await balance(buyer.address);
check("buyer can cancel while unclaimed", a.status === "CANCELLED", `status ${a.status}`);
check("escrow refunded to the buyer", afterCancel > afterPost, `${afterPost} -> ${afterCancel}`);

/* ================================================================== */
console.log("\n── 2. access control on claim and deliver");

await send(asBuyer, "post_job", BRIEF, price);
const jobB = await newJobId();
let b = await getJob(jobB);
check("second job opened", b.status === "OPEN" && Number(b.id) === jobB);

// Below the 10% floor.
await sendExpectingRejection(asTranslator, "claim_job", [jobB], price / 100n);
b = await getJob(jobB);
check("understaked claim rejected", b.status === "OPEN", `status ${b.status}`);

// The buyer taking their own job would defeat the whole arrangement.
await sendExpectingRejection(asBuyer, "claim_job", [jobB], stake);
b = await getJob(jobB);
check("buyer cannot claim their own job", b.translator === "0x0000000000000000000000000000000000000000");

await send(asTranslator, "claim_job", [jobB], stake);
b = await getJob(jobB);
check("valid claim accepted", b.status === "CLAIMED", `status ${b.status}`);
check("stake recorded", BigInt(b.stake) === stake, `got ${b.stake}`);
check("translator assigned", b.translator.toLowerCase() === translator.address.toLowerCase());

await sendExpectingRejection(asOutsider, "deliver", [jobB, GOOD_ES]);
b = await getJob(jobB);
check("outsider cannot deliver", b.status === "CLAIMED" && b.delivery === "");

await send(asTranslator, "deliver", [jobB, GOOD_ES]);
b = await getJob(jobB);
check("assigned translator can deliver", b.status === "DELIVERED");
check("delivery stored intact", b.delivery === GOOD_ES);

/* ================================================================== */
console.log("\n── 3. adjudication (the panel runs; this takes a while)");

const tBefore = await balance(translator.address);
const bBefore = await balance(buyer.address);

const adj = await send(asOutsider, "adjudicate", [jobB]);
b = await getJob(jobB);

check("anyone may convene the panel", b.round >= 1, `round ${b.round}`);
check("a band was assigned", ["PASS", "REVISE", "PARTIAL", "FAIL", "FRAUD"].includes(b.band), `band "${b.band}"`);
check("a score was recorded", Number(b.score) > 0, `score ${b.score}`);
check("reasoning was stored", String(b.reasoning).length > 40);
check("evidence json parses", (() => { try { JSON.parse(b.evidence); return true; } catch { return false; } })());

const hard = JSON.parse(b.hard_report);
check("mechanical pass ran", typeof hard.length_ratio_pct === "number", JSON.stringify(hard).slice(0, 120));
check("no figures reported missing for a faithful delivery", hard.missing_numbers.length === 0, `got ${JSON.stringify(hard.missing_numbers)}`);
check("no glossary breaches for a compliant delivery", hard.missing_glossary_terms.length === 0, JSON.stringify(hard.missing_glossary_terms));
check("a faithful delivery clears the threshold", b.band === "PASS", `band ${b.band}, score ${b.score}`);

// Money conservation: nothing may be minted or stranded.
const paidT = BigInt(b.paid_translator);
const paidC = BigInt(b.paid_client);
check("payouts equal the pot", paidT + paidC === price + stake, `${paidT} + ${paidC} vs ${price + stake}`);

// The split is decided but must still be in escrow, or the appeal below would
// be re-dividing money that has already left.
check("verdict leaves the job awaiting release", b.status === "JUDGED", `status ${b.status}`);
await sleep(8000);
check(
  "no tokens moved before release",
  (await balance(translator.address)) === tBefore,
  `translator ${tBefore} -> ${await balance(translator.address)}`,
);

// The panel that decided is recorded on chain.
const cd = adj.receipt?.consensus_data ?? {};
const validators = cd.validators ?? [];
const leader = Array.isArray(cd.leader_receipt) ? cd.leader_receipt[0] : cd.leader_receipt;
check("a leader receipt exists", Boolean(leader));
check("validators were polled", validators.length > 0, `${validators.length} validators`);
check("at least one validator agreed", validators.some((v) => v.vote === "agree"), JSON.stringify(validators.map((v) => v.vote)));

/* ================================================================== */
console.log("\n── 4. release of escrow");

await send(asOutsider, "release", [jobB]);
b = await getJob(jobB);
check("anyone may release", b.status === "SETTLED", `status ${b.status}`);

await sleep(10000);
const tAfter = await balance(translator.address);
const bAfter = await balance(buyer.address);
check("translator's wallet actually grew", tAfter > tBefore, `${tBefore} -> ${tAfter}`);
check("translator received the full payout", tAfter - tBefore === paidT, `delta ${tAfter - tBefore} vs ${paidT}`);
check("buyer received nothing on a PASS", bAfter <= bBefore + 1n, `${bBefore} -> ${bAfter}`);

const rep = await card(translator.address);
check("reputation updated on release", Number(rep.settled_jobs) >= 1 && Number(rep.mean_score) > 0, JSON.stringify(rep));

await sendExpectingRejection(asOutsider, "release", [jobB]);
b = await getJob(jobB);
check("a settled job cannot be released twice", b.status === "SETTLED");

/* ================================================================== */
console.log("\n── 5. appeal (second panel, before the money moves)");

await send(asBuyer, "post_job", BRIEF, price);
const jobC = await newJobId();
await send(asTranslator, "claim_job", [jobC], stake);
await send(asTranslator, "deliver", [jobC, GOOD_ES]);
console.log("  first panel deliberating…");
await send(asOutsider, "adjudicate", [jobC]);

let cJob = await getJob(jobC);
check("second job judged", cJob.status === "JUDGED", `status ${cJob.status}`);
const firstScore = Number(cJob.score);

await sendExpectingRejection(asOutsider, "appeal", [jobC], bond);
cJob = await getJob(jobC);
check("outsider cannot appeal", cJob.status === "JUDGED" && cJob.appellant === "0x0000000000000000000000000000000000000000");

await sendExpectingRejection(asBuyer, "appeal", [jobC], price / 100n);
cJob = await getJob(jobC);
check("underfunded appeal bond rejected", cJob.status === "JUDGED", `status ${cJob.status}`);

const cBuyerBefore = await balance(buyer.address);
const cTranslatorBefore = await balance(translator.address);

await send(asBuyer, "appeal", [jobC], bond);
cJob = await getJob(jobC);
check("appeal reopens the job", cJob.status === "DELIVERED", `status ${cJob.status}`);
check("appellant recorded", cJob.appellant.toLowerCase() === buyer.address.toLowerCase());
check("bond recorded", BigInt(cJob.appeal_bond) === bond, `got ${cJob.appeal_bond}`);
check("provisional payouts cleared", BigInt(cJob.paid_translator) === 0n && BigInt(cJob.paid_client) === 0n);

console.log("  second panel deliberating…");
await send(asOutsider, "adjudicate", [jobC]);
cJob = await getJob(jobC);

check("second round recorded", Number(cJob.round) === 2, `round ${cJob.round}`);
check("no third appeal, so it settles straight away", cJob.status === "SETTLED", `status ${cJob.status}`);
check(
  "bond is included in the settlement",
  BigInt(cJob.paid_translator) + BigInt(cJob.paid_client) === price + stake + bond,
  `${cJob.paid_translator} + ${cJob.paid_client} vs ${price + stake + bond}`,
);
check("second panel reached a comparable score", Math.abs(Number(cJob.score) - firstScore) <= 20, `${firstScore} -> ${cJob.score}`);

await sleep(10000);
const cTranslatorAfter = await balance(translator.address);
const cBuyerAfter = await balance(buyer.address);
check(
  "appealed job paid out too",
  cTranslatorAfter - cTranslatorBefore + (cBuyerAfter > cBuyerBefore ? cBuyerAfter - cBuyerBefore : 0n) > 0n,
  `translator ${cTranslatorBefore} -> ${cTranslatorAfter}, buyer ${cBuyerBefore} -> ${cBuyerAfter}`,
);

await sendExpectingRejection(asBuyer, "appeal", [jobC], bond);
cJob = await getJob(jobC);
check("a job cannot be appealed twice", Number(cJob.round) === 2 && cJob.status === "SETTLED");

/* ================================================================== */
console.log("\n── 6. aggregate views");
const s = await stats();
check("stats counts jobs", Number(s.jobs) >= 3, JSON.stringify(s));
check("stats tracks escrow", BigInt(s.escrowed) >= price * 3n, JSON.stringify(s));

const all = await listJobs();
check("registry lists every job", all.length >= 3, `${all.length} jobs`);
check("summaries carry a preview", all.every((j) => typeof j.source_preview === "string"));

/* ================================================================== */
console.log(`\n${"─".repeat(50)}`);
console.log(`${passed} passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.log(`  ✗ ${f}`);
  process.exit(1);
}
console.log("all green");
