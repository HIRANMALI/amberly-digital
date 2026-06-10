"use client";

import React, { useState } from "react";

export function ValuationCalculatorMinimal() {
  const [missedCalls, setMissedCalls] = useState(3);
  const jobValue = 750;
  const weeklyLoss = missedCalls * jobValue;
  const monthlyLoss = weeklyLoss * 4;
  const yearlyLoss = weeklyLoss * 52;

  return (
    <div className="bg-white max-w-2xl mx-auto">
      {/* Input */}
      <div className="mb-8">
        <label className="block text-xs font-mono font-bold text-slate-500 uppercase tracking-widest mb-4">
          How many calls do you miss per week?
        </label>

        <div className="flex items-center gap-6 mb-3">
          <span className="text-5xl font-black font-mono text-slate-950 w-16 shrink-0 tabular-nums">
            {missedCalls}
          </span>
          <input
            type="range"
            min={1}
            max={20}
            value={missedCalls}
            onChange={(e) => setMissedCalls(Number(e.target.value))}
            className="flex-1 h-1 bg-slate-200 accent-amber-500 cursor-pointer appearance-none rounded-full"
          />
          <span className="text-xs font-mono text-slate-400 w-6 shrink-0">20</span>
        </div>

        <div className="flex justify-between text-[11px] font-mono text-slate-400">
          <span>1 call</span>
          <span>10 calls</span>
          <span>20 calls</span>
        </div>
      </div>

      {/* Results */}
      <div className="border-t border-slate-100 pt-8 space-y-4">
        <div className="flex items-center justify-between py-4 border-b border-slate-100">
          <span className="text-sm text-slate-500 font-medium">Lost per week</span>
          <span className="text-2xl font-black font-mono text-slate-950">
            ${weeklyLoss.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center justify-between py-4 border-b border-slate-100">
          <span className="text-sm text-slate-500 font-medium">Lost per month</span>
          <span className="text-2xl font-black font-mono text-slate-950">
            ${monthlyLoss.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center justify-between py-4 bg-amber-50 px-5 -mx-5">
          <div>
            <span className="text-sm font-bold text-slate-800">Lost per year</span>
            <p className="text-xs text-slate-500 mt-0.5">Going to competitors. Right now.</p>
          </div>
          <span className="text-3xl font-black font-mono text-amber-600">
            ${yearlyLoss.toLocaleString()}
          </span>
        </div>
      </div>

      <p className="text-xs text-slate-400 mt-6 leading-relaxed">
        Based on the Australian median emergency plumbing rate of <strong className="text-slate-600">$750 AUD</strong> per job. 62% of callers who reach voicemail don&apos;t call back.
      </p>

      <a
        href="/#onboarding-form"
        className="mt-8 flex items-center justify-center w-full bg-amber-500 hover:bg-slate-950 hover:text-white text-slate-950 font-black py-4 text-xs tracking-widest uppercase transition-all"
      >
        Stop the Leak — Book a Free Audit
      </a>
    </div>
  );
}
