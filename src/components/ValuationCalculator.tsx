"use client";

import React, { useState } from "react";
import { ShieldCheck } from "lucide-react";

export function ValuationCalculator() {
  const [estimateCalls, setEstimateCalls] = useState(5);
  const [estimatedIncome, setEstimatedIncome] = useState(3750); // 5 missed calls x $750 service call rate

  const handleCallsChange = (val: number) => {
    setEstimateCalls(val);
    setEstimatedIncome(val * 750);
  };

  return (
    <div className="lg:col-span-5 bg-slate-900 text-white p-8 lg:p-12 flex flex-col justify-between relative overflow-hidden">
      <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      
      <div className="relative">
        <div className="inline-flex items-center gap-1.5 text-xs text-amber-400 font-mono font-black uppercase tracking-widest mb-4">
          <ShieldCheck className="w-4 h-4" /> Leakage Business Calculator
        </div>
        <h3 className="text-2xl font-display font-black uppercase leading-tight text-white">
          How many emergency calls did you miss this week?
        </h3>
        <p className="text-xs text-slate-300 mt-2 leading-relaxed">
          When customers need urgent assistance, search engines recommend nearest local services instantly on mobile. If you are busy on a job, with a client, or driving and can't answer, they hire the next competitor in seconds.
        </p>

        {/* Slider Input */}
        <div className="mt-8 space-y-4">
          <div className="flex justify-between items-center bg-slate-950/80 p-3.5 border border-slate-800 rounded-none">
            <span className="text-xs font-mono font-bold uppercase text-slate-400">Missed Phone Calls Weekly:</span>
            <span className="text-lg font-mono font-black text-amber-400">{estimateCalls} Calls</span>
          </div>
          
          <input
            type="range"
            min="1"
            max="20"
            value={estimateCalls}
            onChange={(e) => handleCallsChange(Number(e.target.value))}
            className="w-full h-2.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
          />
          
          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>1 MISSED CALL</span>
            <span>10 CALLS</span>
            <span>20 CALLS</span>
          </div>
        </div>

        {/* Estimated Lost Revenue Return Output */}
        <div className="mt-8 bg-slate-950 p-6 border-2 border-slate-800 rounded-none relative">
          <div className="absolute top-0 right-0 bg-rose-500 text-slate-950 p-1 text-[8px] font-mono font-black uppercase tracking-wider">
            Leaked Profit
          </div>
          <div className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">MINIMUM REVENUE LEAKED TO COMPETITORS</div>
          <div className="text-2xl font-mono font-black text-rose-500 mt-2">
            ${estimatedIncome.toLocaleString()} <span className="text-xs font-sans text-slate-400 font-normal">/ week</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
            Based on standard median emergency service pricing of <strong className="text-white text-xs">$750</strong> (e.g. electrical hazards, emergency locksmith lockouts, or high-value residential repairs).
          </p>
        </div>
      </div>

      <div className="mt-8 pt-6 border-t border-slate-800 flex items-center justify-between">
        <div>
          <span className="text-[9px] text-slate-500 font-mono uppercase tracking-wider block">EXCLUSIVE NSW/VIC/QLD AGENCY</span>
          <span className="text-xs text-slate-300 font-bold uppercase tracking-wider">Amberly Digital</span>
        </div>
        <div className="text-right flex items-center gap-1.5">
          <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
          <span className="text-xs font-mono text-emerald-400 font-black">● GBP INDEX active</span>
        </div>
      </div>

    </div>
  );
}
