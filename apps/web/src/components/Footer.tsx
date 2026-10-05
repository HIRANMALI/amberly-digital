import React, { useState } from "react";
import { SERVICES } from "@/lib/seo-data";

export function Footer() {
  const [showOptions, setShowOptions] = useState(false);
  const [copied, setCopied] = useState(false);

  React.useEffect(() => {
    if (!showOptions) return;
    const handleOutsideClick = () => setShowOptions(false);
    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, [showOptions]);

  const handleEmailClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowOptions(!showOptions);
  };

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      navigator.clipboard.writeText("hello@amberlydigital.com");
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        setShowOptions(false);
      }, 1500);
    } catch (err) {
      console.warn("Failed to copy email:", err);
    }
  };

  return (
    <footer
      className="bg-[#090D16] text-white pt-16 pb-12 relative overflow-hidden mt-auto border-t-2 border-slate-950"
      id="agency-footer"
    >
      {/* Top Ambient Glow Effect */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-48 bg-gradient-to-b from-amber-500/10 via-amber-500/5 to-transparent pointer-events-none blur-3xl"></div>

      {/* Top Gradient Divider Line */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-400 to-transparent opacity-80"></div>

      <div className="max-w-7xl mx-auto px-6 lg:px-12 relative z-10 pt-4">
        {/* Main 4-Column Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 lg:gap-12 pb-16 border-b border-slate-800/80">
          {/* Column 1: Brand Info & Tech Pills (4 cols) */}
          <div className="lg:col-span-4 flex flex-col gap-4">
            <a href="/" className="flex items-center gap-2 group w-fit">
              <span className="text-2xl font-black tracking-tight uppercase font-display bg-gradient-to-r from-white via-slate-100 to-amber-400 bg-clip-text text-transparent">
                Amberly <span className="text-amber-400">Digital</span>
              </span>
            </a>

            <p className="text-xs text-slate-400 leading-relaxed font-medium mt-1 max-w-sm">
              We design, build, and deploy custom AI agents, voice intelligence, and workflow automations to help scaling businesses run on autopilot.
            </p>

            <div className="flex flex-wrap gap-2 text-[10px] font-mono font-bold uppercase tracking-wider mt-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 text-amber-400">
                <svg
                  className="w-3.5 h-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
                CUSTOM LLMS
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 text-amber-400">
                <svg
                  className="w-3.5 h-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <ellipse cx="12" cy="5" rx="9" ry="3" />
                  <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                  <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
                </svg>
                VECTOR RAG
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 text-amber-400">
                <svg
                  className="w-3.5 h-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="22" />
                </svg>
                VOICE AI
              </span>
            </div>
          </div>

          {/* Column 2: AI Solutions (3 cols) */}
          <div className="lg:col-span-3 flex flex-col gap-4">
            <span className="text-[11px] text-amber-400 font-mono font-black uppercase tracking-widest">
              AI Solutions
            </span>
            <ul className="space-y-3">
              {Object.entries(SERVICES).map(([slug, s]) => (
                <li key={slug}>
                  <a
                    href={`/services/${slug}`}
                    className="text-xs text-slate-400 hover:text-amber-400 transition-all duration-200 font-medium flex items-center gap-2 group hover:translate-x-1"
                  >
                    <span className="text-slate-600 group-hover:text-amber-400 transition-colors">
                      →
                    </span>
                    {s.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3: Navigation (2 cols) */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            <span className="text-[11px] text-amber-400 font-mono font-black uppercase tracking-widest">
              Navigation
            </span>
            <ul className="space-y-3">
              <li>
                <a
                  href="/#capabilities-section"
                  className="text-xs text-slate-400 hover:text-amber-400 transition-all duration-200 font-medium flex items-center gap-2 group hover:translate-x-1"
                >
                  <span className="text-slate-600 group-hover:text-amber-400 transition-colors">
                    →
                  </span>
                  Capabilities
                </a>
              </li>
              <li>
                <a
                  href="/#agency-process"
                  className="text-xs text-slate-400 hover:text-amber-400 transition-all duration-200 font-medium flex items-center gap-2 group hover:translate-x-1"
                >
                  <span className="text-slate-600 group-hover:text-amber-400 transition-colors">
                    →
                  </span>
                  Our Process
                </a>
              </li>
              <li>
                <a
                  href="/#why-choose-us"
                  className="text-xs text-slate-400 hover:text-amber-400 transition-all duration-200 font-medium flex items-center gap-2 group hover:translate-x-1"
                >
                  <span className="text-slate-600 group-hover:text-amber-400 transition-colors">
                    →
                  </span>
                  Why Us
                </a>
              </li>
              <li>
                <a
                  href="/#book-a-call"
                  className="text-xs text-slate-400 hover:text-amber-400 transition-all duration-200 font-medium flex items-center gap-2 group hover:translate-x-1"
                >
                  <span className="text-slate-600 group-hover:text-amber-400 transition-colors">
                    →
                  </span>
                  Book Call
                </a>
              </li>
              <li>
                <a
                  href="/#faq"
                  className="text-xs text-slate-400 hover:text-amber-400 transition-all duration-200 font-medium flex items-center gap-2 group hover:translate-x-1"
                >
                  <span className="text-slate-600 group-hover:text-amber-400 transition-colors">
                    →
                  </span>
                  Founders FAQ
                </a>
              </li>
            </ul>
          </div>

          {/* Column 4: Interactive Contact Card (3 cols) */}
          <div className="lg:col-span-3 flex flex-col gap-4">
            <span className="text-[11px] text-amber-400 font-mono font-black uppercase tracking-widest">
              Direct Contact
            </span>
            <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl flex flex-col gap-3 relative">
              <div className="relative">
                <button
                  onClick={handleEmailClick}
                  className="text-[11px] sm:text-xs text-slate-200 hover:text-amber-400 transition-colors font-mono font-bold cursor-pointer bg-slate-950 border border-slate-800 p-2.5 sm:px-3 sm:py-2.5 rounded-xl w-full flex items-center justify-between gap-2 overflow-hidden"
                >
                  <span className="truncate min-w-0">hello@amberlydigital.com</span>
                  <span className="shrink-0 text-[10px] text-amber-400 font-mono font-bold bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/30">
                    COPY
                  </span>
                </button>

                {showOptions && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="absolute bottom-12 right-0 bg-slate-900 border-2 border-slate-950 p-2 shadow-[4px_4px_0px_0px_rgba(245,158,11,1)] z-20 flex flex-col gap-1.5 w-52 text-left font-mono text-[10px] rounded-xl"
                  >
                    <a
                      href="https://mail.google.com/mail/?view=cm&fs=1&to=hello@amberlydigital.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setShowOptions(false)}
                      className="px-2.5 py-2 hover:bg-slate-800 text-slate-300 hover:text-white font-bold flex items-center gap-2 rounded-lg"
                    >
                      <svg
                        className="w-3.5 h-3.5 text-amber-400"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                      >
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                        <polyline points="22,6 12,13 2,6" />
                      </svg>
                      OPEN IN GMAIL
                    </a>
                    <button
                      onClick={handleCopy}
                      className="w-full text-left px-2.5 py-2 hover:bg-slate-800 text-slate-300 hover:text-white font-bold flex items-center gap-2 cursor-pointer rounded-lg"
                    >
                      {copied ? (
                        <>
                          <svg
                            className="w-3.5 h-3.5 text-emerald-400"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          ADDRESS COPIED!
                        </>
                      ) : (
                        <>
                          <svg
                            className="w-3.5 h-3.5 text-amber-400"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                          >
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                          </svg>
                          COPY TO CLIPBOARD
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                <span>Response SLA: Under 12 Hours</span>
              </span>
            </div>
          </div>
        </div>

        {/* Bottom Legal & Copyright Bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-slate-500">
          <p>© {new Date().getFullYear()} Amberly Digital. All rights reserved.</p>

          <div className="flex items-center gap-6 font-medium text-[11px]">
            <a href="/#faq" className="hover:text-slate-300 transition-colors">
              Privacy & Data Policy
            </a>
            <span className="text-slate-800">•</span>
            <a href="/#faq" className="hover:text-slate-300 transition-colors">
              IP & Code Ownership
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
