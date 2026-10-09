import React, { useState, useEffect, useMemo } from "react";
import {
  Users,
  Film,
  Sparkles,
  Search,
  RefreshCw,
  PlusCircle,
  Play,
  CheckCircle2,
  AlertCircle,
  Clock,
  Coins,
  Filter,
  X,
  ArrowUpRight,
  Eye,
  Activity,
  UserCheck,
  Server
} from "lucide-react";

interface AdminStats {
  totalUsers: number;
  totalTasks: number;
  imageTasks?: number;
  videoTasks?: number;
  completedTasks: number;
  failedTasks: number;
  totalCreditsGranted?: number;
  backendConnected?: boolean;
  backendUrl?: string;
}

interface UserRecord {
  id: string;
  email: string;
  name?: string;
  full_name?: string;
  avatar_url?: string;
  credits?: number;
  tasks_today?: number;
  total_tasks?: number;
  created_at?: string;
  last_active?: string;
}

interface TaskRecord {
  id: string;
  task_id?: string;
  user_id?: string;
  user_email?: string;
  prompt: string;
  task_type: "image" | "video" | "t2v" | "i2v" | "i2i" | string;
  status: "pending" | "queued" | "running" | "processing" | "completed" | "failed";
  aspect_ratio?: string;
  duration?: number | string;
  result_url?: string;
  video_url?: string;
  cloudinary_url?: string;
  media_url?: string;
  image_url?: string;
  error?: string;
  created_at?: string;
  updated_at?: string;
}

function MediaThumbnail({ url, isVideo, className = "w-full h-full object-contain" }: { url: string; isVideo: boolean; className?: string }) {
  const [loadError, setLoadError] = useState(false);

  if (!url || loadError) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 bg-slate-900/60 p-2 text-center">
        {isVideo ? <Film className="w-5 h-5 text-slate-500 mb-1" /> : <Sparkles className="w-5 h-5 text-slate-500 mb-1" />}
        <span className="text-[9px] font-mono text-slate-400 uppercase tracking-tighter block">
          {loadError ? "Media Restricted" : "No Media"}
        </span>
      </div>
    );
  }

  if (isVideo) {
    return (
      <video
        src={url}
        className={className}
        onError={() => setLoadError(true)}
      />
    );
  }

  return (
    <img
      src={url}
      alt=""
      className={className}
      onError={() => setLoadError(true)}
    />
  );
}

export function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<"overview" | "users" | "tasks" | "system">("overview");
  
  // Data states
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Filters & Search
  const [userSearch, setUserSearch] = useState<string>("");
  const [taskSearch, setTaskSearch] = useState<string>("");
  const [taskStatusFilter, setTaskStatusFilter] = useState<string>("all");
  const [taskTypeFilter, setTaskTypeFilter] = useState<string>("all");
  const [selectedUserFilter, setSelectedUserFilter] = useState<UserRecord | null>(null);

  // Modals & Active Viewers
  const [activeMediaTask, setActiveMediaTask] = useState<TaskRecord | null>(null);
  const [creditModalUser, setCreditModalUser] = useState<UserRecord | null>(null);
  const [creditAmount, setCreditAmount] = useState<number>(50);
  const [creditAction, setCreditAction] = useState<"add" | "deduct" | "set">("add");
  const [creditSubmitting, setCreditSubmitting] = useState<boolean>(false);

  // Show Toast
  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 4000);
  };

  // Fetch Stats
  const fetchStats = async () => {
    try {
      const res = await fetch("/api/admin/stats", { credentials: "same-origin" });
      if (res.ok) {
        const json = await res.json();
        const payload = json.data || json;
        const statsObj = payload.stats || payload;
        setStats(statsObj);
      } else if (res.status === 401) {
        setErrorMsg("Admin session expired or unauthorized. Please reload the page to log in.");
      }
    } catch (e) {
      console.error("Failed to load admin stats", e);
    }
  };

  // Fetch Users
  const fetchUsers = async () => {
    try {
      const res = await fetch(`/api/admin/users?search=${encodeURIComponent(userSearch)}`, { credentials: "same-origin" });
      if (res.ok) {
        const json = await res.json();
        const payload = json.data || json;
        const list = Array.isArray(payload.users)
          ? payload.users
          : (Array.isArray(payload) ? payload : (Array.isArray(payload.data) ? payload.data : []));
        setUsers(list);
      }
    } catch (e) {
      console.error("Failed to load users", e);
    }
  };

  // Fetch Tasks
  const fetchTasks = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedUserFilter) params.append("user_id", selectedUserFilter.id);
      if (taskStatusFilter !== "all") params.append("status", taskStatusFilter);
      if (taskTypeFilter !== "all") params.append("task_type", taskTypeFilter);
      if (taskSearch) params.append("search", taskSearch);

      const res = await fetch(`/api/admin/tasks?${params.toString()}`, { credentials: "same-origin" });
      if (res.ok) {
        const json = await res.json();
        const payload = json.data || json;
        const list = Array.isArray(payload.tasks)
          ? payload.tasks
          : (Array.isArray(payload) ? payload : (Array.isArray(payload.data) ? payload.data : []));
        setTasks(list);
      }
    } catch (e) {
      console.error("Failed to load tasks", e);
    }
  };

  // Initial and on-tab data loading
  const reloadAll = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      await Promise.all([fetchStats(), fetchUsers(), fetchTasks()]);
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reloadAll();
  }, []);

  useEffect(() => {
    if (activeTab === "users") fetchUsers();
    if (activeTab === "tasks") fetchTasks();
  }, [activeTab, selectedUserFilter, taskStatusFilter, taskTypeFilter]);

  // Handle Credit Adjustment
  const handleUpdateCredits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!creditModalUser) return;
    setCreditSubmitting(true);
    try {
      const res = await fetch("/api/admin/credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          userId: creditModalUser.id,
          amount: creditAmount,
          action: creditAction,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success !== false) {
        showToast(`Updated credits for ${creditModalUser.email || creditModalUser.name || "User"}!`);
        setCreditModalUser(null);
        fetchUsers();
        fetchStats();
      } else {
        alert(data.error || "Failed to adjust credits");
      }
    } catch (err: any) {
      alert(err.message || "Error updating credits");
    } finally {
      setCreditSubmitting(false);
    }
  };

  // Helper to extract clean media URL
  const getMediaUrl = (task: TaskRecord) => {
    const raw =
      task.result_url ||
      task.video_url ||
      task.cloudinary_url ||
      task.media_url ||
      task.image_url ||
      "";
    if (typeof raw === "string" && (raw.startsWith("http://") || raw.startsWith("https://") || raw.startsWith("data:"))) {
      return raw;
    }
    return "";
  };

  // Helper for task type detection
  const isVideoTask = (task: TaskRecord) => {
    const t = (task.task_type || "").toLowerCase();
    return t.includes("video") || t === "t2v" || t === "i2v" || t === "simple" || t === "creative" || t === "manuscript";
  };

  // Filtered lists
  const filteredUsers = useMemo(() => {
    if (!Array.isArray(users)) return [];
    if (!userSearch.trim()) return users;
    const q = userSearch.toLowerCase();
    return users.filter(
      (u) =>
        u.email?.toLowerCase().includes(q) ||
        u.name?.toLowerCase().includes(q) ||
        u.full_name?.toLowerCase().includes(q) ||
        u.id?.toLowerCase().includes(q)
    );
  }, [users, userSearch]);

  const filteredTasks = useMemo(() => {
    if (!Array.isArray(tasks)) return [];
    return tasks.filter((t) => {
      const matchesSearch =
        !taskSearch.trim() ||
        t.prompt?.toLowerCase().includes(taskSearch.toLowerCase()) ||
        t.id?.toLowerCase().includes(taskSearch.toLowerCase()) ||
        t.user_email?.toLowerCase().includes(taskSearch.toLowerCase());
      return matchesSearch;
    });
  }, [tasks, taskSearch]);

  return (
    <div className="space-y-6 pb-20">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-3 bg-emerald-500 text-slate-950 px-5 py-3 border-2 border-slate-950 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] font-bold text-sm animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 className="w-5 h-5" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-slate-950 text-white border-4 border-slate-950 p-6 md:p-8 shadow-[8px_8px_0px_0px_rgba(245,158,11,1)]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="bg-amber-500 text-slate-950 text-xs font-mono font-black uppercase px-2.5 py-1 tracking-widest">
                ⚡ Admin Mission Control
              </span>
              <div className="flex items-center gap-2 text-xs font-mono text-emerald-400">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                <span>Live System Monitor</span>
              </div>
            </div>
            <h1 className="text-3xl md:text-5xl font-black font-display tracking-tight text-white uppercase">
              Amberly <span className="text-amber-500">Digital</span> Admin
            </h1>
            <p className="text-slate-400 text-sm max-w-2xl font-medium">
              Real-time user management, AI image & video generation audit, task execution telemetry, and credit quotas.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={reloadAll}
              disabled={loading}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-5 py-3 border-2 border-slate-950 shadow-[3px_3px_0px_0px_rgba(255,255,255,1)] hover:translate-x-[1px] hover:translate-y-[1px] transition-all text-xs font-mono uppercase cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              <span>{loading ? "Syncing..." : "Refresh Data"}</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 mt-8 pt-6 border-t border-slate-800">
          <button
            onClick={() => setActiveTab("overview")}
            className={`flex items-center gap-2 px-5 py-2.5 font-mono text-xs font-black uppercase tracking-wider border-2 transition-all cursor-pointer ${
              activeTab === "overview"
                ? "bg-amber-500 text-slate-950 border-amber-500 shadow-[3px_3px_0px_0px_rgba(255,255,255,1)]"
                : "bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white"
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Overview</span>
          </button>

          <button
            onClick={() => setActiveTab("users")}
            className={`flex items-center gap-2 px-5 py-2.5 font-mono text-xs font-black uppercase tracking-wider border-2 transition-all cursor-pointer ${
              activeTab === "users"
                ? "bg-amber-500 text-slate-950 border-amber-500 shadow-[3px_3px_0px_0px_rgba(255,255,255,1)]"
                : "bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Users Directory ({users.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("tasks")}
            className={`flex items-center gap-2 px-5 py-2.5 font-mono text-xs font-black uppercase tracking-wider border-2 transition-all cursor-pointer ${
              activeTab === "tasks"
                ? "bg-amber-500 text-slate-950 border-amber-500 shadow-[3px_3px_0px_0px_rgba(255,255,255,1)]"
                : "bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white"
            }`}
          >
            <Film className="w-4 h-4" />
            <span>AI Tasks & Generations ({tasks.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("system")}
            className={`flex items-center gap-2 px-5 py-2.5 font-mono text-xs font-black uppercase tracking-wider border-2 transition-all cursor-pointer ${
              activeTab === "system"
                ? "bg-amber-500 text-slate-950 border-amber-500 shadow-[3px_3px_0px_0px_rgba(255,255,255,1)]"
                : "bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white"
            }`}
          >
            <Server className="w-4 h-4" />
            <span>System & Rate Limits</span>
          </button>
        </div>
      </div>

      {/* Error alert if any */}
      {errorMsg && (
        <div className="bg-rose-50 border-2 border-rose-600 p-4 flex items-center gap-3 text-rose-700 text-sm font-semibold">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 1: OVERVIEW & ANALYTICS                             */}
      {/* ======================================================== */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Key Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Metric 1 */}
            <div className="bg-white border-2 border-slate-950 p-6 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-slate-500 uppercase tracking-wider">
                  Total Registered Users
                </span>
                <div className="w-9 h-9 bg-amber-100 border border-slate-950 flex items-center justify-center text-amber-800">
                  <Users className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-4xl font-black font-display text-slate-950">
                  {stats?.totalUsers ?? users.length}
                </span>
                <span className="text-xs font-semibold text-emerald-600 flex items-center">
                  Active
                </span>
              </div>
            </div>

            {/* Metric 2 */}
            <div className="bg-white border-2 border-slate-950 p-6 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-slate-500 uppercase tracking-wider">
                  Total Generations
                </span>
                <div className="w-9 h-9 bg-purple-100 border border-slate-950 flex items-center justify-center text-purple-800">
                  <Sparkles className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-4xl font-black font-display text-slate-950">
                  {stats?.totalTasks ?? tasks.length}
                </span>
                <span className="text-xs font-mono text-slate-500">tasks logged</span>
              </div>
            </div>

            {/* Metric 3 */}
            <div className="bg-white border-2 border-slate-950 p-6 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-slate-500 uppercase tracking-wider">
                  Success vs Failed
                </span>
                <div className="w-9 h-9 bg-emerald-100 border border-slate-950 flex items-center justify-center text-emerald-800">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4 flex items-baseline justify-between">
                <div>
                  <span className="text-3xl font-black font-display text-emerald-600">
                    {stats?.completedTasks ?? tasks.filter((t) => t.status === "completed").length}
                  </span>
                  <span className="text-xs font-mono text-slate-500 block">completed</span>
                </div>
                <div className="text-right">
                  <span className="text-3xl font-black font-display text-rose-500">
                    {stats?.failedTasks ?? tasks.filter((t) => t.status === "failed").length}
                  </span>
                  <span className="text-xs font-mono text-slate-500 block">failed</span>
                </div>
              </div>
            </div>

            {/* Metric 4 */}
            <div className="bg-white border-2 border-slate-950 p-6 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-slate-500 uppercase tracking-wider">
                  Generation Breakdown
                </span>
                <div className="w-9 h-9 bg-blue-100 border border-slate-950 flex items-center justify-center text-blue-800">
                  <Film className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-center">
                <div className="bg-slate-50 p-2 border border-slate-200">
                  <span className="text-xs font-mono text-slate-500 block">Videos</span>
                  <span className="text-xl font-bold text-slate-900">
                    {tasks.filter(isVideoTask).length}
                  </span>
                </div>
                <div className="bg-slate-50 p-2 border border-slate-200">
                  <span className="text-xs font-mono text-slate-500 block">Images</span>
                  <span className="text-xl font-bold text-slate-900">
                    {tasks.filter((t) => !isVideoTask(t)).length}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions & Recent Stream */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Recent Registered Users */}
            <div className="bg-white border-2 border-slate-950 p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
              <div className="flex items-center justify-between border-b-2 border-slate-950 pb-4 mb-4">
                <h2 className="text-lg font-black font-display uppercase tracking-tight text-slate-950 flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-amber-600" />
                  Recent Users
                </h2>
                <button
                  onClick={() => setActiveTab("users")}
                  className="text-xs font-mono font-bold text-amber-600 hover:text-amber-700 underline uppercase cursor-pointer"
                >
                  View All →
                </button>
              </div>

              <div className="space-y-3">
                {users.slice(0, 5).map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 hover:border-slate-950 transition-colors"
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="w-8 h-8 rounded-full bg-slate-950 text-white font-bold text-xs flex items-center justify-center uppercase flex-shrink-0">
                        {u.name ? u.name[0] : (u.email ? u.email[0] : "U")}
                      </div>
                      <div className="truncate">
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {u.name || u.full_name || "User"}
                        </p>
                        <p className="text-[11px] font-mono text-slate-500 truncate">{u.email}</p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 text-[11px] font-bold px-2 py-0.5 border border-amber-300 font-mono">
                        <Coins className="w-3 h-3" />
                        {u.credits ?? 0}
                      </span>
                    </div>
                  </div>
                ))}
                {users.length === 0 && (
                  <div className="text-center py-6 text-xs text-slate-500 font-mono">
                    No registered users found yet.
                  </div>
                )}
              </div>
            </div>

            {/* Live Generation Feed Preview */}
            <div className="lg:col-span-2 bg-white border-2 border-slate-950 p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
              <div className="flex items-center justify-between border-b-2 border-slate-950 pb-4 mb-4">
                <h2 className="text-lg font-black font-display uppercase tracking-tight text-slate-950 flex items-center gap-2">
                  <Film className="w-5 h-5 text-amber-600" />
                  Latest AI Generations
                </h2>
                <button
                  onClick={() => setActiveTab("tasks")}
                  className="text-xs font-mono font-bold text-amber-600 hover:text-amber-700 underline uppercase cursor-pointer"
                >
                  View All Tasks →
                </button>
              </div>

              <div className="space-y-3">
                {tasks.slice(0, 4).map((task) => {
                  const mediaUrl = getMediaUrl(task);
                  const isVideo = isVideoTask(task);
                  return (
                    <div
                      key={task.id || task.task_id}
                      className="p-3 bg-slate-50 border border-slate-200 hover:border-slate-950 transition-colors flex items-center gap-4"
                    >
                      {/* Media Thumb */}
                      <div
                        onClick={() => mediaUrl && setActiveMediaTask(task)}
                        className={`w-16 h-12 bg-slate-900 border border-slate-950 flex-shrink-0 flex items-center justify-center relative overflow-hidden group cursor-pointer ${
                          !mediaUrl ? "opacity-60" : ""
                        }`}
                      >
                        {mediaUrl ? (
                          <MediaThumbnail url={mediaUrl} isVideo={isVideo} />
                        ) : (
                          <Sparkles className="w-4 h-4 text-slate-600" />
                        )}
                        {mediaUrl && (
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                            <Eye className="w-4 h-4" />
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 bg-slate-200 border border-slate-300">
                            {task.task_type || (isVideo ? "Video" : "Image")}
                          </span>
                          <span
                            className={`text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 border ${
                              task.status === "completed"
                                ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                : task.status === "failed"
                                ? "bg-rose-100 text-rose-800 border-rose-300"
                                : "bg-amber-100 text-amber-800 border-amber-300"
                            }`}
                          >
                            {task.status}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-slate-900 truncate">
                          "{task.prompt}"
                        </p>
                      </div>

                      {/* Action */}
                      {mediaUrl && (
                        <button
                          onClick={() => setActiveMediaTask(task)}
                          className="px-3 py-1.5 text-xs font-mono font-bold bg-slate-950 text-white hover:bg-amber-500 hover:text-slate-950 transition-colors uppercase cursor-pointer"
                        >
                          Inspect
                        </button>
                      )}
                    </div>
                  );
                })}
                {tasks.length === 0 && (
                  <div className="text-center py-6 text-xs text-slate-500 font-mono">
                    No task generation logs found yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: USERS DIRECTORY                                  */}
      {/* ======================================================== */}
      {activeTab === "users" && (
        <div className="bg-white border-4 border-slate-950 p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-2 border-slate-950 pb-6">
            <div>
              <h2 className="text-2xl font-black font-display uppercase tracking-tight text-slate-950">
                Registered Users Directory
              </h2>
              <p className="text-xs text-slate-600 font-medium">
                Manage user credit balances and review per-user generation activity.
              </p>
            </div>

            {/* Search Input */}
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search email, name or ID..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border-2 border-slate-950 font-mono text-xs focus:outline-none focus:bg-amber-50"
              />
            </div>
          </div>

          {/* User Table */}
          <div className="overflow-x-auto border-2 border-slate-950">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-white font-mono uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="p-3 border-r border-slate-800">User / Identity</th>
                  <th className="p-3 border-r border-slate-800">User ID</th>
                  <th className="p-3 border-r border-slate-800">Current Credits</th>
                  <th className="p-3 border-r border-slate-800">Joined Date</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-slate-950 font-medium">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-amber-50/50 transition-colors">
                    {/* User Info */}
                    <td className="p-3 border-r border-slate-200">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-slate-950 text-amber-400 font-black flex items-center justify-center uppercase text-xs border border-slate-950 flex-shrink-0">
                          {user.name ? user.name[0] : (user.email ? user.email[0] : "U")}
                        </div>
                        <div>
                          <p className="font-bold text-slate-950 text-sm">
                            {user.name || user.full_name || "User"}
                          </p>
                          <p className="font-mono text-slate-500 text-[11px]">{user.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* ID */}
                    <td className="p-3 border-r border-slate-200 font-mono text-slate-600 text-[11px]">
                      {user.id}
                    </td>

                    {/* Credits */}
                    <td className="p-3 border-r border-slate-200">
                      <span className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-950 font-mono font-black text-xs px-2.5 py-1 border border-amber-400 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                        <Coins className="w-3.5 h-3.5 text-amber-600" />
                        {user.credits ?? 0} Credits
                      </span>
                    </td>

                    {/* Date */}
                    <td className="p-3 border-r border-slate-200 font-mono text-slate-500 text-[11px]">
                      {user.created_at ? new Date(user.created_at).toLocaleDateString() : "—"}
                    </td>

                    {/* Actions */}
                    <td className="p-3 text-right space-x-2">
                      <button
                        onClick={() => {
                          setCreditModalUser(user);
                          setCreditAmount(50);
                          setCreditAction("add");
                        }}
                        className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono font-bold text-xs border border-slate-950 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer inline-flex items-center gap-1"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        Credits
                      </button>

                      <button
                        onClick={() => {
                          setSelectedUserFilter(user);
                          setActiveTab("tasks");
                        }}
                        className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 text-white font-mono font-bold text-xs border border-slate-950 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer inline-flex items-center gap-1"
                      >
                        <Film className="w-3.5 h-3.5 text-amber-400" />
                        Tasks
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500 font-mono text-xs">
                      No matching users found in the system.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: AI TASKS & GENERATIONS FEED                      */}
      {/* ======================================================== */}
      {activeTab === "tasks" && (
        <div className="bg-white border-4 border-slate-950 p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-2 border-slate-950 pb-6">
            <div>
              <h2 className="text-2xl font-black font-display uppercase tracking-tight text-slate-950">
                AI Generation Feed & Inspector
              </h2>
              <p className="text-xs text-slate-600 font-medium">
                Live stream of image and video creation requests across all users.
              </p>
            </div>

            {/* Filter controls */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Type Filter */}
              <select
                value={taskTypeFilter}
                onChange={(e) => setTaskTypeFilter(e.target.value)}
                className="px-3 py-2 border-2 border-slate-950 font-mono text-xs font-bold focus:outline-none bg-white cursor-pointer"
              >
                <option value="all">All Modes (Image & Video)</option>
                <option value="image">Images Only</option>
                <option value="video">Videos Only</option>
              </select>

              {/* Status Filter */}
              <select
                value={taskStatusFilter}
                onChange={(e) => setTaskStatusFilter(e.target.value)}
                className="px-3 py-2 border-2 border-slate-950 font-mono text-xs font-bold focus:outline-none bg-white cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="completed">Completed</option>
                <option value="processing">Processing / Running</option>
                <option value="failed">Failed</option>
              </select>

              {/* Search */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search prompt or ID..."
                  value={taskSearch}
                  onChange={(e) => setTaskSearch(e.target.value)}
                  className="pl-9 pr-4 py-2 border-2 border-slate-950 font-mono text-xs focus:outline-none focus:bg-amber-50"
                />
              </div>
            </div>
          </div>

          {/* User Filter Indicator Banner */}
          {selectedUserFilter && (
            <div className="bg-amber-50 border-2 border-amber-500 p-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-mono font-bold text-amber-950">
                <Filter className="w-4 h-4 text-amber-700" />
                <span>
                  Showing tasks created by: <strong>{selectedUserFilter.email}</strong> ({selectedUserFilter.id})
                </span>
              </div>
              <button
                onClick={() => setSelectedUserFilter(null)}
                className="text-xs font-mono font-black text-rose-600 hover:text-rose-800 uppercase flex items-center gap-1 cursor-pointer"
              >
                <X className="w-4 h-4" /> Clear Filter
              </button>
            </div>
          )}

          {/* Task Grid / Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredTasks.map((task) => {
              const mediaUrl = getMediaUrl(task);
              const isVideo = isVideoTask(task);

              return (
                <div
                  key={task.id || task.task_id}
                  className="bg-slate-50 border-2 border-slate-950 p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-between space-y-4 hover:border-amber-500 transition-colors"
                >
                  {/* Media Viewport */}
                  <div
                    onClick={() => mediaUrl && setActiveMediaTask(task)}
                    className={`h-48 bg-slate-950 border-2 border-slate-950 relative overflow-hidden flex items-center justify-center ${
                      mediaUrl ? "cursor-pointer group" : ""
                    }`}
                  >
                    {mediaUrl ? (
                      <MediaThumbnail url={mediaUrl} isVideo={isVideo} />
                    ) : (
                      <div className="text-center p-4">
                        {task.status === "failed" ? (
                          <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
                        ) : (
                          <Clock className="w-8 h-8 text-amber-500 mx-auto mb-2 animate-spin" />
                        )}
                        <span className="text-[11px] font-mono text-slate-400 block uppercase font-bold">
                          {task.status === "failed" ? "Generation Failed" : "In Progress..."}
                        </span>
                      </div>
                    )}

                    {/* Hover Inspect Overlay */}
                    {mediaUrl && (
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-2 text-white transition-opacity">
                        <Play className="w-8 h-8 text-amber-400 fill-amber-400" />
                        <span className="text-xs font-mono font-bold uppercase tracking-wider">
                          Click to Inspect & Play
                        </span>
                      </div>
                    )}

                    {/* Mode Tag */}
                    <div className="absolute top-2 left-2 flex gap-1">
                      <span className="bg-slate-950/80 backdrop-blur-sm text-white text-[10px] font-mono font-bold px-2 py-0.5 border border-slate-700 uppercase">
                        {task.task_type || (isVideo ? "Video" : "Image")}
                      </span>
                    </div>

                    {/* Status Badge */}
                    <div className="absolute top-2 right-2">
                      <span
                        className={`text-[10px] font-mono font-black uppercase px-2 py-0.5 border ${
                          task.status === "completed"
                            ? "bg-emerald-400 text-slate-950 border-slate-950"
                            : task.status === "failed"
                            ? "bg-rose-500 text-white border-slate-950"
                            : "bg-amber-400 text-slate-950 border-slate-950 animate-pulse"
                        }`}
                      >
                        {task.status}
                      </span>
                    </div>
                  </div>

                  {/* Task Metadata */}
                  <div className="space-y-2 flex-1">
                    <p className="text-xs font-bold text-slate-950 line-clamp-3 leading-snug">
                      "{task.prompt}"
                    </p>

                    <div className="pt-2 border-t border-slate-200 text-[11px] font-mono text-slate-500 space-y-1">
                      {task.user_email && (
                        <p className="truncate">
                          <strong>User:</strong> {task.user_email}
                        </p>
                      )}
                      <div className="flex justify-between">
                        <span>Ratio: {task.aspect_ratio || "16:9"}</span>
                        <span>{task.created_at ? new Date(task.created_at).toLocaleTimeString() : ""}</span>
                      </div>
                    </div>

                    {/* Error message display if failed */}
                    {task.error && (
                      <div className="p-2 bg-rose-50 border border-rose-300 text-rose-800 text-[11px] font-mono rounded">
                        <strong>Error:</strong> {task.error}
                      </div>
                    )}
                  </div>

                  {/* Footer Action */}
                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                    {mediaUrl ? (
                      <button
                        onClick={() => setActiveMediaTask(task)}
                        className="w-full py-2 bg-slate-950 hover:bg-amber-500 text-white hover:text-slate-950 font-mono font-bold text-xs uppercase border border-slate-950 transition-colors text-center cursor-pointer"
                      >
                        Inspect Output →
                      </button>
                    ) : (
                      <span className="text-[11px] font-mono text-slate-400">
                        ID: {task.id || task.task_id}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {filteredTasks.length === 0 && (
            <div className="p-12 text-center border-2 border-dashed border-slate-300 text-slate-500 font-mono text-xs">
              No tasks match the active filters.
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 4: SYSTEM & RATE LIMITS                             */}
      {/* ======================================================== */}
      {activeTab === "system" && (
        <div className="bg-white border-4 border-slate-950 p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] space-y-6">
          <div className="border-b-2 border-slate-950 pb-4">
            <h2 className="text-2xl font-black font-display uppercase tracking-tight text-slate-950">
              System Telemetry & Gateway
            </h2>
            <p className="text-xs text-slate-600 font-medium">
              Health check parameters and backend API proxy status.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-5 bg-slate-50 border-2 border-slate-950 space-y-3">
              <span className="text-xs font-mono font-bold text-amber-600 uppercase">
                Backend API Proxy Route
              </span>
              <p className="text-sm font-bold text-slate-950 font-mono">
                {stats?.backendUrl || "http://localhost:8765/api/v1"}
              </p>
              <div className="pt-2 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-xs font-mono text-slate-600">
                  Proxy routes active at <code>/api/admin/*</code>
                </span>
              </div>
            </div>

            <div className="p-5 bg-slate-50 border-2 border-slate-950 space-y-3">
              <span className="text-xs font-mono font-bold text-amber-600 uppercase">
                Security & Authentication
              </span>
              <p className="text-sm font-bold text-slate-950">
                HTTP Basic Authentication & Header Key Guard
              </p>
              <span className="inline-block bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-mono font-bold px-2 py-1">
                Protected Route Active
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 1: CREDIT ADJUSTMENT MODAL                        */}
      {/* ======================================================== */}
      {creditModalUser && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border-4 border-slate-950 max-w-md w-full p-6 shadow-[8px_8px_0px_0px_rgba(245,158,11,1)] space-y-6">
            <div className="flex items-center justify-between border-b-2 border-slate-950 pb-4">
              <div className="flex items-center gap-2">
                <Coins className="w-6 h-6 text-amber-600" />
                <h3 className="text-xl font-black font-display uppercase tracking-tight text-slate-950">
                  Adjust Credits
                </h3>
              </div>
              <button
                onClick={() => setCreditModalUser(null)}
                className="text-slate-400 hover:text-slate-950 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 p-3 border border-slate-200 text-xs font-mono">
              <p>
                <strong>User:</strong> {creditModalUser.name || "User"}
              </p>
              <p>
                <strong>Email:</strong> {creditModalUser.email}
              </p>
              <p>
                <strong>Current Credits:</strong> {creditModalUser.credits ?? 0}
              </p>
            </div>

            <form onSubmit={handleUpdateCredits} className="space-y-4">
              {/* Action type */}
              <div>
                <label className="block text-xs font-mono font-bold uppercase text-slate-700 mb-1">
                  Adjustment Mode
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["add", "deduct", "set"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setCreditAction(mode)}
                      className={`py-2 text-xs font-mono font-black uppercase border-2 transition-all cursor-pointer ${
                        creditAction === mode
                          ? "bg-amber-500 text-slate-950 border-slate-950 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                          : "bg-white text-slate-600 border-slate-300 hover:border-slate-950"
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount input */}
              <div>
                <label className="block text-xs font-mono font-bold uppercase text-slate-700 mb-1">
                  Amount
                </label>
                <input
                  type="number"
                  min="1"
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(Number(e.target.value))}
                  className="w-full p-3 border-2 border-slate-950 font-mono text-sm font-bold focus:outline-none focus:bg-amber-50"
                  required
                />
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex gap-2">
                {[10, 25, 50, 100].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setCreditAmount(preset)}
                    className="flex-1 py-1 bg-slate-100 hover:bg-amber-200 border border-slate-950 font-mono text-xs font-bold transition-colors cursor-pointer"
                  >
                    +{preset}
                  </button>
                ))}
              </div>

              <div className="pt-4 border-t-2 border-slate-950 flex gap-3">
                <button
                  type="button"
                  onClick={() => setCreditModalUser(null)}
                  className="flex-1 py-3 bg-slate-200 hover:bg-slate-300 text-slate-800 font-mono font-bold text-xs uppercase border-2 border-slate-950 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creditSubmitting}
                  className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono font-black text-xs uppercase border-2 border-slate-950 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer disabled:opacity-50"
                >
                  {creditSubmitting ? "Saving..." : "Apply Balance"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: MEDIA LIGHTBOX & TASK INSPECTOR                */}
      {/* ======================================================== */}
      {activeMediaTask && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white border-4 border-slate-950 max-w-3xl w-full p-6 shadow-[10px_10px_0px_0px_rgba(245,158,11,1)] space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b-2 border-slate-950 pb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-600" />
                <h3 className="text-lg font-black font-display uppercase tracking-tight text-slate-950">
                  Media Inspection View
                </h3>
              </div>
              <button
                onClick={() => setActiveMediaTask(null)}
                className="text-slate-400 hover:text-slate-950 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Media Player Container */}
            <div className="bg-black border-2 border-slate-950 rounded overflow-hidden flex items-center justify-center max-h-96">
              {isVideoTask(activeMediaTask) ? (
                <video
                  src={getMediaUrl(activeMediaTask)}
                  controls
                  autoPlay
                  className="max-h-96 w-full object-contain"
                />
              ) : (
                <img
                  src={getMediaUrl(activeMediaTask)}
                  alt=""
                  className="max-h-96 w-full object-contain"
                />
              )}
            </div>

            {/* Detailed Metadata */}
            <div className="p-4 bg-slate-50 border-2 border-slate-950 space-y-3 font-mono text-xs">
              <div>
                <span className="text-slate-400 uppercase text-[10px] block font-bold">
                  Prompt Text
                </span>
                <p className="font-semibold text-slate-950 text-sm font-sans">
                  "{activeMediaTask.prompt}"
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-slate-200">
                <div>
                  <span className="text-slate-400 uppercase text-[10px] block">Task ID</span>
                  <span className="font-bold text-slate-900 truncate block">
                    {activeMediaTask.id || activeMediaTask.task_id}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 uppercase text-[10px] block">Mode</span>
                  <span className="font-bold text-slate-900 uppercase">
                    {activeMediaTask.task_type}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 uppercase text-[10px] block">Aspect Ratio</span>
                  <span className="font-bold text-slate-900">
                    {activeMediaTask.aspect_ratio || "16:9"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 uppercase text-[10px] block">Status</span>
                  <span className="font-bold text-emerald-600 uppercase">
                    {activeMediaTask.status}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <a
                href={getMediaUrl(activeMediaTask)}
                target="_blank"
                rel="noreferrer"
                download
                className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono font-black text-xs uppercase border-2 border-slate-950 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all text-center inline-flex items-center justify-center gap-2"
              >
                <ArrowUpRight className="w-4 h-4" />
                Open / Download High-Res
              </a>
              <button
                onClick={() => setActiveMediaTask(null)}
                className="px-6 py-3 bg-slate-200 hover:bg-slate-300 text-slate-950 font-mono font-bold text-xs uppercase border-2 border-slate-950 transition-colors cursor-pointer"
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

export default AdminDashboard;
