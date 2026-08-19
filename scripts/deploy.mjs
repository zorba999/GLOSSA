/**
 * Deploy contracts/glossa.py to a GenLayer network and write the resulting
 * address back into .env.local so the frontend picks it up.
 *
 *   node scripts/deploy.mjs                 # uses NEXT_PUBLIC_GENLAYER_NETWORK
 *   node scripts/deploy.mjs testnet-asimov
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient, createAccount } from "genlayer-js";
import { studionet, localnet, testnetAsimov, testnetBradbury } from "genlayer-js/chains";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, ".env.local");

function loadEnv() {
  if (!existsSync(envPath)) return {};
  const out = {};
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

const env = { ...loadEnv(), ...process.env };
const CHAINS = { studionet, localnet, "testnet-asimov": testnetAsimov, "testnet-bradbury": testnetBradbury };
const networkName = process.argv[2] || env.NEXT_PUBLIC_GENLAYER_NETWORK || "studionet";
// Appeal interval in seconds. The contract's own default is 24h; override it
// when you want a deployment whose window can be watched closing.
const appealWindow = Number(process.argv[3] ?? env.APPEAL_WINDOW_SECONDS ?? 86400);
const chain = CHAINS[networkName];

if (!chain) throw new Error(`unknown network "${networkName}" (expected: ${Object.keys(CHAINS).join(", ")})`);
if (!env.DEPLOYER_PRIVATE_KEY) throw new Error("DEPLOYER_PRIVATE_KEY missing from .env.local");

const account = createAccount(env.DEPLOYER_PRIVATE_KEY);
const client = createClient({ chain, account });
const code = readFileSync(resolve(root, "contracts/glossa.py"), "utf8");

console.log(`network    ${chain.name} (${chain.id})`);
console.log(`deployer   ${account.address}`);
console.log(`appeal     ${appealWindow}s window`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Studionet allows 30 calls a minute per IP. Wait it out rather than fail the deploy. */
async function rpc(fn, attempts = 5) {
  for (let i = 0; ; i += 1) {
    try {
      return await fn();
    } catch (e) {
      const msg = String(e?.details || e?.message || e);
      if (i >= attempts || !/rate limit/i.test(msg)) throw e;
      console.log(`rate limited, waiting 65s (${i + 1}/${attempts})`);
      await sleep(65000);
    }
  }
}

const txHash = await rpc(() => client.deployContract({ code, args: [appealWindow] }));
console.log(`tx         ${txHash}`);

const receipt = await rpc(() =>
  client.waitForTransactionReceipt({ hash: txHash, status: "FINALIZED", retries: 90, interval: 8000 }),
);
const address = receipt?.data?.contract_address ?? receipt?.contractAddress ?? receipt?.data?.contractAddress;

if (!address) {
  console.error("no contract address in receipt — dumping it so the failure is visible:");
  console.error(JSON.stringify(receipt, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2).slice(0, 4000));
  process.exit(1);
}

console.log(`\ncontract   ${address}`);

let contents = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
contents = contents.match(/^NEXT_PUBLIC_GLOSSA_ADDRESS=.*$/m)
  ? contents.replace(/^NEXT_PUBLIC_GLOSSA_ADDRESS=.*$/m, `NEXT_PUBLIC_GLOSSA_ADDRESS=${address}`)
  : `${contents.trimEnd()}\nNEXT_PUBLIC_GLOSSA_ADDRESS=${address}\n`;
contents = contents.match(/^NEXT_PUBLIC_GENLAYER_NETWORK=.*$/m)
  ? contents.replace(/^NEXT_PUBLIC_GENLAYER_NETWORK=.*$/m, `NEXT_PUBLIC_GENLAYER_NETWORK=${networkName}`)
  : `${contents.trimEnd()}\nNEXT_PUBLIC_GENLAYER_NETWORK=${networkName}\n`;
writeFileSync(envPath, contents);

console.log("written to .env.local");
