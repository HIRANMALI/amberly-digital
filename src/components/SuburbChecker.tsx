"use client";

import React, { useState } from "react";
import { Search, Loader2, ShieldCheck, ShieldAlert, X } from "lucide-react";

export function SuburbChecker() {
  const [businessName, setBusinessName] = useState("");
  const [websiteInput, setWebsiteInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "low" | "high" | "pass">("idle");
  const [resultWebsite, setResultWebsite] = useState("");
  const [resultBusiness, setResultBusiness] = useState("");
  const [resultHeadline, setResultHeadline] = useState("");
  const [resultDescription, setResultDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showQuotaModal, setShowQuotaModal] = useState(false);

  const handleCloseModal = () => setShowQuotaModal(false);
  const handleTalkToTeam = () => {
    setShowQuotaModal(false);
    const element = document.getElementById("onboarding-form");
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleWebsiteChange = (val: string) => {
    setWebsiteInput(val);
    if (error) setError(null);
    if (status !== "idle") setStatus("idle");
  };

  const handleBusinessChange = (val: string) => {
    setBusinessName(val);
    if (error) setError(null);
    if (status !== "idle") setStatus("idle");
  };

  const handleCheck = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!websiteInput.trim()) return;

    setLoading(true);
    setStatus("idle");
    setError(null);

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("creditsUpdated"));
    }

    const startTime = Date.now();

    try {
      const response = await fetch("/api/verify-domain", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          websiteUrl: websiteInput.trim(),
          businessName: businessName.trim()
        }),
      });

      const data = await response.json();

      // Ensure loader runs for at least 1200ms for premium UX feel
      const elapsedTime = Date.now() - startTime;
      const delayRemaining = Math.max(0, 1200 - elapsedTime);
      await new Promise((resolve) => setTimeout(resolve, delayRemaining));

      if (data.success) {
        setResultWebsite(data.domain);
        setResultBusiness(businessName.trim() || "Your Business");
        setStatus(data.status);
        setResultHeadline(data.headline);
        setResultDescription(data.description);
        
        if (typeof data.used === "number") {
          localStorage.setItem("ai_credits_used", String(data.used));
          document.querySelectorAll(".credits-counter").forEach((el) => {
            el.textContent = String(data.used);
          });
        }

        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("creditsUpdated", { detail: { used: data.used } }));
        }
      } else {
        if (data.error && (data.error.includes("limit") || data.error.includes("exceeded"))) {
          setShowQuotaModal(true);
        } else {
          setError(data.error || "Could not verify website.");
        }
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("creditsUpdated"));
        }
      }
    } catch (err) {
      setError("An error occurred while connecting to the server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full bg-slate-900 text-white p-8 lg:p-10 relative overflow-hidden border-2 border-slate-950 min-h-[440px]">
      <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      
      <div className="relative space-y-6">
        <div>
          <h3 className="text-2xl sm:text-3xl font-display font-black uppercase leading-tight text-white">
            Scan Your Website
          </h3>
          <p className="text-sm text-slate-300 mt-3 leading-relaxed">
            Get an AI-powered scan on how search engines and AI assistants (like ChatGPT & Gemini) read your business.
          </p>
        </div>

        {/* Checker form */}
        <form onSubmit={handleCheck} className="space-y-4">
          <div className="space-y-3">
            <div>
              <input
                type="text"
                placeholder="Your Business Name"
                value={businessName}
                onChange={(e) => handleBusinessChange(e.target.value)}
                className="w-full bg-slate-950 border-2 border-slate-800 p-3.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500 font-bold rounded-none"
              />
            </div>
            
            <div>
              <input
                type="text"
                placeholder="Your Website URL"
                value={websiteInput}
                onChange={(e) => handleWebsiteChange(e.target.value)}
                className="w-full bg-slate-950 border-2 border-slate-800 p-3.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500 font-bold rounded-none"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-amber-500 hover:bg-[#f7ab1a] text-slate-950 font-black py-4 rounded-none text-xs tracking-widest uppercase transition-all shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] hover:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] hover:translate-x-[2px] hover:translate-y-[2px] flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Scanning...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>Scan My Website</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Scan Result or Error state */}
        {(loading || status !== "idle" || error) && (
          <div className="relative min-h-[185px] flex items-center justify-center border-2 border-slate-800 bg-slate-950/80 p-6 rounded-none animate-fade-in">
            {loading && (
              <div className="text-center space-y-2">
                <Loader2 className="w-6 h-6 animate-spin text-amber-500 mx-auto" />
                <p className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">Scanning website SEO & performance...</p>
              </div>
            )}

            {!loading && error && (
              <div className="space-y-4 w-full">
                <div className="flex gap-3 items-start">
                  <ShieldAlert className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[9px] font-mono font-black text-rose-500 bg-rose-500/10 px-2 py-0.5 border border-rose-500/20 uppercase tracking-wider">
                      Verification Failed
                    </span>
                    <h4 className="text-xs font-bold uppercase text-white mt-1">
                      Invalid Website Domain
                    </h4>
                    <p className="text-[10px] text-slate-350 mt-1 leading-relaxed">
                      {error}
                    </p>
                    {error && error.includes("taking too long") && (
                      <p className="text-[10px] text-amber-500 font-bold mt-2 leading-relaxed border-t border-slate-800/60 pt-2">
                        💡 Note: If your site is live but you see this repeatedly, it points to a major loading speed delay. A slow site hurts visitor conversions and search rankings—this needs to be fixed immediately.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {!loading && !error && status !== "idle" && (
              <div className="space-y-4 w-full">
                <div className="border-b border-slate-800/60 pb-3">
                  {status === "low" && (
                    <div className="flex gap-3 items-start">
                      <ShieldAlert className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-[9px] font-mono font-black text-rose-500 bg-rose-500/10 px-2 py-0.5 border border-rose-500/20 uppercase tracking-wider">
                          Essential Upgrades Needed
                        </span>
                        <h4 className="text-xs font-bold uppercase text-white mt-1">
                          {resultHeadline}
                        </h4>
                        <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                          {resultDescription}
                        </p>
                      </div>
                    </div>
                  )}
                  {status === "high" && (
                    <div className="flex gap-3 items-start">
                      <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-[9px] font-mono font-black text-amber-500 bg-amber-500/10 px-2 py-0.5 border border-amber-500/20 uppercase tracking-wider">
                          Growth Opportunities
                        </span>
                        <h4 className="text-xs font-bold uppercase text-white mt-1">
                          {resultHeadline}
                        </h4>
                        <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                          {resultDescription}
                        </p>
                      </div>
                    </div>
                  )}
                  {status === "pass" && (
                    <div className="flex gap-3 items-start">
                      <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-[9px] font-mono font-black text-emerald-500 bg-emerald-500/10 px-2 py-0.5 border border-emerald-500/20 uppercase tracking-wider">
                          Stellar Digital Readiness
                        </span>
                        <h4 className="text-xs font-bold uppercase text-white mt-1">
                          {resultHeadline}
                        </h4>
                        <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                          {resultDescription}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Quota Exceeded Modal */}
      {showQuotaModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900 border-4 border-slate-950 p-8 max-w-md w-full text-white shadow-[8px_8px_0px_0px_rgba(245,158,11,1)] relative space-y-6">
            <button 
              onClick={handleCloseModal}
              className="absolute top-4 right-4 text-slate-400 hover:text-white border-2 border-slate-800 hover:border-slate-400 p-1 cursor-pointer bg-slate-950"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex gap-4 items-start">
              <div className="w-12 h-12 bg-amber-500/10 border-2 border-amber-500 text-amber-500 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div className="space-y-2">
                <span className="text-[9px] font-mono font-black text-amber-500 bg-amber-500/10 px-2 py-0.5 border border-amber-500/20 uppercase tracking-wider">
                  Scan limit reached
                </span>
                <h3 className="text-xl font-display font-black uppercase tracking-tight text-white mt-1">
                  Weekly Quota Exceeded
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed pt-1">
                  You have used all 5 of your free AI website scans for this week. Quotas reset rolling weekly per IP to ensure fair performance.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={handleTalkToTeam}
                className="flex-1 bg-amber-500 hover:bg-[#f7ab1a] text-slate-950 font-black py-3 px-4 border-2 border-slate-950 shadow-[3px_3px_0px_0px_rgba(255,255,255,1)] hover:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] hover:translate-x-[1px] hover:translate-y-[1px] text-xs uppercase tracking-wider transition-all text-center cursor-pointer"
              >
                Talk to our Team
              </button>
              <button
                onClick={handleCloseModal}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-black py-3 px-4 border-2 border-slate-950 text-xs uppercase tracking-wider transition-all text-center cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
