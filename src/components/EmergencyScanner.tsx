"use client";

import React, { useState } from "react";
import { Search, Loader2, ShieldAlert, CheckCircle, RefreshCw, Zap, TrendingUp, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import type { ScanResult } from "@/types/index";

export function EmergencyScanner() {
  const [businessName, setBusinessName] = useState("");
  const [suburb, setSuburb] = useState("Richmond VIC");
  const [specialty, setSpecialty] = useState("Emergency Pipe Burst & Hot Water");
  const [loading, setLoading] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState("");

  const presetSuburbs = [
    "Richmond VIC",
    "Bondi NSW",
    "Parramatta NSW",
    "Coorparoo QLD",
    "Fremantle WA",
    "Surry Hills NSW"
  ];

  const specialtyOptions = [
    "Emergency Pipe Burst & Hot Water",
    "Blocked Sewer & CCTV Drain Survey",
    "24/7 Leak Detection & Gas Repair",
    "General Emergency Maintenance"
  ];

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!suburb) {
      setError("Please select or type an Australian suburb.");
      return;
    }

    setLoading(true);
    setError("");
    setScanResult(null);

    try {
      const response = await fetch("/api/emergency-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: businessName || "Your Plumbing Business",
          suburb,
          primarySpecialty: specialty
        })
      });

      if (!response.ok) {
        throw new Error("Local SEO scan server returned an error.");
      }

      const data = await response.json();
      setScanResult(data);
    } catch (err) {
      console.error(err);
      setError("Unable to process the local scanner scan right now. Please try again.");
    } finally {
      setTimeout(() => {
        setLoading(false);
      }, 800);
    }
  };

  return (
    <div className="bg-white border-2 border-slate-950 p-6 sm:p-10 shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] rounded-none relative overflow-hidden" id="aeo-scanner-widget">
      {/* Decorative clean outline */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-none pointer-events-none border-b border-l border-slate-100" />

      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-900 px-3 py-1 rounded-none text-xs font-mono mb-3 uppercase tracking-widest border border-amber-300 font-bold">
            <Zap className="w-3.5 h-3.5 fill-current text-amber-600" /> Australia-Wide Local SEO & AEO Analysis
          </div>
          <h3 className="text-3xl sm:text-4xl font-display font-black text-slate-900 tracking-tight uppercase">
            Emergency Search Visibility Scan
          </h3>
          <p className="text-slate-600 mt-2 text-sm sm:text-base font-medium max-w-xl mx-auto">
            Find out exactly how your plumbing business ranks on the high-intent Google Map Pack, and whether ChatGPT or Claude recommends your service right now.
          </p>
        </div>

        <form onSubmit={handleScan} className="space-y-6 bg-slate-50 p-4 sm:p-8 rounded-none border border-slate-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Business Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-widest mb-2">
                Your Registered Business Name
              </label>
              <input
                type="text"
                placeholder="e.g. Richmond 24/7 Drains"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full bg-white border-2 border-slate-900 p-3.5 rounded-none text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 transition-all font-medium"
              />
            </div>

            {/* Suburb Target */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-widest mb-2">
                Target Suburb / Trade Territory
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="e.g. Richmond VIC or Bondi NSW"
                  value={suburb}
                  onChange={(e) => setSuburb(e.target.value)}
                  className="w-full bg-white border-2 border-slate-900 p-3.5 rounded-none text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 transition-all font-medium"
                  required
                />
                <Search className="absolute right-4 top-4 text-slate-400 w-5 h-5 pointer-events-none" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Services Option */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-widest mb-2">
                Core High-Paying Emergency Focus
              </label>
              <select
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                className="w-full bg-white border-2 border-slate-900 p-3.5 rounded-none text-sm text-slate-900 focus:outline-none focus:border-amber-500 transition-all cursor-pointer font-bold"
              >
                {specialtyOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            {/* Preset suburbs quick clicks */}
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-2">
                Quick-Select Target Localities
              </label>
              <div className="flex flex-wrap gap-2">
                {presetSuburbs.map((sub) => (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => setSuburb(sub)}
                    className={`text-xs px-3 py-1.5 rounded-none border-2 font-bold transition-all ${
                      suburb === sub
                        ? "bg-amber-500 border-slate-950 text-slate-950 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                        : "bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-400"
                    }`}
                  >
                    {sub}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-slate-900 hover:bg-amber-500 hover:text-slate-950 text-white font-black py-4 px-6 rounded-none text-sm transition-all flex items-center justify-center gap-3 uppercase tracking-wider cursor-pointer border-2 border-slate-900 shadow-[4px_4px_0px_0px_rgba(245,158,11,1)] active:translate-x-0.5 active:translate-y-0.5"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Crunching Google Maps APIs & AEO Indexes...
              </>
            ) : (
              <>
                <Search className="w-4 h-4" /> Run Australia Emergency Visibility Scan
              </>
            )}
          </button>
        </form>

        {error && (
          <div className="mt-4 p-4 bg-rose-50 border-2 border-rose-900 text-rose-900 text-sm flex items-center gap-2 rounded-none font-bold">
            <ShieldAlert className="w-5 h-5 shrink-0 text-rose-700" />
            <span>{error}</span>
          </div>
        )}

        <AnimatePresence mode="wait">
          {loading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-6 p-12 text-center border-2 border-dashed border-slate-300 rounded-none bg-slate-50"
            >
              <Loader2 className="w-8 h-8 animate-spin text-amber-600 mx-auto mb-4" />
              <p className="text-slate-900 font-bold uppercase tracking-wider text-sm">Evaluating live SEO listings for {suburb}...</p>
              <p className="text-xs text-slate-500 mt-2 max-w-md mx-auto">
                Comparing Google Business profile proximity, review generation speed, and schema-enabled search query alignments.
              </p>
            </motion.div>
          )}

          {!loading && scanResult && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mt-8 space-y-6"
            >
              <div className="bg-white border-2 border-slate-900 rounded-none p-5 sm:p-8 shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] space-y-6">
                
                {/* Metric Summary Title */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b-2 border-slate-100">
                  <div>
                    <span className="text-[10px] font-mono font-black text-amber-600 uppercase tracking-widest">LOCAL RANKING SCORECARD</span>
                    <h4 className="text-2xl font-display font-black text-slate-900 flex items-center gap-2">
                      📍 {scanResult.suburbName} <span className="text-xs bg-slate-100 text-slate-700 border border-slate-200 font-bold px-2 py-0.5 rounded-none uppercase">Aussie Suburb Code</span>
                    </h4>
                  </div>
                  
                  <div className="bg-slate-50 border-2 border-slate-900 rounded-none px-4 py-3 flex items-center gap-2.5">
                    <TrendingUp className="text-emerald-600 w-5 h-5" />
                    <div>
                      <div className="text-[9px] text-slate-500 font-bold uppercase tracking-widest leading-none">EST. MONTHLY LOCAL SEARCHES</div>
                      <div className="text-base font-black text-slate-900 font-mono">{scanResult.suburbStats.monthlyEmergencySearches} Urgencies / mo</div>
                    </div>
                  </div>
                </div>

                {/* Scorecard Bars with Bold Borders */}
                <div>
                  <h5 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-4 flex items-center gap-1.5">
                    <span>⚡ Key Lead-Gen Diagnostic Scorecard</span>
                  </h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    
                    {/* Progress 1 */}
                    <div className="bg-slate-50 p-4 border border-slate-200 rounded-none shadow-sm">
                      <div className="flex justify-between text-xs mb-2">
                        <span className="text-slate-800 font-bold uppercase tracking-wider">Google Business Profile Rank</span>
                        <span className="font-mono font-black text-amber-600">
                          {scanResult.scorecard.googleLocalPack}/100
                        </span>
                      </div>
                      <div className="h-2.5 w-full bg-slate-200 rounded-none overflow-hidden">
                        <div 
                          className="h-full bg-amber-500 transition-all duration-1000"
                          style={{ width: `${scanResult.scorecard.googleLocalPack}%` }}
                        />
                      </div>
                    </div>

                    {/* Progress 2 */}
                    <div className="bg-slate-50 p-4 border border-slate-200 rounded-none shadow-sm">
                      <div className="flex justify-between text-xs mb-2">
                        <span className="text-slate-800 font-bold uppercase tracking-wider">ChatGPT Answer Grounding</span>
                        <span className="font-mono font-black text-rose-600">
                          {scanResult.scorecard.chatgptAeoVisibility}/100
                        </span>
                      </div>
                      <div className="h-2.5 w-full bg-slate-200 rounded-none overflow-hidden">
                        <div 
                          className="h-full bg-rose-500 transition-all duration-1000"
                          style={{ width: `${scanResult.scorecard.chatgptAeoVisibility}%` }}
                        />
                      </div>
                    </div>

                    {/* Progress 3 */}
                    <div className="bg-slate-50 p-4 border border-slate-200 rounded-none shadow-sm">
                      <div className="flex justify-between text-xs mb-2">
                        <span className="text-slate-800 font-bold uppercase tracking-wider">Mobile Conversions Lead Speed</span>
                        <span className="font-mono font-black text-slate-900">
                          {scanResult.scorecard.mobileLeadConversion}/100
                        </span>
                      </div>
                      <div className="h-2.5 w-full bg-slate-200 rounded-none overflow-hidden">
                        <div 
                          className="h-full bg-slate-900 transition-all duration-1000"
                          style={{ width: `${scanResult.scorecard.mobileLeadConversion}%` }}
                        />
                      </div>
                    </div>

                    {/* Progress 4 */}
                    <div className="bg-slate-50 p-4 border border-slate-200 rounded-none shadow-sm">
                      <div className="flex justify-between text-xs mb-2">
                        <span className="text-slate-800 font-bold uppercase tracking-wider">Local Review Velocity Density</span>
                        <span className="font-mono font-black text-slate-900">
                          {scanResult.scorecard.citationVelocity}/100
                        </span>
                      </div>
                      <div className="h-2.5 w-full bg-slate-200 rounded-none overflow-hidden">
                        <div 
                          className="h-full bg-slate-700 transition-all duration-1000"
                          style={{ width: `${scanResult.scorecard.citationVelocity}%` }}
                        />
                      </div>
                    </div>

                  </div>
                </div>

                {/* ChatGPT / Core AEO Simulation */}
                <div className="bg-slate-50 border-2 border-slate-950 rounded-none p-4 sm:p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="w-2.5 h-2.5 bg-rose-500 rounded-full animate-pulse" />
                    <span className="text-xs font-mono uppercase tracking-widest text-rose-700 font-black">
                      CRITICAL CALLOUT: ChatGPT Voice / Search Lead Simulation
                    </span>
                  </div>
                  
                  <div className="space-y-4 font-mono text-xs">
                    <div className="bg-white border border-slate-200 p-3.5 rounded-none">
                      <div className="text-slate-400 text-[10px] uppercase font-bold tracking-widest mb-1">Local Voice Prompt Query:</div>
                      <p className="text-slate-950 italic font-sans font-medium">"{scanResult.aeoPreview.userQuery}"</p>
                    </div>

                    <div className="bg-white border border-slate-200 p-3.5 rounded-none relative">
                      <span className="absolute top-0 right-0 px-2 py-0.5 bg-amber-100 text-amber-800 text-[9px] font-bold uppercase tracking-widest border-l border-b border-slate-200">ChatGPT Answer Mock</span>
                      <div className="text-slate-400 text-[10px] uppercase font-bold tracking-widest mb-1">Generated Response:</div>
                      <p className="text-slate-800 font-sans leading-relaxed">{scanResult.aeoPreview.chatgptResponseSimulation}</p>
                    </div>

                    <div className="p-4 bg-rose-50 border border-slate-200 rounded-none flex gap-3">
                      <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-rose-900 font-black text-[10px] uppercase tracking-wider">YOUR REVENUE LEAK REASON:</div>
                        <p className="text-slate-700 text-xs mt-1 font-sans leading-relaxed font-semibold">{scanResult.aeoPreview.criticalAeoGap}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Road Maps & Savings */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                  
                  {/* Quick wins list */}
                  <div className="bg-slate-50 p-5 border border-slate-200 rounded-none flex flex-col justify-between">
                    <div>
                      <h6 className="text-xs font-mono uppercase tracking-widest text-slate-900 font-black mb-4 flex items-center gap-2 border-b border-slate-200 pb-2">
                        <CheckCircle className="w-4 h-4 text-amber-500 fill-current" /> 14-Day Amberly Digital Road Map
                      </h6>
                      <ul className="space-y-3">
                        {scanResult.quickWins.map((win, idx) => (
                          <li key={idx} className="text-xs text-slate-700 flex items-start gap-2.5 font-medium">
                            <span className="w-1.5 h-1.5 bg-slate-900 rounded-full shrink-0 mt-1.5" />
                            <span>{win}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Financial projections */}
                  <div className="bg-slate-50 p-5 border border-slate-200 rounded-none flex flex-col justify-between space-y-4">
                    <div>
                      <h6 className="text-xs font-mono uppercase tracking-widest text-slate-900 font-black mb-4 flex items-center gap-2 border-b border-slate-200 pb-2">
                        <TrendingUp className="w-4 h-4 text-amber-600" /> Sydney & Melbourne Trade Financial Projections
                      </h6>
                      <div className="space-y-3.5">
                        <div className="bg-white p-3 border border-slate-200">
                          <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Wasted Emergency Pay-Per-Click Google Budget</div>
                          <div className="text-base font-black text-rose-600 font-mono mt-1">{scanResult.savingsEstimation.wastedPpcBudget}</div>
                        </div>
                        <div className="bg-white p-3 border border-slate-200">
                          <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Estimated Organic High-Intent Calls Captured</div>
                          <div className="text-base font-black text-emerald-600 font-mono mt-1">{scanResult.savingsEstimation.potentialOrganicLeads}</div>
                        </div>
                      </div>
                    </div>

                    <a 
                      href="#onboarding-form"
                      className="inline-flex items-center justify-center gap-2 bg-amber-500 hover:bg-slate-900 hover:text-white text-slate-950 font-black py-3 px-4 rounded-none text-xs transition-all text-center uppercase tracking-widest border-2 border-slate-950 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-none"
                    >
                      Apply for Visibility Onboarding
                    </a>
                  </div>

                </div>

              </div>

              {/* Bottom reassuring stat */}
              <div className="text-center p-4 bg-amber-50 border border-amber-200 rounded-none max-w-2xl mx-auto flex items-center justify-center gap-2">
                <span className="w-2 h-2 bg-emerald-600 rounded-full shrink-0" />
                <span className="text-xs text-slate-700 font-medium">
                  Amberly Digital secures top emergency map presence in Australian search nodes within <strong className="text-slate-900 underline decoration-amber-500 font-bold">21 days or less</strong>.
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
