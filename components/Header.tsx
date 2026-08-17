"use client";

import Link from "next/link";
import { useState } from "react";
import { useWallet } from "@/lib/wallet";
import { IS_STUDIO, NETWORK_NAME } from "@/lib/chains";
import { fmtGen, short } from "@/lib/format";

export default function Header() {
  const w = useWallet();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
      setOpen(false);
    }
  };

  return (
    <header className="head pad">
      <div className="brand">
        <Link href="/">GLOSSA</Link>
        <span className="micro faint">{NETWORK_NAME}</span>
      </div>

      <nav className="nav micro">
        <Link href="/">REGISTRY</Link>
        <Link href="/post">COMMISSION</Link>
        <Link href="/about">METHOD</Link>
      </nav>

      <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 10 }}>
        {w.address ? (
          <>
            <span className="micro dim hide-sm">{fmtGen(w.balance)} GEN</span>
            <button className="btn btn-sm" onClick={() => setOpen((v) => !v)}>
              {short(w.address)}
            </button>
          </>
        ) : (
          <button className="btn btn-sm btn-solid" onClick={() => setOpen((v) => !v)} disabled={w.connecting}>
            {w.connecting ? "…" : "Connect"}
          </button>
        )}

        {open && (
          <div
            style={{
              position: "absolute",
              right: 0,
              top: "calc(100% + 10px)",
              width: 320,
              background: "var(--paper)",
              border: "1px solid var(--ink)",
              padding: 16,
              zIndex: 60,
            }}
          >
            {!w.address ? (
              <div className="stack">
                <div className="micro faint">CONNECT</div>
                <button className="btn" style={{ width: "100%" }} onClick={() => run(() => w.connect("session"))} disabled={busy}>
                  Session key
                </button>
                <p className="micro dim" style={{ letterSpacing: "0.06em", lineHeight: 1.7 }}>
                  A keypair generated in this browser. Gasless network, funded from the studio faucet — you can transact in
                  about ten seconds.
                </p>
                <button className="btn" style={{ width: "100%" }} onClick={() => run(() => w.connect("metamask"))} disabled={busy}>
                  MetaMask
                </button>
                <p className="micro dim" style={{ letterSpacing: "0.06em", lineHeight: 1.7 }}>
                  Adds the GenLayer chain and its snap on first use.
                </p>
                {w.error && <div className="note micro" style={{ letterSpacing: "0.06em" }}>{w.error}</div>}
              </div>
            ) : (
              <div className="stack">
                <div className="micro faint">{w.kind === "session" ? "SESSION KEY" : "METAMASK"}</div>
                <div className="mono" style={{ fontSize: 11, wordBreak: "break-all" }}>{w.address}</div>
                <div className="mono" style={{ fontSize: 13 }}>{fmtGen(w.balance)} GEN</div>
                {IS_STUDIO && (
                  <button className="btn" style={{ width: "100%" }} onClick={() => run(w.fund)} disabled={busy}>
                    {busy ? "Funding…" : "Faucet · 50 GEN"}
                  </button>
                )}
                {w.kind === "session" && (
                  <>
                    <button className="btn" style={{ width: "100%" }} onClick={() => setShowKey((v) => !v)}>
                      {showKey ? "Hide private key" : "Reveal private key"}
                    </button>
                    {showKey && (
                      <div className="mono" style={{ fontSize: 10, wordBreak: "break-all", lineHeight: 1.6 }}>
                        {w.exportKey()}
                        <div className="micro faint" style={{ marginTop: 8, letterSpacing: "0.06em" }}>
                          THIS KEY LIVES IN THIS BROWSER ONLY. CLEARING SITE DATA DESTROYS IT AND ANYTHING IT HOLDS.
                        </div>
                      </div>
                    )}
                  </>
                )}
                <button className="btn" style={{ width: "100%" }} onClick={() => { w.disconnect(); setOpen(false); }}>
                  Disconnect
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
