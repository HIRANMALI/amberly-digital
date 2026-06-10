import React, { useState, useEffect } from "react";
import { Search, Trash2, RefreshCw, AlertTriangle, CheckCircle, TrendingUp, ShieldAlert, ShieldCheck } from "lucide-react";

interface RateLimitRecord {
  ip: string;
  scanCount: number;
  lastScanTime: string | null;
  allScansThisWeek: string[];
}

export function AdminDashboard() {
  const [limits, setLimits] = useState<RateLimitRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionIp, setActionIp] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [expandedIp, setExpandedIp] = useState<string | null>(null);
  const [totalScansOverall, setTotalScansOverall] = useState<number>(0);

  const fetchLimits = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/rate-limits");
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Unauthorized access. Please refresh and log in.");
        }
        throw new Error(`Server returned error status ${response.status}`);
      }
      const data = await response.json();
      if (data.success) {
        setLimits(data.rateLimits || []);
        setTotalScansOverall(data.totalScansOverall || 0);
      } else {
        throw new Error(data.error || "Failed to fetch rate limits.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to load rate limits.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (ip: string) => {
    if (!confirm(`Are you sure you want to reset all scan limits to 0 for IP: ${ip}?`)) {
      return;
    }
    setActionIp(ip);
    setError(null);
    setSuccessMsg(null);
    try {
      const response = await fetch("/api/admin/rate-limits", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "reset",
          ip: ip,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to reset: server returned ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        setSuccessMsg(`Successfully reset quota for IP: ${ip}`);
        // Remove from list or set scanCount to 0 locally
        setLimits(prev => prev.map(item => item.ip === ip ? { ...item, scanCount: 0, allScansThisWeek: [] } : item));
        if (expandedIp === ip) setExpandedIp(null);
      } else {
        throw new Error(data.error || "Failed to execute reset operation.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to execute reset.");
    } finally {
      setActionIp(null);
    }
  };

  useEffect(() => {
    fetchLimits();
  }, []);

  const filteredLimits = limits.filter(record => 
    record.ip.includes(searchTerm)
  );

  const totalScans = limits.reduce((acc, curr) => acc + curr.scanCount, 0);
  const totalRateLimited = limits.filter(r => r.scanCount >= 5).length;

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 py-8">
      {/* Upper Brand Bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b-4 border-slate-950 pb-6">
        <div>
          <span className="text-xs font-mono font-black text-amber-600 uppercase tracking-widest block mb-1">
            ⚡ Admin Control Center
          </span>
          <h1 className="text-3xl md:text-5xl font-display font-black text-slate-950 uppercase tracking-tight">
            Scanner Quota Dashboard
          </h1>
        </div>
        <button
          onClick={fetchLimits}
          disabled={loading}
          className="flex items-center gap-2 bg-amber-500 hover:bg-[#f7ab1a] disabled:bg-slate-200 text-slate-950 font-black px-6 py-3 border-2 border-slate-950 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all uppercase tracking-wider text-xs cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Metric 1 */}
        <div className="bg-white border-2 border-slate-950 p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-mono font-black uppercase text-slate-500 tracking-wider">
                Total Tracked Devices (IPs)
              </p>
              <h3 className="text-4xl font-display font-black text-slate-950 mt-2">
                {limits.length}
              </h3>
            </div>
            <div className="w-10 h-10 bg-amber-500/10 border border-slate-950/20 flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5 text-slate-950" />
            </div>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white border-2 border-slate-950 p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-mono font-black uppercase text-slate-500 tracking-wider">
                Rate Limited Devices
              </p>
              <h3 className="text-4xl font-display font-black text-slate-950 mt-2">
                {totalRateLimited}
              </h3>
            </div>
            <div className="w-10 h-10 bg-rose-500/10 border border-slate-950/20 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5 text-rose-600" />
            </div>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white border-2 border-slate-950 p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-mono font-black uppercase text-slate-500 tracking-wider">
                Total Scans (All-Time)
              </p>
              <h3 className="text-4xl font-display font-black text-slate-950 mt-2">
                {totalScansOverall}
              </h3>
            </div>
            <div className="w-10 h-10 bg-emerald-500/10 border border-slate-950/20 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="border-2 border-slate-950 bg-rose-50 text-slate-950 p-4 shadow-[3px_3px_0px_0px_rgba(244,63,94,1)] flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-mono font-black text-xs uppercase text-rose-600">Action Failed</h4>
            <p className="text-xs font-semibold mt-1">{error}</p>
          </div>
        </div>
      )}

      {successMsg && (
        <div className="border-2 border-slate-950 bg-emerald-50 text-slate-950 p-4 shadow-[3px_3px_0px_0px_rgba(16,185,129,1)] flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-mono font-black text-xs uppercase text-emerald-600">Action Successful</h4>
            <p className="text-xs font-semibold mt-1">{successMsg}</p>
          </div>
        </div>
      )}

      {/* Main Panel */}
      <div className="bg-white border-2 border-slate-950 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        {/* Table controls */}
        <div className="p-6 border-b-2 border-slate-950 flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#FAF9F5]">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search by IP address..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border-2 border-slate-950 p-3 pl-10 text-sm text-slate-950 placeholder:text-slate-500 focus:outline-none focus:border-amber-500 font-bold rounded-none"
            />
          </div>
          <span className="text-xs font-mono font-bold text-slate-500">
            Showing {filteredLimits.length} of {limits.length} records
          </span>
        </div>

        {/* Loading state */}
        {loading ? (
          <div className="py-20 text-center space-y-3">
            <RefreshCw className="w-8 h-8 animate-spin text-amber-500 mx-auto" />
            <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">
              Fetching scan quota tables from server...
            </p>
          </div>
        ) : filteredLimits.length === 0 ? (
          <div className="py-16 text-center text-slate-500 space-y-2">
            <p className="font-bold">No active scan logs found.</p>
            <p className="text-xs">Either there are no scans in the last 7 days or your search query matches nothing.</p>
          </div>
        ) : (
          /* Responsive Table Container */
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white font-mono text-[10px] font-black uppercase tracking-wider border-b-2 border-slate-950">
                  <th className="p-4 pl-6">Client Device (IP)</th>
                  <th className="p-4">Weekly Limit (5 Max)</th>
                  <th className="p-4">Last Activity</th>
                  <th className="p-4 pr-6 text-right">Reset Tool</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-slate-150">
                {filteredLimits.map((record) => {
                  const isLimited = record.scanCount >= 5;
                  const percentUsed = Math.min(100, (record.scanCount / 5) * 100);
                  
                  // Color codes based on quota usage
                  let quotaBg = "bg-emerald-500";
                  let quotaBorder = "border-emerald-600";
                  let quotaText = "text-emerald-700 bg-emerald-50";
                  
                  if (record.scanCount >= 5) {
                    quotaBg = "bg-rose-500";
                    quotaBorder = "border-rose-600";
                    quotaText = "text-rose-700 bg-rose-50";
                  } else if (record.scanCount >= 3) {
                    quotaBg = "bg-amber-500";
                    quotaBorder = "border-amber-600";
                    quotaText = "text-amber-700 bg-amber-50";
                  }

                  const isExpanded = expandedIp === record.ip;

                  return (
                    <React.Fragment key={record.ip}>
                      <tr className="hover:bg-slate-50/80 transition-colors">
                        {/* IP Address */}
                        <td className="p-4 pl-6 font-mono font-bold text-slate-900">
                          <button
                            onClick={() => setExpandedIp(isExpanded ? null : record.ip)}
                            className="hover:text-amber-600 text-left underline underline-offset-4 decoration-2 decoration-amber-500/40 font-black cursor-pointer"
                          >
                            {record.ip}
                          </button>
                        </td>

                        {/* Progress Bar & Quota Count */}
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <span className={`px-2.5 py-1 text-xs font-mono font-black border-2 border-slate-950 shadow-[1px_1px_0px_rgba(0,0,0,1)] ${quotaText}`}>
                              {record.scanCount} / 5
                            </span>
                            <div className="w-24 h-3 bg-slate-100 border-2 border-slate-950 rounded-none overflow-hidden hidden sm:block">
                              <div
                                style={{ width: `${percentUsed}%` }}
                                className={`h-full ${quotaBg}`}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Last Scan Time */}
                        <td className="p-4 text-xs font-semibold text-slate-600 font-mono">
                          {record.lastScanTime 
                            ? new Date(record.lastScanTime).toLocaleString() 
                            : "Never"
                          }
                        </td>

                        {/* Reset Action */}
                        <td className="p-4 pr-6 text-right">
                          <button
                            onClick={() => handleReset(record.ip)}
                            disabled={actionIp !== null}
                            className="inline-flex items-center gap-1.5 bg-rose-500 hover:bg-rose-600 disabled:bg-slate-200 text-white font-black px-4 py-2 border-2 border-slate-950 shadow-[2px_2px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_rgba(0,0,0,1)] transition-all uppercase tracking-wider text-[10px] cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>{actionIp === record.ip ? "Resetting..." : "Reset"}</span>
                          </button>
                        </td>
                      </tr>

                      {/* Collapsible Details showing all scans this week */}
                      {isExpanded && (
                        <tr className="bg-slate-50">
                          <td colSpan={4} className="p-6 pl-12 border-t border-b border-slate-200">
                            <div className="space-y-3">
                              <h4 className="text-xs font-mono font-black uppercase text-slate-600 tracking-wider">
                                Active Scan Timelines for this device (Last 7 Days)
                              </h4>
                              {record.allScansThisWeek.length === 0 ? (
                                <p className="text-xs text-slate-500 font-medium">No recent logs.</p>
                              ) : (
                                <ul className="space-y-1.5">
                                  {record.allScansThisWeek.map((ts, idx) => (
                                    <li key={idx} className="flex items-center gap-3 text-xs font-mono text-slate-600">
                                      <span className="w-1.5 h-1.5 bg-amber-500 border border-slate-950 rounded-full shrink-0" />
                                      <span>Scan #{idx + 1}: {new Date(ts).toLocaleString()}</span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
