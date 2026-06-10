"use client";

import React, { useState, useEffect } from "react";
import { 
  MapPin, 
  Sparkles, 
  Send,
  RefreshCw,
  BellRing
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import type { SimulationLead } from "@/types/index";

export function LeadCommandCenter() {
  const [activeTab, setActiveTab] = useState<"leads" | "rankings" | "sms-tester">("leads");
  
  // Real-time simulated leads state
  const [leads, setLeads] = useState<SimulationLead[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [systemLogs, setSystemLogs] = useState<string[]>([
    "System Booted: Aussie SEO & AEO tracking listener active.",
    "Awaiting emergency leads from localized Google Map packs...",
  ]);

  // SMS Tester State
  const [smsInput, setSmsInput] = useState("");
  const [smsChat, setSmsChat] = useState<Array<{ sender: "customer" | "bot"; message: string; time: string }>>([
    {
      sender: "customer",
      message: "Hey, my kitchen sink valve just burst and is spraying water everywhere! Can you come out to Richmond in 30 mins?",
      time: "Just now"
    },
    {
      sender: "bot",
      message: "🔴 [Instant TradieBot response] G'day! Understood, active plumbing leak in Richmond VIC. Yes, we are available. What is your address? I can dispatch our on-call plumber immediately.",
      time: "1 sec ago"
    }
  ]);
  const [sendingSms, setSendingSms] = useState(false);

  // Fetch initial leads from the Route Handler API
  const fetchLeads = async () => {
    setLoadingLeads(true);
    try {
      const response = await fetch("/api/demo-leads");
      if (response.ok) {
        const data = await response.json();
        setLeads(data);
      }
    } catch (err) {
      console.error("Error loading leads:", err);
    } finally {
      setLoadingLeads(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  // Simulating real-time interval log updates in typical Aussie plumbers localities
  useEffect(() => {
    const logs = [
      "GBP Geotagged Image uploaded: 'Parramatta Gas Valve repair' syndicate completed.",
      "AEO Grounding Refresh: ChatGPT maps crawler validated your emergency plumbers license schema.",
      "Local Citation matched: TrueLocal indexing verified for Bondi NSW emergency terms.",
      "Rank Alert: Plumber keyword 'Burst pipe leak Sydney' gained +3 slots in Local Pack.",
      "Enquiry Caught: Customer searched Siri for 'hot water system replacement near Richmond'."
    ];

    const interval = setInterval(() => {
      const randomLog = logs[Math.floor(Math.random() * logs.length)];
      setSystemLogs(prev => [randomLog, ...prev.slice(0, 4)]);
    }, 12000);

    return () => clearInterval(interval);
  }, []);

  // SMS chat bot logic simulator
  const handleSmsSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!smsInput.trim()) return;

    const userMsg = smsInput;
    setSmsChat(prev => [...prev, { sender: "customer", message: userMsg, time: "Now" }]);
    setSmsInput("");
    setSendingSms(true);

    // Simulate instant 1s AI response
    setTimeout(() => {
      let botResponse = "🔴 [TradieBot Response] G'day! Thanks for the details. I've locked you in for immediate priority response. Our emergency plumber will text you on this mobile with their live ETA within 2 minutes. Stay safe!";
      
      const lower = userMsg.toLowerCase();
      if (lower.includes("price") || lower.includes("cost") || lower.includes("call out")) {
        botResponse = "🔴 [TradieBot Response] No callout fees apply for bookings made in our current active target hour. Standard emergency service rates apply cleanly with a fixed arrival window. Can you confirm your phone number?";
      } else if (lower.includes("address") || lower.includes("street")) {
        botResponse = "🔴 [TradieBot Response] Perfect. Dispatch logged. Generating job #8291. Plumber is preparing gear and driving to your site with a CCTV drain camera and jetter now.";
      }

      setSmsChat(prev => [...prev, { sender: "bot", message: botResponse, time: "Now" }]);
      setSendingSms(false);
    }, 1000);
  };

  // Simulated keyword list
  const simulatedKeywords = [
    { keyword: "Emergency plumber Richmond", packRank: "Rank #1", aeoRank: "ChatGPT Suggested Primary", traffic: "High Volume", delta: "+2 slots" },
    { keyword: "Leak detection Surry Hills NSW", packRank: "Rank #2", aeoRank: "Grounding verified", traffic: "Medium", delta: "Steady" },
    { keyword: "24 hour plumber Bondi", packRank: "Rank #1", aeoRank: "First Assistant Recommendation", traffic: "Extremely High", delta: "+4 slots" },
    { keyword: "Burst water heater Parramatta", packRank: "Rank #3", aeoRank: "Top AI response list", traffic: "High Volume", delta: "+1 slot" },
    { keyword: "CCTV drain jetting Fremantle WA", packRank: "Rank #2", aeoRank: "Grounding verified", traffic: "Steady", delta: "No Change" },
  ];

  return (
    <div className="bg-white border-2 border-slate-950 overflow-hidden shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] rounded-none relative" id="command-center-widget">
      
      {/* Visual Header Panel mimicking Geometric Balance style */}
      <div className="bg-slate-900 p-6 sm:p-8 border-b-2 border-slate-950 flex flex-col lg:flex-row lg:items-center justify-between gap-6 text-white">
        <div className="flex items-center gap-4">
          <div className="bg-amber-500 text-slate-950 p-3 rounded-none font-black text-xl border border-slate-950">
            A
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-xl font-display font-black tracking-tight uppercase">
                Aussie Tradie Lead Command Center™ Grid
              </h4>
              <span className="text-[10px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-none font-bold uppercase tracking-widest">
                ● Live Simulator
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 font-medium">
              See how Amberly Digital routes pre-screened search leads and chat engine referrers to plumbers.
            </p>
          </div>
        </div>

        {/* Tab Controls (Flat buttons, Square edges) */}
        <div className="flex flex-wrap p-1 bg-slate-950 border border-slate-800 rounded-none w-fit">
          <button
            onClick={() => setActiveTab("leads")}
            className={`px-4 py-2 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer rounded-none ${
              activeTab === "leads"
                ? "bg-amber-500 text-slate-950 font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Real-time Booked Leads
          </button>
          <button
            onClick={() => setActiveTab("sms-tester")}
            className={`px-4 py-2 font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer rounded-none ${
              activeTab === "sms-tester"
                ? "bg-amber-500 text-slate-950 font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            AI Text Reply Bot
          </button>
          <button
            onClick={() => setActiveTab("rankings")}
            className={`px-4 py-2 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer rounded-none ${
              activeTab === "rankings"
                ? "bg-amber-500 text-slate-950 font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Emergency Search Ranks
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x-2 divide-slate-200">
        
        {/* Left main interactive layout (8 columns) */}
        <div className="lg:col-span-8 p-6 sm:p-8 min-h-[420px] bg-white">
          <AnimatePresence mode="wait">
            
            {/* TAB 1: BOOKED LEADS */}
            {activeTab === "leads" && (
              <motion.div
                key="leads"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 bg-amber-500 rounded-none border border-slate-950" />
                    <h5 className="text-xs font-mono uppercase tracking-widest text-slate-500 font-extrabold">
                      Active Leads Captured in Australia
                    </h5>
                  </div>
                  <button 
                    onClick={fetchLeads} 
                    disabled={loadingLeads}
                    className="py-1 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold border border-slate-300 uppercase tracking-widest transition-all flex items-center gap-1 cursor-pointer"
                    title="Refresh leads list"
                  >
                    <RefreshCw className={`w-3 h-3 ${loadingLeads ? "animate-spin" : ""}`} />
                    <span>Sync Leads</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {leads.map((lead) => (
                    <motion.div
                      whileHover={{ y: -2 }}
                      key={lead.id}
                      className="bg-slate-50 border-2 border-slate-900 p-5 rounded-none flex flex-col justify-between hover:bg-amber-50/10 transition-all shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] hover:shadow-[5px_5px_0px_0px_rgba(245,158,11,1)] relative"
                    >
                      <div className="absolute top-0 right-0 py-1 px-3 bg-slate-900 text-white text-[9px] font-mono font-bold tracking-widest uppercase">
                        {lead.source}
                      </div>

                      <div className="mt-2">
                        {/* Location Suburb */}
                        <div className="flex items-center gap-1.5 text-xs text-amber-600 font-bold uppercase tracking-wider">
                          <MapPin className="w-3.5 h-3.5" />
                          <span>{lead.suburb}</span>
                        </div>

                        {/* Customer Emergency Name */}
                        <h6 className="text-base font-black text-slate-900 mt-1 uppercase tracking-tight">
                          {lead.customerName}
                        </h6>

                        {/* Urgent Problem */}
                        <p className="text-xs mt-2 border-l-2 border-slate-900 pl-3 text-slate-650 italic font-semibold">
                          "{lead.urgentIssue}"
                        </p>
                      </div>

                      {/* Pricing and Action Status */}
                      <div className="flex items-center justify-between mt-5 pt-3 border-t border-slate-100">
                        <div>
                          <div className="text-[9px] text-slate-505 font-bold uppercase tracking-widest">MIN EST. REVENUE</div>
                          <span className="text-base font-mono font-black text-emerald-600">{lead.revenueEstimate}</span>
                        </div>

                        <span className="bg-emerald-50 text-emerald-800 text-[10px] px-3 py-1 font-bold border border-emerald-300 inline-flex items-center gap-1 uppercase">
                          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-none animate-pulse" /> {lead.status}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>

                <div className="p-4 bg-amber-50 rounded-none border border-amber-200 text-xs text-slate-700 flex items-start gap-3 mt-4">
                  <Sparkles className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">
                    <strong className="text-slate-900 uppercase tracking-wider block mb-1">Instant Lead-to-Job conversion engine:</strong> 
                    Our landing pages use structured schema mapping coupled with automated chat responders. When emergency calls land on your phone, they are already pre-qualified and pre-informed of standard trade availability – saving you hours of wasted call-back conversations.
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB 2: SMS AUTO-RESPONDER TESTER */}
            {activeTab === "sms-tester" && (
              <motion.div
                key="sms-tester"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 bg-amber-500 rounded-none border border-slate-950" />
                    <h5 className="text-xs font-mono uppercase tracking-widest text-slate-500 font-extrabold">
                      Live Aussie SMS Replying Bot Tester
                    </h5>
                  </div>
                  <span className="text-[10px] text-slate-600 bg-slate-100 py-1 px-2 border border-slate-200 font-bold uppercase tracking-wider">
                    REDUCES TRADIE MISSED-CALL LEAK TO 0%
                  </span>
                </div>

                <div className="bg-slate-50 border-2 border-slate-950 p-4 sm:p-6 flex flex-col justify-between min-h-[300px] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  {/* Message Stack container */}
                  <div className="space-y-4 overflow-y-auto max-h-[200px] mb-4 pr-1 scrollbar-thin">
                    {smsChat.map((chat, idx) => (
                      <div
                        key={idx}
                        className={`flex flex-col max-w-[85%] ${
                          chat.sender === "customer" ? "ml-auto items-end" : "mr-auto items-start"
                        }`}
                      >
                        <div
                          className={`p-3 border text-xs leading-relaxed ${
                            chat.sender === "customer"
                              ? "bg-slate-900 text-white border-slate-950 rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,0.15)]"
                              : "bg-white text-slate-800 border-slate-300 rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,0.05)]"
                          }`}
                        >
                          {chat.message}
                        </div>
                        <span className="text-[9px] text-slate-400 mt-1 font-mono font-bold uppercase tracking-wider">{chat.time}</span>
                      </div>
                    ))}
                    {sendingSms && (
                      <div className="text-xs text-slate-500 italic animate-pulse flex items-center gap-1.5">
                        <span className="w-1.5 h-3 bg-amber-500" /> Sending immediate response...
                      </div>
                    )}
                  </div>

                  {/* Input form with square design properties */}
                  <form onSubmit={handleSmsSend} className="flex gap-2 border-t border-slate-200 pt-4">
                    <input
                      type="text"
                      placeholder="Ask the bot (e.g. 'Can you do 24/7 in Manly NSW?', 'How much is block drain callout?')"
                      value={smsInput}
                      onChange={(e) => setSmsInput(e.target.value)}
                      className="flex-1 bg-white border-2 border-slate-900 p-3 rounded-none text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 transition-all font-medium"
                    />
                    <button
                      type="submit"
                      disabled={sendingSms}
                      className="bg-slate-900 hover:bg-amber-500 hover:text-slate-950 text-white px-5 rounded-none text-xs font-black uppercase tracking-widest transition-all flex items-center gap-1.5 cursor-pointer border-2 border-slate-900 active:translate-x-0.5 active:translate-y-0.5"
                    >
                      <Send className="w-3.5 h-3.5" /> Submit Reply
                    </button>
                  </form>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 text-xs text-slate-600 leading-relaxed">
                  📢 <strong>Missed Calls are Lost Profits:</strong> For a Plumber, every ring list translates to money. 62% of plumbers miss active emergency opportunities because they are either on-call driving or digging physically. Our system intercepts the missed line with automatic high-intent SMS textbacks, engaging clients and fixing bookings before they call another business.
                </div>
              </motion.div>
            )}

            {/* TAB 3: LOCAL RANKINGS */}
            {activeTab === "rankings" && (
              <motion.div
                key="rankings"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 bg-amber-500 rounded-none border border-slate-950" />
                  <h5 className="text-xs font-mono uppercase tracking-widest text-slate-505 font-extrabold">
                    Primary Suburb Focus Local SEO & AEO Trackers
                  </h5>
                </div>

                <div className="border-2 border-slate-950 rounded-none overflow-hidden bg-white shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]">
                  <div className="grid grid-cols-12 bg-slate-900 p-3.5 text-[10px] font-mono font-black text-slate-400 border-b-2 border-slate-950 uppercase tracking-widest">
                    <div className="col-span-5">Search keyword phrase</div>
                    <div className="col-span-3 text-center">Google Map rank</div>
                    <div className="col-span-4 text-right">AEO Grounding status</div>
                  </div>

                  <div className="divide-y divide-slate-200">
                    {simulatedKeywords.map((kw, idx) => (
                      <div key={idx} className="grid grid-cols-12 p-3.5 text-xs items-center hover:bg-slate-50 transition-all font-medium">
                        <div className="col-span-5">
                          <div className="text-slate-900 font-bold uppercase tracking-tight">{kw.keyword}</div>
                          <span className="text-[10px] font-mono text-slate-405 font-semibold">{kw.traffic}</span>
                        </div>
                        
                        <div className="col-span-3 text-center">
                          <span className="bg-amber-100 text-amber-950 text-[10px] px-2.5 py-1 rounded-none border border-amber-300 font-mono font-black">
                            {kw.packRank}
                          </span>
                          <span className="text-[10px] text-emerald-650 font-black font-mono ml-2 block sm:inline">{kw.delta}</span>
                        </div>

                        <div className="col-span-4 text-right">
                          <span className="text-slate-700 font-mono text-[10px] flex items-center justify-end gap-1 font-bold uppercase">
                            <Sparkles className="w-3.5 h-3.5 text-amber-500 fill-current" /> {kw.aeoRank}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-4 bg-amber-50 border border-amber-200 text-xs text-slate-700 leading-relaxed font-medium">
                  🚀 <strong>AEO Indexing is Mandatory:</strong> Voice commands and search engine tools like ChatGPT Search rely entirely on schema and direct local coordinates. Amberly Digital ensures your GBP (Google Business Profile) is properly structured so your address is crawled as the nearest licensed local expert.
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* Right Audit Side Metrics Panel (4 columns) */}
        <div className="lg:col-span-4 p-6 sm:p-8 bg-slate-50 flex flex-col justify-between space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <BellRing className="w-4 h-4 text-slate-900 shrink-0" />
              <h5 className="text-xs font-mono uppercase tracking-widest text-slate-900 font-black">
                Aussie SEO Listeners
              </h5>
            </div>

            {/* System activity logs inside a console */}
            <div className="space-y-3 font-mono text-[11px] mb-6 bg-slate-900 p-4 border border-slate-950 text-slate-300 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              {systemLogs.map((log, index) => (
                <div key={index} className="flex gap-1.5 text-slate-300 leading-relaxed">
                  <span className="text-amber-400 shrink-0 select-none">&gt;&gt;</span>
                  <span>{log}</span>
                </div>
              ))}
            </div>

            <h5 className="text-xs font-mono uppercase tracking-widest text-slate-505 font-extrabold mb-4 pb-1 border-b border-slate-200">
              Agency Benchmark Audiences
            </h5>

            <div className="space-y-3.5">
              <div className="bg-white border border-slate-200 p-3 shadow-sm">
                <div className="text-[9px] text-slate-400 font-black uppercase tracking-widest leading-none">Map Pack Proximity</div>
                <div className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5 mt-2 uppercase">
                  <span className="w-2 h-2 bg-emerald-500 rounded-none" /> Primary Suburb Authority
                </div>
              </div>

              <div className="bg-white border border-slate-200 p-3 shadow-sm">
                <div className="text-[9px] text-slate-400 font-black uppercase tracking-widest leading-none">AEO review velocity density</div>
                <div className="text-xs font-extrabold text-slate-900 mt-2 uppercase">
                  ⭐ 4.9 Avg Rating <span className="text-amber-600 font-mono">(+12 new reviews / week)</span>
                </div>
              </div>

              <div className="bg-white border border-slate-200 p-3 shadow-sm">
                <div className="text-[9px] text-slate-400 font-black uppercase tracking-widest leading-none">Lead Capture Outcall Dial Speed</div>
                <div className="text-xs font-extrabold text-amber-650 font-mono mt-2 flex items-center gap-1">
                  ⚡ 7.2 sec Call connection
                </div>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-200">
            <div className="bg-slate-900 border border-slate-950 p-4 text-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
              <div className="text-xs font-black uppercase tracking-wider text-amber-400 mb-1">Tradie Cost-Leak Warning:</div>
              <p className="text-[11px] text-slate-300 leading-relaxed mb-3">
                Letting emergency calls reach your voicemail leaks thousands of potential high-paying local residential bookings directly to competitors. Our setup plugs this hole permanently.
              </p>
              <div className="text-xs font-mono font-bold text-amber-500 uppercase tracking-wide">Automatic SMS ensures engagement.</div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
