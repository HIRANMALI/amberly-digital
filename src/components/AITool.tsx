import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Upload, 
  Video, 
  Image as ImageIcon, 
  Play, 
  LogIn, 
  Loader2, 
  RefreshCw, 
  X, 
  AlertCircle, 
  ChevronDown, 
  History, 
  Sparkles, 
  Check, 
  LayoutDashboard, 
  Plus,
  Square,
  Smartphone,
  Download
} from 'lucide-react';

function getCookie(name: string) {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  if (!match) return null;
  let val = match[1];
  try { val = decodeURIComponent(val); } catch (e) {}
  val = val.replace(/\+/g, ' ');
  return val === 'null' ? null : val;
}

const GoogleLogo = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const resolutionOptions = [
  { value: '1024x1024', label: '1:1 Square' },
  { value: '1024x576', label: '16:9' },
  { value: '576x1024', label: '9:16' },
];

const getResolutionIcon = (value: string) => {
  if (value === '1024x1024') return <Square className="w-3.5 h-3.5 text-slate-500 shrink-0" />;
  if (value === '1024x576') return <Smartphone className="w-3.5 h-3.5 text-slate-500 shrink-0 rotate-90" />;
  return <Smartphone className="w-3.5 h-3.5 text-slate-500 shrink-0" />;
};

const durationOptions = [
  { value: 5, label: '5 Seconds', disabled: false },
  { value: 10, label: '10 Seconds', disabled: false },
  { value: 20, label: '20 Seconds (Pro)', disabled: true },
];

export const AITool = ({ apiUrl, localApiUrl }: { apiUrl: string; localApiUrl?: string }) => {
  const [activeApiUrl, setActiveApiUrl] = useState<string>(() => {
    const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    if (isLocal && localApiUrl && localApiUrl !== 'undefined') {
      return localApiUrl;
    }
    return (apiUrl && apiUrl !== 'undefined') ? apiUrl : '';
  });
  const [user, setUser] = useState<{ name: string | null; avatar: string | null } | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('user_profile');
        if (cached) return JSON.parse(cached);
      } catch (e) {
        console.error("Failed to parse cached user profile", e);
      }
    }
    return null;
  });
  const [tasksToday, setTasksToday] = useState<number>(0);
  const [dailyLimit, setDailyLimit] = useState<number>(5);
  const [authChecked, setAuthChecked] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('user_profile') !== null;
    }
    return false;
  });
  const [mode, setMode] = useState<'i2i' | 't2v' | 'i2v'>('i2i');
  const [prompts, setPrompts] = useState<Record<'i2i' | 't2v' | 'i2v', string>>({
    i2i: '',
    t2v: '',
    i2v: ''
  });
  const [imageFiles, setImageFiles] = useState<Record<'i2i' | 't2v' | 'i2v', File | null>>({
    i2i: null,
    t2v: null,
    i2v: null
  });
  const [imagePreviews, setImagePreviews] = useState<Record<'i2i' | 't2v' | 'i2v', string | null>>({
    i2i: null,
    t2v: null,
    i2v: null
  });

  const prompt = prompts[mode] || '';
  const setPrompt = (val: string) => setPrompts(prev => ({ ...prev, [mode]: val }));

  const imageFile = imageFiles[mode] || null;
  const imagePreview = imagePreviews[mode] || null;

  const [endImageFile, setEndImageFile] = useState<File | null>(null);
  const [endImagePreview, setEndImagePreview] = useState<string | null>(null);
  const [useKeyframes, setUseKeyframes] = useState(false);

  const [duration, setDuration] = useState<number>(5);
  const [resolution, setResolution] = useState('576x1024');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [progressMsg, setProgressMsg] = useState('');
  const [progressVal, setProgressVal] = useState(0);
  const [taskStatus, setTaskStatus] = useState<'idle' | 'running' | 'completed' | 'failed'>('idle');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Task List States
  const [tasksList, setTasksList] = useState<any[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('user_tasks');
        if (cached) return JSON.parse(cached);
      } catch (e) {
        console.error("Failed to parse cached tasks", e);
      }
    }
    return [];
  });
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);

  // Custom dropdown states & refs
  const [showResolutionDropdown, setShowResolutionDropdown] = useState(false);
  const [showDurationDropdown, setShowDurationDropdown] = useState(false);
  const resolutionDropdownRef = useRef<HTMLDivElement>(null);
  const durationDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (resolutionDropdownRef.current && !resolutionDropdownRef.current.contains(event.target as Node)) {
        setShowResolutionDropdown(false);
      }
      if (durationDropdownRef.current && !durationDropdownRef.current.contains(event.target as Node)) {
        setShowDurationDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Sync credits counter in the Navbar whenever tasksToday changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('creditsUpdated', { detail: { used: tasksToday } }));
    }
  }, [tasksToday]);

  useEffect(() => {
    // Check URL for auth_error and mode
    const params = new URLSearchParams(window.location.search);
    const authError = params.get('auth_error');
    if (authError) {
      setErrorMsg(decodeURIComponent(authError));
    }
    const modeParam = params.get('mode');
    if (modeParam === 't2v' || modeParam === 'i2v' || modeParam === 'i2i') {
      setMode(modeParam as any);
    }

    // Fetch fresh profile to check auth state using activeApiUrl
    if (activeApiUrl) {
      (async () => {
        try {
          const res = await fetch(`${activeApiUrl}/users/me`, { credentials: 'include' });
          if (res.ok) {
            const data = await res.json();
            let nameCookie = getCookie('user_name');
            let avatarCookie = getCookie('user_avatar');

            if (nameCookie) nameCookie = nameCookie.replace(/^"|"$/g, '');
            if (avatarCookie) avatarCookie = avatarCookie.replace(/^"|"$/g, '');

            const userPayload = data.data || data;
            const name = userPayload.name || userPayload.full_name || userPayload.user?.name || userPayload.user?.full_name || userPayload.email?.split('@')[0] || userPayload.user?.email?.split('@')[0] || nameCookie || 'User';
            const avatar = userPayload.avatar_url || userPayload.picture || userPayload.user?.avatar_url || userPayload.user?.picture || avatarCookie || null;

            const updatedUser = { name, avatar };
            setUser(updatedUser);
            localStorage.setItem('user_profile', JSON.stringify(updatedUser));

            // Extract daily usage counters
            setTasksToday(userPayload.tasks_today ?? 0);
            setDailyLimit(userPayload.daily_task_limit ?? 5);
          } else if (res.status === 401) {
            setUser(null);
            localStorage.removeItem('user_profile');
            localStorage.removeItem('user_tasks');
          }
        } catch (e) {
          console.error("Failed to fetch user profile", e);
        } finally {
          setAuthChecked(true);
        }
      })();
    } else {
      setAuthChecked(true);
    }

    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, [activeApiUrl]);

  // Fetch tasks automatically when user is loaded
  useEffect(() => {
    if (user) {
      fetchTasks();
    }
  }, [user]);

  const apiFetch = async (url: string, options: RequestInit = {}, preventRedirect: boolean = false) => {
    let res = await fetch(`${activeApiUrl}${url}`, { ...options, credentials: 'include' });
    if (res.status !== 401) return res;

    // Try to refresh using HttpOnly cookie credentials
    const tokenVal = getCookie('refresh_token');
    const r = await fetch(`${activeApiUrl}/auth/refresh`, {
      method: 'POST',
      headers: tokenVal ? { 'Content-Type': 'application/json' } : {},
      body: tokenVal ? JSON.stringify({ refresh_token: tokenVal }) : undefined,
      credentials: 'include'
    });

    if (r.ok) return fetch(`${activeApiUrl}${url}`, { ...options, credentials: 'include' });

    // Refresh failed
    if (!preventRedirect) {
      document.location.href = `${activeApiUrl}/auth/google?redirect_to=${encodeURIComponent(window.location.origin + '/ai-studio')}`;
    }
    return res;
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFiles(prev => ({ ...prev, [mode]: file }));
      setImagePreviews(prev => ({ ...prev, [mode]: URL.createObjectURL(file) }));
    }
  };

  const removeImage = () => {
    setImageFiles(prev => ({ ...prev, [mode]: null }));
    setImagePreviews(prev => ({ ...prev, [mode]: null }));
  };

  const handleDownload = async (url: string, filename: string = 'generated-result') => {
    if (!url) return;
    
    // Natively trigger download if it is a base64 data URI
    if (url.startsWith('data:')) {
      const link = document.createElement('a');
      link.href = url;
      link.download = `${filename}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    // Proxy the remote file download via the server endpoint to bypass client CORS policies
    const proxyUrl = `/api/download?url=${encodeURIComponent(url)}`;
    window.location.href = proxyUrl;
  };

  const fetchTasks = async () => {
    setIsLoadingTasks(tasksList.length === 0);
    try {
      const res = await apiFetch('/tasks');
      const data = await res.json();
      if (data.tasks) {
        setTasksList(data.tasks);
        localStorage.setItem('user_tasks', JSON.stringify(data.tasks));
      }
    } catch (err) {
      console.error("Failed to fetch tasks", err);
    } finally {
      setIsLoadingTasks(false);
    }
  };

  const refreshProfile = async () => {
    try {
      const res = await apiFetch('/users/me', {}, true);
      if (res.ok) {
        const data = await res.json();
        const userPayload = data.data || data;
        setTasksToday(userPayload.tasks_today ?? 0);
        setDailyLimit(userPayload.daily_task_limit ?? 5);
      }
    } catch (err) {
      console.error("Failed to refresh profile", err);
    }
  };

  const handleSelectTask = (t: any) => {
    setErrorMsg(null);
    setSelectedTaskId(t.task_id || t.id || null);
    if (t.status === 'completed') {
      const mediaUrl = t.video_url || t.cloudinary_url || t.url;
      const taskTypeLower = (t.task_type || '').toLowerCase();
      const isImage = taskTypeLower.includes('image') || taskTypeLower.includes('i2i');
      const isVideo = !isImage && (
        (t.video_url && t.video_url !== 'None' && t.video_url !== 'null') ||
        taskTypeLower.includes('video') || 
        taskTypeLower.includes('i2v') || 
        taskTypeLower.includes('t2v') ||
        (mediaUrl && (mediaUrl.includes('.mp4') || mediaUrl.includes('/video/')))
      );
      
      setTaskStatus('completed');
      if (isVideo) {
        setVideoUrl(mediaUrl);
        setImageUrl(null);
      } else {
        setImageUrl(mediaUrl);
        setVideoUrl(null);
      }
    } else if (t.status === 'failed') {
      setTaskStatus('failed');
      setErrorMsg("This task generation failed.");
      setVideoUrl(null);
      setImageUrl(null);
    } else {
      setTaskStatus('running');
      setProgressMsg("Task is currently generating...");
      setProgressVal(0);
      setVideoUrl(null);
      setImageUrl(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode !== 'i2v' && mode !== 'i2i' && !prompt.trim()) {
      setErrorMsg("Please enter a prompt.");
      return;
    }
    if ((mode === 'i2v' || mode === 'i2i') && !imageFile) {
      setErrorMsg(mode === 'i2v' && useKeyframes ? "Please upload a start frame image." : "Please upload a reference image.");
      return;
    }
    if (mode === 'i2v' && useKeyframes && !endImageFile) {
      setErrorMsg("Please upload an end frame image.");
      return;
    }
    
    setErrorMsg(null);
    setSelectedTaskId(null);
    setIsSubmitting(true);
    setTaskStatus('idle');
    setVideoUrl(null);
    setImageUrl(null);
    setProgressVal(0);
    setProgressMsg('Submitting task...');

    const aspectMap: Record<string, string> = {
      '1024x1024': '1:1',
      '1024x576': '16:9',
      '576x1024': '9:16'
    };
    const aspectVal = aspectMap[resolution] || '1:1';

    const form = new FormData();
    const requestMode = (mode === 'i2v' && useKeyframes) ? 'keyframes' : mode;
    form.append('mode', requestMode);
    if (prompt.trim()) form.append('prompt', prompt);
    if (mode !== 'i2i') {
      form.append('duration', duration.toString());
      const [w, h] = resolution.split('x');
      if (w && h) {
        form.append('video_width', w);
        form.append('video_height', h);
      }
    } else {
      form.append('size', resolution);
    }
    form.append('resolution', resolution);
    form.append('aspect_ratio', aspectVal);
    form.append('aspect', aspectVal);
    form.append('ratio', aspectVal);
    if (imageFile) form.append('reference_image', imageFile);
    if (mode === 'i2v' && useKeyframes && endImageFile) {
      form.append('end_frame_image', endImageFile);
    }

    try {
      if (mode === 'i2i') {
        setProgressMsg('Generating image...');
        const res = await apiFetch('/tasks/image', {
          method: 'POST',
          body: form
        });
        
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.detail || "Failed to generate image");
        }
        
        if (data.ok) {
          if (data.format === 'url') setImageUrl(data.url);
          else if (data.format === 'b64') setImageUrl(`data:image/${data.ext || 'png'};base64,${data.base64}`);
          setTaskStatus('completed');
          setIsSubmitting(false);
          fetchTasks(); // Refresh sidebar tasks
          refreshProfile(); // Update daily credit count
        }
      } else {
        const res = await apiFetch('/tasks/simple', {
          method: 'POST',
          body: form
        });
        
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.detail || "Failed to submit task");
        }
        
        if (data.ok && data.task_id) {
          setTaskId(data.task_id);
          connectWebSocket(data.task_id);
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || "An error occurred");
      setIsSubmitting(false);
      setTaskStatus('failed');
    }
  };

  const connectWebSocket = (id: string) => {
    setTaskStatus('running');
    setProgressMsg('Connecting to generation service...');
    
    const wsBaseUrl = activeApiUrl.replace('http', 'ws');
    const ws = new WebSocket(`${wsBaseUrl}/ws/${id}`);
    wsRef.current = ws;

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.progress !== undefined) setProgressVal(msg.progress * 100);
      if (msg.message) setProgressMsg(msg.message);
      
      if (msg.status === 'completed') {
        setTaskStatus('completed');
        setVideoUrl(`${activeApiUrl}/video/${id}`);
        setIsSubmitting(false);
        fetchTasks(); // Refresh sidebar tasks
        refreshProfile(); // Update daily credit count
        ws.close();
      } else if (msg.status === 'failed') {
        setTaskStatus('failed');
        setErrorMsg('Video generation failed.');
        setIsSubmitting(false);
        fetchTasks(); // Refresh sidebar tasks
        ws.close();
      }
    };

    ws.onclose = (e) => {
      if (e.code === 4001) {
        setErrorMsg("Authentication failed. Please log in again.");
        setIsSubmitting(false);
        setTaskStatus('failed');
      } else if (e.code === 4003) {
        setErrorMsg("Access denied to this task.");
        setIsSubmitting(false);
        setTaskStatus('failed');
      }
    };
  };
  const handleLogout = async () => {
    try {
      const tokenVal = getCookie('refresh_token');
      await fetch(`${activeApiUrl}/auth/logout`, {
        method: 'POST',
        headers: tokenVal ? { 'Content-Type': 'application/json' } : {},
        body: tokenVal ? JSON.stringify({ refresh_token: tokenVal }) : undefined,
        credentials: 'include'
      });
    } catch (e) {
      console.error(e);
    } finally {
      document.cookie = "refresh_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      document.cookie = "user_name=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      document.cookie = "user_avatar=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      localStorage.removeItem('user_profile');
      localStorage.removeItem('user_tasks');
      window.location.reload();
    }
  };

  const productionModes = [
    { id: 'i2i', name: 'Image Generation', shortName: 'Image Generation', icon: ImageIcon, hoverText: 'Generate new designs or enhance images' },
    { id: 'i2v', name: 'Video Generation', shortName: 'Video Generation', icon: Play, hoverText: 'Animate a reference image into video' }
  ];

  const currentModeInfo = productionModes.find(m => m.id === mode) || productionModes[0];
  const isLimitHit = user !== null && tasksToday >= dailyLimit;
  const isGenerateDisabled = isSubmitting || 
    isLimitHit ||
    (mode !== 'i2v' && mode !== 'i2i' && !prompt.trim()) || 
    ((mode === 'i2v' || mode === 'i2i') && !imageFile) ||
    (mode === 'i2v' && useKeyframes && !endImageFile);

  return (
    <div className="flex flex-col lg:flex-row gap-4 w-full h-full min-h-0 overflow-hidden text-slate-900">
      
      {/* LEFT COLUMN: Controls */}
      <form onSubmit={handleSubmit} className="w-full lg:w-[350px] h-full shrink-0 bg-white rounded-[1.5rem] border border-slate-300 flex flex-col overflow-hidden shadow-sm">
        
        {/* Sticky Top Header containing Tabs (Made smaller) */}
        <div className="p-4 pb-2 border-b border-slate-100 bg-white shrink-0 flex flex-col items-center w-full gap-1.5">
          {/* Mode Selector Tabs */}
          <div className="flex items-center gap-1.5 p-1.5 bg-slate-50 border border-slate-100 rounded-xl w-full justify-between relative">
            {productionModes.map((m) => {
              const isActive = mode === m.id;
              const Icon = m.icon;
              
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setMode(m.id as any);
                    setErrorMsg(null);
                  }}
                  title={m.hoverText}
                  className={`flex-grow flex-1 py-2 flex items-center justify-center rounded-lg transition-all cursor-pointer relative z-10 ${
                    isActive 
                      ? "text-slate-950 font-black" 
                      : "text-slate-400 hover:text-slate-600"
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeTabBg"
                      className="absolute inset-0 bg-amber-100 border-2 border-slate-950 rounded-lg z-0 shadow-sm"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  <Icon className="w-4 h-4 relative z-10" />
                </button>
              );
            })}
          </div>
          <div className="h-3 flex items-center justify-center overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.span
                key={mode}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.15 }}
                className="text-[9px] font-black text-amber-600 uppercase tracking-wider block"
              >
                {currentModeInfo.name}
              </motion.span>
            </AnimatePresence>
          </div>
        </div>

        {/* Scrollable Form Body */}
        <div className="p-4 pb-2 overflow-y-auto flex-grow flex flex-col gap-4">
          
          {/* Keyframe Checkbox (Only for Video tab) */}
          {mode === 'i2v' && (
            <div className="flex items-center gap-2.5 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl hover:border-slate-350 transition-all cursor-pointer">
              <input 
                type="checkbox"
                id="keyframe-checkbox"
                checked={useKeyframes}
                onChange={(e) => setUseKeyframes(e.target.checked)}
                className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-slate-350 cursor-pointer accent-amber-500"
                disabled={isSubmitting}
              />
              <label 
                htmlFor="keyframe-checkbox" 
                className="text-[10px] font-black text-slate-700 uppercase tracking-wider cursor-pointer select-none flex-grow"
              >
                Keyframes Mode (Start & End)
              </label>
            </div>
          )}

          {/* 1. Start Frame / Reference Image */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-455 uppercase tracking-[0.2em] ml-1">
              {mode === 'i2v' && useKeyframes ? 'Start Frame' : 'Reference Image'} <span className="text-amber-500">*</span>
            </label>
            
            {imagePreview ? (
              <div className="relative rounded-xl overflow-hidden border-2 border-amber-500/80 shadow-[0_0_12px_rgba(245,158,11,0.15)] bg-amber-50/5 inline-block w-full transition-all">
                <img src={imagePreview} alt={mode === 'i2v' && useKeyframes ? 'Start Frame preview' : 'Reference preview'} className="max-h-[110px] object-contain mx-auto" />
                <button 
                  type="button"
                  onClick={removeImage}
                  className="absolute top-2 right-2 bg-slate-900/60 hover:bg-red-500 text-white p-1.5 rounded-lg backdrop-blur-md transition-all shadow-md z-10"
                  disabled={isSubmitting}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="relative h-[110px] w-full">
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleImageChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                  disabled={isSubmitting}
                />
                <div className="bg-slate-50 border-2 border-dashed border-slate-200 hover:border-amber-500/40 rounded-xl p-3 text-center transition-colors h-full flex flex-col justify-center items-center">
                  <Upload className="w-5 h-5 text-slate-400 mb-1" />
                  <p className="text-slate-800 text-xs font-semibold">Upload {mode === 'i2v' && useKeyframes ? 'Start Frame' : 'Reference Image'}</p>
                  <p className="text-slate-400 text-[10px]">PNG, JPG up to 10MB</p>
                </div>
              </div>
            )}
          </div>

          {/* 1b. End Frame (Only visible when Keyframes Mode is checked in Video mode) */}
          {mode === 'i2v' && useKeyframes && (
            <div className="space-y-1.5 animate-fadeIn">
              <label className="text-[10px] font-black text-slate-455 uppercase tracking-[0.2em] ml-1">
                End Frame <span className="text-amber-500">*</span>
              </label>
              
              {endImagePreview ? (
                <div className="relative rounded-xl overflow-hidden border-2 border-amber-500/80 shadow-[0_0_12px_rgba(245,158,11,0.15)] bg-amber-50/5 inline-block w-full transition-all">
                  <img src={endImagePreview} alt="End Frame preview" className="max-h-[110px] object-contain mx-auto" />
                  <button 
                    type="button"
                    onClick={() => {
                      setEndImageFile(null);
                      setEndImagePreview(null);
                    }}
                    className="absolute top-2 right-2 bg-slate-900/60 hover:bg-red-500 text-white p-1.5 rounded-lg backdrop-blur-md transition-all shadow-md z-10"
                    disabled={isSubmitting}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="relative h-[110px] w-full">
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        const file = e.target.files[0];
                        setEndImageFile(file);
                        setEndImagePreview(URL.createObjectURL(file));
                      }
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                    disabled={isSubmitting}
                  />
                  <div className="bg-slate-50 border-2 border-dashed border-slate-200 hover:border-amber-500/40 rounded-xl p-3 text-center transition-colors h-full flex flex-col justify-center items-center">
                    <Upload className="w-5 h-5 text-slate-400 mb-1" />
                    <p className="text-slate-800 text-xs font-semibold">Upload End Frame</p>
                    <p className="text-slate-400 text-[10px]">PNG, JPG up to 10MB</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 2. Prompt */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-455 uppercase tracking-[0.2em] ml-1">
              Prompt
            </label>
            <textarea 
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Add optional text guidance..."
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/10 focus:border-amber-500/50 transition-all placeholder:text-slate-350 shadow-sm h-[72px] resize-none"
              disabled={isSubmitting}
            />
          </div>

          {/* 3. Resolution dropdown */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-455 uppercase tracking-[0.2em] ml-1">Resolution</label>
            <div className="relative" ref={resolutionDropdownRef}>
              <button
                type="button"
                onClick={() => setShowResolutionDropdown(!showResolutionDropdown)}
                disabled={isSubmitting}
                className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl text-[11px] font-bold text-slate-800 focus:outline-none transition-all flex items-center justify-between cursor-pointer disabled:cursor-not-allowed ${
                  showResolutionDropdown 
                    ? 'border-amber-500/50 ring-2 ring-amber-500/10' 
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  {getResolutionIcon(resolution)}
                  <span>{resolutionOptions.find(o => o.value === resolution)?.label || resolution}</span>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${showResolutionDropdown ? "rotate-180" : ""}`} />
              </button>

              <AnimatePresence>
                {showResolutionDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.15 }}
                    className="absolute bottom-full left-0 right-0 mb-1.5 bg-white border border-slate-200 shadow-xl z-50 rounded-xl overflow-hidden max-h-[180px] overflow-y-auto"
                  >
                    {resolutionOptions.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          setResolution(opt.value);
                          setShowResolutionDropdown(false);
                        }}
                        className={`w-full text-left px-3.5 py-2 text-[11px] font-bold transition-all cursor-pointer border-b border-slate-100 last:border-0 flex items-center gap-2 ${
                          resolution === opt.value
                            ? "bg-amber-100/70 text-slate-900 font-black"
                            : "bg-white text-slate-700 hover:bg-amber-50/50 hover:text-slate-900"
                        }`}
                      >
                        {getResolutionIcon(opt.value)}
                        <span>{opt.label}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* 4. Duration select (Only for video) */}
          {mode !== 'i2i' && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-455 uppercase tracking-[0.2em] ml-1">Duration</label>
              <div className="relative" ref={durationDropdownRef}>
                <button
                  type="button"
                  onClick={() => setShowDurationDropdown(!showDurationDropdown)}
                  disabled={isSubmitting}
                  className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl text-[11px] font-bold text-slate-800 focus:outline-none transition-all flex items-center justify-between cursor-pointer disabled:cursor-not-allowed ${
                    showDurationDropdown 
                      ? 'border-amber-500/50 ring-2 ring-amber-500/10' 
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <span>{durationOptions.find(o => o.value === duration)?.label || `${duration} Seconds`}</span>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${showDurationDropdown ? "rotate-180" : ""}`} />
                </button>

                <AnimatePresence>
                  {showDurationDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      transition={{ duration: 0.15 }}
                      className="absolute bottom-full left-0 right-0 mb-1.5 bg-white border border-slate-200 shadow-xl z-50 rounded-xl overflow-hidden max-h-[180px] overflow-y-auto"
                    >
                      {durationOptions.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          disabled={opt.disabled}
                          onClick={() => {
                            if (!opt.disabled) {
                              setDuration(opt.value);
                              setShowDurationDropdown(false);
                            }
                          }}
                          className={`w-full text-left px-3.5 py-2 text-[11px] font-bold transition-all border-b border-slate-100 last:border-0 ${
                            opt.disabled
                              ? "bg-white text-slate-300 cursor-not-allowed"
                              : duration === opt.value
                                ? "bg-amber-100/70 text-slate-900 font-black cursor-pointer"
                                : "bg-white text-slate-700 hover:bg-amber-50/50 hover:text-slate-900 cursor-pointer"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}

        </div>

        {/* Sticky Form Footer containing button centered and matching content width */}
        <div className="p-6 pt-2 pb-6 border-t border-slate-100 bg-white shrink-0 flex items-center justify-center">

          {!authChecked ? (
            <div className="w-full py-2.5 bg-slate-100 rounded-xl flex items-center justify-center gap-2 border border-slate-200">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Checking...</span>
            </div>
          ) : user ? (
            isLimitHit ? (
              <div className="w-full py-2.5 bg-red-50 border border-red-100 rounded-xl flex items-center justify-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                <span className="text-[10px] font-black text-red-500 uppercase tracking-wider">Today's limit reached — resets in 24h</span>
              </div>
            ) : (
              <button
                type="submit"
                disabled={isGenerateDisabled}
                className={`w-full py-2.5 font-black rounded-xl transition-all flex items-center justify-center gap-2 uppercase tracking-wider text-[10px] border cursor-pointer ${
                  isSubmitting 
                    ? "bg-slate-900/10 text-slate-500 border-slate-200 cursor-wait" 
                    : isGenerateDisabled
                      ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60"
                      : "bg-slate-900 hover:bg-slate-800 text-white border-transparent hover:scale-[1.01] active:scale-95 shadow-md font-black"
                }`}
              >
                {isSubmitting ? (
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Processing...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <Sparkles className="w-3.5 h-3.5" />
                    <AnimatePresence mode="wait">
                      <motion.span
                        key={mode}
                        initial={{ opacity: 0, y: -2 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 2 }}
                        transition={{ duration: 0.15 }}
                      >
                        Generate {mode === 'i2i' ? 'Image' : 'Video'}
                      </motion.span>
                    </AnimatePresence>
                  </div>
                )}
              </button>
            )
          ) : (
            <a
              href={`${activeApiUrl}/auth/google?redirect_to=${encodeURIComponent(typeof window !== 'undefined' ? window.location.origin + '/ai-studio' : 'http://localhost:4321/ai-studio')}`}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-850 text-white text-[10px] font-black uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 transition-all border border-transparent shadow-md hover:scale-[1.01] active:scale-95 cursor-pointer"
            >
              <GoogleLogo />
              Sign In to Generate
            </a>
          )}
        </div>
      </form>

      {/* CENTER COLUMN: Visualization Viewport */}
      <div className="flex-1 min-w-0 bg-white rounded-[1.5rem] border border-slate-300 overflow-hidden relative flex flex-col justify-center items-center p-6 shadow-sm">
        {errorMsg && (
          <div className="absolute top-6 left-6 right-6 bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl flex items-center gap-3 z-10">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="text-xs font-semibold flex-1">{errorMsg}</p>
            <button onClick={() => setErrorMsg(null)} className="text-red-500 hover:text-red-755"><X className="w-4 h-4" /></button>
          </div>
        )}

        {isSubmitting || taskStatus === 'running' ? (
          <div className="flex flex-col items-center justify-center max-w-sm text-center">
            <div className="relative mb-6">
              <Loader2 className="w-14 h-14 text-amber-500 animate-spin stroke-[1.5]" />
              <div className="absolute inset-0 bg-amber-500/10 rounded-full blur-xl animate-pulse" />
            </div>
            <span className="text-[10px] font-black text-slate-800 uppercase tracking-[0.4em] animate-pulse">
              {progressMsg || 'Sending to AI Service'}
            </span>
            {progressVal > 0 && (
              <div className="w-48 mt-4">
                <div className="flex justify-between text-[9px] font-black text-amber-600 uppercase tracking-widest mb-1.5">
                  <span>Progress</span>
                  <span>{progressVal.toFixed(0)}%</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                  <div 
                    className="h-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-300 ease-out rounded-full"
                    style={{ width: `${progressVal}%` }}
                  />
                </div>
              </div>
            )}
            <p className="mt-4 text-[9px] text-slate-400 font-bold uppercase tracking-widest animate-pulse">
              Please do not close this window
            </p>
          </div>
        ) : taskStatus === 'completed' && (videoUrl || imageUrl) ? (
          <div className="h-full w-full flex flex-col justify-center items-center">
            <div className="w-full max-w-4xl h-full max-h-[85vh] flex flex-col items-center justify-center relative rounded-2xl overflow-hidden bg-slate-50 border border-slate-100 group">
              {videoUrl ? (
                <video 
                  src={videoUrl} 
                  controls 
                  autoPlay
                  loop
                  className="w-full h-full object-contain"
                />
              ) : (
                <img 
                  src={imageUrl || ''} 
                  alt="Generated design" 
                  className="w-full h-full object-contain"
                />
              )}

              {/* Download Button Overlay */}
              <button
                type="button"
                onClick={() => handleDownload(videoUrl || imageUrl || '')}
                className="absolute top-4 right-4 bg-slate-900/80 hover:bg-slate-950 text-white p-2.5 rounded-xl shadow-md backdrop-blur-md transition-all flex items-center gap-1.5 text-xs font-black uppercase tracking-wider cursor-pointer z-10 hover:scale-[1.03] active:scale-95"
                title="Download Result"
              >
                <Download className="w-4 h-4" />
                <span>Download</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center max-w-sm px-6 flex flex-col items-center">
            <div className="w-20 h-20 bg-slate-50 rounded-[24px] flex items-center justify-center mx-auto mb-6 border border-slate-100 shadow-inner">
              <LayoutDashboard className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tighter">Ready for Production</h3>
            <p className="text-slate-400 text-xs font-semibold mt-3 leading-relaxed max-w-xs">
              Upload reference image and describe your prompt to start the AI generation process.
            </p>
          </div>
        )}
      </div>

      {/* RIGHT COLUMN: Task/History Sidebar */}
      <div className="w-full lg:w-[300px] h-full shrink-0 bg-white rounded-[1.5rem] border border-slate-300 flex flex-col overflow-hidden shadow-sm">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10">
              <History className="w-4 h-4 text-amber-600" />
            </div>
            <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-800">
              My Tasks
            </h2>
          </div>
          {user && (
            <button 
               onClick={fetchTasks}
               disabled={isLoadingTasks}
               className="p-2 hover:bg-slate-50 rounded-lg text-slate-450 hover:text-slate-700 transition-all disabled:opacity-50"
               title="Refresh History"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingTasks ? "animate-spin" : ""}`} />
            </button>
          )}
        </div>

        {/* Scrollable Tasks List */}
        <div className="flex-1 overflow-y-auto p-6">
          {!authChecked ? (
            <div className="h-full flex flex-col items-center justify-center gap-2 opacity-50">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Syncing history...</p>
            </div>
          ) : !user ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-4">
              <LogIn className="w-8 h-8 text-slate-350 mb-3" />
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest leading-relaxed">
                Sign in to view history
              </p>
            </div>
          ) : isLoadingTasks ? (
            <div className="h-full flex flex-col items-center justify-center py-20 gap-3 opacity-50">
              <RefreshCw className="w-8 h-8 animate-spin text-amber-500" />
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Loading tasks...</p>
            </div>
          ) : tasksList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center bg-slate-50/50 border border-dashed border-slate-200 rounded-2xl gap-6">
              <div className="w-16 h-16 bg-white rounded-[20px] shadow-sm flex items-center justify-center border border-slate-100">
                 <Plus className="w-8 h-8 text-slate-300" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-tighter">Vault Empty</h3>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed">Your productions will appear here</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {tasksList.map((t, idx) => {
                const mediaUrl = t.video_url || t.cloudinary_url || t.url;
                const isActive = selectedTaskId === (t.task_id || t.id);
                
                return (
                  <div 
                    key={idx} 
                    onClick={() => handleSelectTask(t)}
                    className={`p-4 rounded-xl flex flex-col gap-3 transition-all cursor-pointer border ${
                      isActive 
                        ? "bg-amber-50/70 border-amber-500/50 shadow-[0_0_12px_rgba(245,158,11,0.1)]" 
                        : "bg-slate-50 border-slate-100 hover:border-slate-200 hover:bg-slate-100/50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h4 className="text-slate-800 text-xs font-black uppercase truncate">
                          {t.creative_name || t.task_type || "Generated Media"}
                        </h4>
                        <p className="text-slate-450 text-[10px] mt-1 line-clamp-2 leading-relaxed">
                          {t.prompt || t.idea || t.task_id}
                        </p>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase shrink-0 ${
                        t.status === 'completed' ? 'bg-green-50 text-green-700 border border-green-100' :
                        t.status === 'failed' ? 'bg-red-50 text-red-600 border border-red-100' :
                        'bg-amber-50 text-amber-700 border border-amber-100'
                      }`}>
                        {t.status}
                      </span>
                    </div>

                    {mediaUrl && (
                      <div className="flex justify-between items-center mt-1 border-t border-slate-100 pt-3">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                          {t.task_type || 'Media'}
                        </span>
                        <button 
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectTask(t);
                          }}
                          className="bg-white hover:bg-slate-50 text-slate-700 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg transition-colors border border-slate-250 shadow-sm cursor-pointer"
                        >
                          View
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* User profile footer info inside Right Sidebar */}
        {user && (
          <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {user.avatar ? (
                <img src={user.avatar} alt={user.name || 'User'} className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold text-xs shrink-0">
                  {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                </div>
              )}
              <span className="text-slate-800 text-xs font-bold truncate">{user.name}</span>
            </div>
            <button 
              onClick={handleLogout}
              className="text-[9px] font-black text-slate-450 hover:text-slate-700 uppercase tracking-widest transition-colors shrink-0"
            >
              Sign Out
            </button>
          </div>
        )}
      </div>

    </div>
  );
};
