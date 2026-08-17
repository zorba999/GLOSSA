"use client";

/**
 * Wallet adapter.
 *
 * Two connectors behind one interface:
 *
 *   metamask — signs through the injected provider. On a GenLayer testnet this
 *              is the real thing; the SDK's connect() adds the chain and pulls
 *              in the GenLayer snap that MetaMask needs to speak to consensus.
 *
 *   session  — a keypair generated in the browser and kept in localStorage.
 *              Studionet is gasless and exposes a faucet RPC, so a visitor can
 *              transact within a second of landing. A demo nobody can open is
 *              not a demo.
 *
 * Both hand back a genlayer-js client, so nothing downstream knows or cares
 * which one is active.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createClient, createAccount, generatePrivateKey } from "genlayer-js";
import type { GenLayerClient } from "genlayer-js/types";
import { CHAIN, IS_STUDIO, NETWORK_NAME } from "./chains";

export type ConnectorKind = "metamask" | "session";

type WalletState = {
  address: `0x${string}` | null;
  kind: ConnectorKind | null;
  client: GenLayerClient<any>;
  readClient: GenLayerClient<any>;
  balance: bigint;
  connecting: boolean;
  error: string | null;
  connect: (kind: ConnectorKind) => Promise<void>;
  disconnect: () => void;
  fund: () => Promise<void>;
  refreshBalance: () => Promise<void>;
  exportKey: () => string | null;
};

const KEY_STORAGE = "glossa.session.key";
const KIND_STORAGE = "glossa.connector";

const WalletContext = createContext<WalletState | null>(null);

function injected(): any {
  if (typeof window === "undefined") return null;
  return (window as any).ethereum ?? null;
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const readClient = useMemo(() => createClient({ chain: CHAIN }), []);
  const [address, setAddress] = useState<`0x${string}` | null>(null);
  const [kind, setKind] = useState<ConnectorKind | null>(null);
  const [client, setClient] = useState<GenLayerClient<any>>(readClient);
  const [balance, setBalance] = useState<bigint>(0n);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const readBalance = useCallback(
    async (who: `0x${string}` | null) => {
      if (!who) return setBalance(0n);
      try {
        setBalance(await readClient.getBalance({ address: who }));
      } catch {
        setBalance(0n);
      }
    },
    [readClient],
  );

  const connectSession = useCallback(async () => {
    let key = window.localStorage.getItem(KEY_STORAGE) as `0x${string}` | null;
    if (!key) {
      key = generatePrivateKey();
      window.localStorage.setItem(KEY_STORAGE, key);
    }
    const account = createAccount(key);
    setClient(createClient({ chain: CHAIN, account }));
    setAddress(account.address as `0x${string}`);
    setKind("session");
    window.localStorage.setItem(KIND_STORAGE, "session");
    await readBalance(account.address as `0x${string}`);
  }, [readBalance]);

  const connectMetamask = useCallback(async () => {
    const provider = injected();
    if (!provider) throw new Error("No injected wallet found. Install MetaMask, or use a session key.");

    // Adds the chain and installs the GenLayer snap if it is missing.
    try {
      await createClient({ chain: CHAIN }).connect(NETWORK_NAME as any);
    } catch {
      // Older MetaMask builds reject wallet_getSnaps. Signing still works on
      // studionet, so this is not fatal — carry on and let the first write fail
      // loudly if the wallet really cannot sign.
    }

    const accounts: string[] = await provider.request({ method: "eth_requestAccounts" });
    const who = accounts?.[0] as `0x${string}` | undefined;
    if (!who) throw new Error("Wallet returned no account.");

    setClient(createClient({ chain: CHAIN, account: who, provider }));
    setAddress(who);
    setKind("metamask");
    window.localStorage.setItem(KIND_STORAGE, "metamask");
    await readBalance(who);
  }, [readBalance]);

  const connect = useCallback(
    async (which: ConnectorKind) => {
      setConnecting(true);
      setError(null);
      try {
        if (which === "session") await connectSession();
        else await connectMetamask();
      } catch (e: any) {
        setError(e?.message ?? String(e));
      } finally {
        setConnecting(false);
      }
    },
    [connectSession, connectMetamask],
  );

  const disconnect = useCallback(() => {
    setAddress(null);
    setKind(null);
    setClient(readClient);
    setBalance(0n);
    window.localStorage.removeItem(KIND_STORAGE);
  }, [readClient]);

  /** Studio faucet. Escrow needs a balance even on a gasless network. */
  const fund = useCallback(async () => {
    if (!address) return;
    if (!IS_STUDIO) throw new Error("Use the public faucet for this network.");
    await readClient.request({
      method: "sim_fundAccount" as any,
      params: [address, Number(50n * 10n ** 18n)] as any,
    });
    // The faucet credits asynchronously; poll briefly rather than lying to the user.
    for (let i = 0; i < 10; i += 1) {
      await new Promise((r) => setTimeout(r, 1200));
      const next = await readClient.getBalance({ address });
      if (next > balance) {
        setBalance(next);
        return;
      }
    }
    await readBalance(address);
  }, [address, balance, readClient, readBalance]);

  // Reconnect silently on reload — but only for the session key, since
  // re-prompting MetaMask on every page load is hostile.
  useEffect(() => {
    const saved = window.localStorage.getItem(KIND_STORAGE) as ConnectorKind | null;
    if (saved === "session") void connectSession();
  }, [connectSession]);

  useEffect(() => {
    if (!address) return;
    const t = setInterval(() => {
      if (document.visibilityState === "visible") void readBalance(address);
    }, 45000);
    return () => clearInterval(t);
  }, [address, readBalance]);

  const value: WalletState = {
    address,
    kind,
    client,
    readClient,
    balance,
    connecting,
    error,
    connect,
    disconnect,
    fund,
    refreshBalance: () => readBalance(address),
    exportKey: () => (typeof window === "undefined" ? null : window.localStorage.getItem(KEY_STORAGE)),
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletState {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside <WalletProvider>");
  return ctx;
}
