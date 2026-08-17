import { studionet, localnet, testnetAsimov, testnetBradbury } from "genlayer-js/chains";
import type { GenLayerChain } from "genlayer-js/types";

export const NETWORKS: Record<string, GenLayerChain> = {
  studionet,
  localnet,
  "testnet-asimov": testnetAsimov,
  "testnet-bradbury": testnetBradbury,
};

export const NETWORK_NAME = process.env.NEXT_PUBLIC_GENLAYER_NETWORK || "studionet";
export const CHAIN: GenLayerChain = NETWORKS[NETWORK_NAME] ?? studionet;

/** studionet and localnet expose the `sim_*` RPC surface (faucet, tx listing). */
export const IS_STUDIO = Boolean((CHAIN as unknown as { isStudio?: boolean }).isStudio);

export const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_GLOSSA_ADDRESS || "") as `0x${string}`;

export const EXPLORER = CHAIN.blockExplorers?.default?.url ?? "";
