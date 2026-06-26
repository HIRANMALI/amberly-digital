# Agnes Video Generator v2.0 — System Design Document

> **Current Phase**: 🟢 v2.0 Completed — Maintenance Mode
> **Companion Documents**: `AGENTS.md` (Specifications), `docs/regression_test_plan.md` (Regression Testing)

## Part A: System Design

---

### 1. Implementation Details & Technical Selection

#### Core Technical Challenges

| Challenge | Analysis | Solution |
|------|------|------|
| **Three Heterogeneous Task Types** | Simple Video, Creative Video, and Manuscript Video have entirely different workflows, but share underlying API calls and video processing capabilities. | Layered architecture: Common layer (api/compositor/audio) + business pipeline layer (pipelines). |
| **Audio + Subtitle Compositing** | Requires generating TTS audio + synced subtitles after video segments are generated, then concatenating them. | Use edge_tts (free) to generate audio + SRT subtitles, overlaying subtitles using moviepy SubtitlesClip. |
| **Checkpoint Resume Compatibility** | Existing TaskManager is tightly coupled to the TaskState structure, which needs to generalize across three task types. | Introduce `task_type` field + Union types, keeping TaskManager backward compatible. |
| **Single HTML File Expansion** | Forms and config panels for the three task types vary significantly; a single file can bloat past 3000 lines. | Tab-switching architecture: shared JS handles common logic; separate rendering functions for each Tab. |
| **Video Concatenation Pacing** | Types 2/3 no longer use simple concat. Each segment must composite audio and subtitles before merging. | Compositor layer provides unified `concat_with_audio()` utility. |

#### Technical Stack Selection

| Component | Choice | Rationale |
|------|------|------|
| **Backend Framework** | FastAPI (Keep) | Existing framework with robust WebSocket support. |
| **Data Models** | Pydantic v2 (Keep) | Existing dependency with strong type safety. |
| **Video Processing** | moviepy + ffmpeg (Keep) | moviepy provides native SubtitlesClip support for subtitle overlays. |
| **TTS Engine** | edge_tts (New) | Free, no API Key required, supports multi-language + multi-voice roles, and returns cues (subtitle timestamps) via SubMaker. |
| **Subtitle Format** | SRT (Standard) | easy conversion from edge_tts cues → SRT; moviepy SubtitlesClip reads SRT natively. |
| **Asynchronous Engine** | asyncio (Keep) | Existing architecture; ideal for asynchronous video status polling. |
| **Frontend Framework** | HTML/CSS/JS + Tailwind CDN (Keep) | Lightweight SPA, zero build toolchains. |
| **LLM Inference** | requests (Sync, Keep existing) | Screenwriter executes within `asyncio.to_thread` executors. |

#### Excluded Dependencies

| Candidate | Rationale |
|------|------|
| Celery / Redis | Single-node deployment; `asyncio.create_task` is sufficient. |
| React / Vue | Keep zero-build steps; Tailwind CDN is enough. |
| Paid TTS APIs | PRD strictly defines migrating to edge_tts free solution. |

---

### 2. Complete File Directory

```
agnes-video-generator/
│
├── server.py                         # [Modify] FastAPI main service: new routes, unified task management
├── start.sh                          # [Keep]
├── requirements.txt                  # [Modify] Add edge_tts, srt
│
├── models/
│   ├── __init__.py                   # [Modify] Export new models
│   └── task.py                       # [Rewrite] Generalize TaskState, add TaskType/SimpleTask/ManuscriptTask/AudioConfig/SubtitleStyle
│
├── core/
│   ├── __init__.py                   # [Modify]
│   ├── config.py                     # [Modify] Add default audio/subtitle configurations
│   │
│   ├── api/                          # [New] API Service Layer (Common)
│   │   ├── __init__.py
│   │   ├── agnes_image.py            # [Migrate + Refactor] From core/image_generator.py
│   │   ├── agnes_video.py            # [Migrate + Refactor] From core/video_generator.py
│   │   └── agnes_chat.py             # [Extract] Generalize LLM chat methods from screenwriter.py
│   │
│   ├── compositor/                   # [New] Video Compositing Layer (Common)
│   │   ├── __init__.py
│   │   ├── concatenator.py           # Video concatenation & audio/subtitle synchronization
│   │   └── processor.py              # Video processing (resizing, transcoding, freeze frames, silence generation)
│   │
│   ├── audio/                        # [New] Audio & Subtitle Layer (Common)
│   │   ├── __init__.py
│   │   ├── tts.py                    # TTS interface: EdgeTTSEngine + SilentTTSEngine
│   │   └── subtitle.py               # SRT generation & subtitle overlays
│   │
│   ├── pipelines/                    # [New] Pipelines Layer (Business flow)
│   │   ├── __init__.py               # BasePipeline (shared checkpoints, shutdown, and WS pusher)
│   │   ├── simple_video.py           # Pipeline: Simple video generation
│   │   ├── creative_video.py         # [Refactor] Pipeline: Creative long video (with audio/subtitles)
│   │   └── manuscript_video.py       # Pipeline: Manuscript long video
│   │
│   ├── screenwriter.py               # [Keep + Refactor] Screenplay Agent (used by Creative/Manuscript)
│   └── task_manager.py               # [Modify] Generalize multiple task states, backward compatibility
│
├── utils/
│   ├── __init__.py                   # [Keep]
│   ├── video.py                      # [Keep]
│   └── image.py                      # [Keep]
│
├── resource/
│   └── fonts/                        # CJK fonts for subtitle overlays
│       ├── STHeitiMedium.ttc         # Default CJK fallback font
│       └── MicrosoftYaHeiNormal.ttc  # Alternative CJK font
│
├── static/
│   └── index.html                    # [Rewrite] 3-Tab UI structure: Simple / Creative / Manuscript
│
└── docs/
    ├── system_design.md              # This document
    ├── sequence-diagram.mermaid      # Sequence diagram
    └── class-diagram.mermaid         # Class diagram
```

**Changes Summary**:
- New: 11 files (api/ ×3 + compositor/ ×2 + audio/ ×2 + pipelines/ ×3 + __init__.py ×3, minus 3 unified inits = **11 net new**)
- Rewritten/Refactored: 5 files (`models/task.py`, `core/config.py`, `core/task_manager.py`, `server.py`, `static/index.html`)
- Migrated: 3 files (`image_generator.py` → `api/`, `video_generator.py` → `api/`, `pipeline.py` → `pipelines/creative_video.py`)
- Kept intact: 6 files (`utils/` ×3, `screenwriter.py`, `start.sh`, `core/__init__.py`)

---

### 3. Data Structures & Interfaces

Refer to `class-diagram.mermaid` for the complete model hierarchy. Key definitions:

**Enums & Configurations**:

```
TaskType: SIMPLE | CREATIVE | MANUSCRIPT
StepStatus: PENDING | RUNNING | COMPLETED | FAILED
VideoMode: t2v | i2v | ti2vid | keyframes
```

**Model Hierarchy**:

```
BaseTaskState          — Shared base fields (task_id, task_type, status, video_width, video_height...)
├── SimpleVideoTask    — Simple video fields (prompt, mode, duration, seed, reference_image, end_frame_image, negative_prompt)
├── CreativeVideoTask  — Creative video fields (existing fields + audio_config, narrations[])
└── ManuscriptVideoTask— Manuscript fields (manuscript_text, paragraphs[], audio_config)

AudioConfig            — Audio configurations (voice, rate, enabled)
SubtitleStyle          — Subtitle styles (font, color, position, fontsize, stroke_color, stroke_width, bg_color)
ManuscriptParagraph    — Manuscript segments (index, text, scene_prompt, video_file, narration_audio, subtitle_srt)
SceneTask              — Scene state structure (kept intact)
```

**Service Classes**:

```
AgnesImageAPI          — Image generation API wrapper (t2i/i2i)
AgnesVideoAPI          — Video generation API wrapper (t2v/i2v/ti2vid/keyframes)
AgnesChatAPI           — LLM Chat API wrapper (text + multimodal JSON)
TTSEngine (Abstract)   — TTS Engine base class
├── EdgeTTSEngine      — edge_tts implementation
└── SilentTTSEngine    — Muted placeholders generation
SubtitleGenerator      — Subtitle generator (cues→SRT, SRT overlays)
VideoConcatenator      — Video merger (pure merge / merge with audio)
VideoProcessor         — Process video dimensions, freeze frames, extract thumbnails
TaskManager            — Persistence manager
Screenwriter           — Scriptwriter Agent
SimpleVideoPipeline    — Simple video pipeline execution flow
CreativeVideoPipeline  — Creative video pipeline execution flow
ManuscriptVideoPipeline— Manuscript video pipeline execution flow
```

---

### 4. Application Workflows

Refer to `sequence-diagram.mermaid` for sequence processes:
1. **Simple Video Generation**: POST `/api/tasks/simple` → `SimpleVideoPipeline.run()` → `AgnesVideoAPI.submit` → poll → save
2. **Creative Video Generation**: POST `/api/tasks/creative` → `CreativeVideoPipeline.run()` → story → script → video → audio + subtitles overlay → concatenate
3. **Manuscript Video Generation**: POST `/api/tasks/manuscript` → `ManuscriptVideoPipeline.run()` → split text → scene prompt → generate videos → TTS + subtitles overlay → concatenate

---

### 5. Architectural Decisions

| # | Topic | Decision |
|---|------|---------|
| D1 | Manuscript Split Strategy | **Split by speech duration**: Estimate speech duration per sentence (~4 chars/sec), combine sentences into **5-12s segments**, ensuring sentence boundary integrity (don't split middle sentences). |
| D2 | Manuscript Scene Prompting | AI (Screenwriter) generates English scene prompts based on segment content. **The original text is used directly as narration audio + subtitles** (no extra narration rewriting). |
| D3 | edge_tts Default Voice | `zh-CN-XiaoxiaoNeural` (Young female), with 4 Chinese voice roles selectable. |
| D4 | Subtitle Customization Scope | P1: Font, size, color, position (top/bottom), stroke color, stroke width, background color (semi-transparent). |
| D5 | Simple Video Inputs | Expose all Agnes API parameters (mode, reference images, duration, resolution, seed, negative prompt) directly on the UI form. **No AI enhancement** is performed. |
| D6 | Compatibility | Backward compatibility: `TaskManager.load()` automatically parses older records lacking `task_type` as `CreativeVideoTask`. |
| D7 | Default Resolution | Default to 768×1152 (Portrait 9:16), with 3 resolution presets (portrait, landscape, square) provided in the UI. |
| D8 | Video-Audio Pacing | **≤ 1 second**. `video_duration = max(audio_duration + 1.0, original_video_duration)`. |

---

### 6. edge_tts Specifications

| Item | Details |
|------|------|
| Invocation | `edge_tts.Communicate(text, voice, rate).run()` → SubMaker |
| cues Structure | `Dict[float, str]` — key is accumulated seconds, value is word token |
| SRT Generation | Accumulate cues by time limit / sentence boundaries → format timestamp `HH:MM:SS,mmm` |
| Default Voice | `zh-CN-XiaoxiaoNeural`, options YunyangNeural / XiaoyiNeural / YunxiNeural |
| Speech Rate | `rate="+0%"` (default normal), adjustable ±30% |

---

### 7. Agnes Video API Parameter Space

Based on parameters used in `core/api/agnes_video.py`:

| Parameter | Type | Mode | Description |
|------|------|---------|------|
| `prompt` | str | All | Scene description prompt (English works best) |
| `width` | int | All | Video width (px) |
| `height` | int | All | Video height (px) |
| `num_frames` | int | All | Total frames = duration × frame_rate + 1 |
| `frame_rate` | int | All | Framerate (24 or 22 fps) |
| `seed` | int? | All | Random seed for reproducibility |
| `negative_prompt` | str? | All | Negative prompt to exclude elements |
| `image` | str? | i2v/ti2vid | Reference image URL/base64 (for i2v/ti2vid modes) |
| `mode` | str? | i2v | `"ti2vid"` |
| `extra_body.image` | str[]? | keyframes | Keyframe images list (for keyframes mode) |
| `extra_body.mode` | str? | keyframes | `"keyframes"` |

---

### 8. Manuscript Split Algorithm

```
split_manuscript(text) → List[ManuscriptParagraph]:
  1. Split text into candidate sentences using newline/punctuation markers.
  2. For each sentence, estimate speaking duration = len(text) / 4.0 (Chinese rate ~4 chars/sec)
  3. Greedy combine sentences: target duration ∈ [5, 12] seconds.
     - Short sentences (< 5s) combined into adjacent segment
     - Long sentences (> 12s) accepted without split
  4. Return segments list containing index, text, est_duration
```

---

## Part B: Implementation Tasks

---

### 9. Dependency List

```
# Core
fastapi>=0.100.0
uvicorn>=0.23.0
websockets>=12.0
requests>=2.28.0
pydantic>=2.0.0
PyYAML>=6.0
moviepy>=1.0.3
tenacity>=8.0.0
python-multipart>=0.0.6

# Added
edge_tts>=6.1.0          # Azure Edge TTS, free
srt>=3.5.0               # SRT parser & composer
```

---

### 10. Task Decomposition

---

#### **T01: Infrastructure & Data Model Layer**

- **Task ID**: T01
- **Priority**: P0
- **Dependencies**: None
- **Files**:
  - `requirements.txt` — Add edge_tts>=6.1.0, srt>=3.5.0
  - `models/task.py` — Rewrite: Generalize task states, TaskType enum, config classes, paragraph models
  - `models/__init__.py` — Update exports
  - `core/config.py` — Add default configurations
  - `core/task_manager.py` — Generalize load/save, backward compatibility (no task_type → CREATIVE)

---

#### **T02: Common Components Layer — APIs, Audio, Compositing**

- **Task ID**: T02
- **Priority**: P0
- **Dependencies**: T01
- **Files**:
  - `core/api/` — Export wrappers; `agnes_image.py` (migrated from image_generator.py), `agnes_video.py` (migrated from video_generator.py), `agnes_chat.py` (extracted from screenwriter.py)
  - `core/audio/` — TTSEngine, EdgeTTSEngine, SilentTTSEngine, SubtitleGenerator (cues→SRT + moviepy overlays)
  - `core/compositor/` — VideoConcatenator (concat / concat_with_audio), VideoProcessor (resize, thumbnail extraction, freeze frame, silence generation)

---

#### **T03: Business Pipeline Layer**

- **Task ID**: T03
- **Priority**: P0
- **Dependencies**: T02
- **Files**:
  - `core/pipelines/__init__.py` — BasePipeline definition
  - `core/pipelines/simple_video.py` — SimpleVideoPipeline
  - `core/pipelines/creative_video.py` — CreativeVideoPipeline (incorporating audio/subtitle steps)
  - `core/pipelines/manuscript_video.py` — ManuscriptVideoPipeline
  - `core/screenwriter.py` — Update dependencies, add `generate_scene_prompt_for_paragraph()`

---

#### **T04: Server Integration & WebSocket**

- **Task ID**: T04
- **Priority**: P0
- **Dependencies**: T03
- **Files**:
  - `server.py` — Rewrite routes, add task routes (POST /api/tasks/simple, creative, manuscript), Pipeline factory, WebSocket management
  - `core/__init__.py` — Update top-level exports

---

#### **T05: Frontend SPA Restructuring**

- **Task ID**: T05
- **Priority**: P0
- **Dependencies**: T04
- **Files**:
  - `static/index.html` — Complete rewrite to 3-Tab layout with customized forms and i18n support.

---

### 11. Specifications & Log Standards

Refer to `AGENTS.md` for coding, logging prefixes, and synchronization strategies.
