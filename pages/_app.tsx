import type { AppProps } from "next/app";
import React from "react";
import { useRouter } from "next/router";
import "../styles/globals.css";

export default function App({ Component, pageProps }: AppProps) {
  const year = new Date().getFullYear();
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-950 to-black text-slate-100">
      <div className="max-w-6xl mx-auto px-4 py-5 flex flex-col min-h-screen">
        <header className="flex items-center justify-between border-b border-slate-800/60 pb-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-rose-500 flex items-center justify-center shadow-lg shadow-amber-500/40">
              <span className="text-xl">🏕️</span>
            </div>
            <div className="leading-tight">
              <h1 className="text-sm font-semibold tracking-[0.2em] uppercase text-amber-200">
                Cabin Trivia
              </h1>
              <p className="text-xs text-slate-400">
                Cozy mountain game night in your browser
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-3 text-xs text-slate-400">
              <span className="cabin-tag">
                <span className="text-emerald-400">●</span> Voice Play
              </span>
              <span className="cabin-tag">
                <span className="text-amber-300">★</span> Party &amp; Competitive
              </span>
            </div>
            <button
              onClick={() => router.push("/mode")}
              className="inline-flex items-center gap-1 rounded-full bg-slate-800/90 px-3 py-1.5 text-[11px] font-medium text-slate-100 hover:bg-slate-700 border border-slate-700/80"
            >
              <span className="text-xs">⟵</span>
              <span>Back to start</span>
            </button>
          </div>
        </header>

        <main className="flex-1 pb-6">
          <Component {...pageProps} />
        </main>

        <footer className="pt-4 border-t border-slate-800/60 text-xs text-slate-500 flex items-center justify-between">
          <span>© {year} Cabin Trivia</span>
          <span className="hidden sm:inline">
            Built for cozy nights, road trips, and friendly competition.
          </span>
        </footer>
      </div>
    </div>
  );
}

