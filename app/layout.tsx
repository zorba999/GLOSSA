import type { Metadata } from "next";
import { Inter_Tight, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { WalletProvider } from "@/lib/wallet";
import Header from "@/components/Header";
import Marquee from "@/components/Marquee";

const display = Inter_Tight({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-display",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "GLOSSA — adjudication for languages nobody audits",
  description:
    "Escrowed translation work for rare language pairs, settled by a validator jury on GenLayer. The buyer does not have to read the language they paid for.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${mono.variable}`}>
      <body>
        <WalletProvider>
          <div className="shell">
            <Header />
            <main style={{ flex: 1 }}>{children}</main>
            <footer className="rule-t">
              <Marquee
                items={[
                  "GLOSSA",
                  "ADJUDICATION FOR LANGUAGES NOBODY AUDITS",
                  "TIGRINYA",
                  "FAROESE",
                  "QUECHUA",
                  "AYMARA",
                  "SÁMI",
                  "TOK PISIN",
                  "ROMANSH",
                  "DHIVEHI",
                ]}
              />
              <div
                className="pad micro dim"
                style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "18px var(--gutter)", flexWrap: "wrap" }}
              >
                <span>BUILT ON GENLAYER — INTELLIGENT CONTRACTS</span>
                <span>NOT A MARKETPLACE. A VERDICT LAYER.</span>
              </div>
            </footer>
          </div>
        </WalletProvider>
      </body>
    </html>
  );
}
