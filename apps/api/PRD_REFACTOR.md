# Agnes Video Generator v2.0 Large-Scale Refactoring PRD

> **Current Phase**: 📦 Archived — v2.0 development is fully completed
> **Companion Documents**: `AGENTS.md` (Development Guidelines), `docs/system_design.md` (Architecture Design)

## Project Information

| Attribute | Value |
|------|-----|
| **Language** | English (en-US) |
| **Programming Language** | Python FastAPI + Native HTML/CSS/JS + Tailwind CSS CDN |
| **Project Name** | `agnes_video_generator` |
| **Original Requirement** | On top of the existing "Creative Video Generation" feature, add two new task types: "Simple Video Generation" and "Manuscript Video Generation". Introduce free voiceover narration + subtitle capabilities based on edge_tts, and complete code layered refactoring. |

---

## 1. Product Goals

1. **Unified Entry for Three Task Types**: Users can select from "Simple Video", "Creative Long Video", and "Manuscript Long Video" modes on a single page, configure parameters, and generate videos independently.
2. **Free Narration Audio + Subtitles**: Auto-generate voiceover narration and synced subtitles for videos based on edge_tts (free, no API Key required). Support subtitle style customization, covering both Creative Video and Manuscript Video scenarios.
3. **Layered Code Architecture Refactoring**: Split tightly coupled code into four layers: `core/api/`, `core/compositor/`, `core/audio/`, and `core/pipelines/`. Ensure common components are reusable and pipelines operate independently.

---

## 2. User Stories

### Type 1: Simple Video Generation

- **US1-1**: As a general user, I want to input a prompt, select "Text-to-Video" mode, set the duration and resolution, and click generate to quickly get an AI video without needing complex workflows like story writing.
- **US1-2**: As an advanced user, I want to upload a reference image in "Image-to-Video" mode, where the Agnes model generates a video based on that image + my prompt; or upload both a start frame and an end frame in "Keyframes" mode to control the video's motion trajectory.

### Type 2: Creative Video Generation (Existing Feature Enhancement)

- **US2-1**: As a content creator, during the existing "idea → story → script → scenes → video" workflow, the system should automatically generate AI voiceover narration and subtitles for each video segment after video generation, resulting in a complete story video with narration.
- **US2-2**: As a content creator with custom needs, I want to select different voice roles (e.g., "Gentle Female - Xiaoxiao" or "Steady Male - Yunyang") and adjust subtitle styles (font color, size, position) to match my video's theme.

### Type 3: Manuscript Video Generation

- **US3-1**: As a media operator, I want to paste an article, and have the system automatically split it into segments, generate corresponding video frames for each, and overlay narration read directly from the original text + synced subtitles, quickly converting text to video.
- **US3-2**: As a video editor, I want to allow multiple video segments to share a single character/scene in "Chaining Mode" (keyframes chaining) to ensure visual continuity; or choose "Independent Mode" so each segment has a different visual style.

---

## 3. Product Backlog

### P0 — Core Requirements (Must have)

| ID | Feature | Description |
|----|------|------|
| P0-1 | **Simple Video Generation Pipeline** | Create `SimpleVideoPipeline`: User inputs prompt → selects mode (t2v / i2v / keyframes) → calls Agnes video API → returns video. Reuses the `generate_single_video()` logic in `video_generator.py`. |
| P0-2 | **Manuscript Video Generation Pipeline** | Create `ArticleVideoPipeline` (ManuscriptVideoPipeline): Long text → AI split → segment prompt generation → video API call → concatenation. Supports "Chaining" and "Independent" scene modes. |
| P0-3 | **edge_tts Narration Generation** | Migrate edge_tts free solution from MoneyPrinterTurbo to `core/audio/tts.py`: supports Azure Edge TTS v1 (free), including speech rate adjustment and multiple voice role options. |
| P0-4 | **SRT Subtitle Generation & Overlay** | Migrate subtitle logic to `core/audio/subtitle.py`: automatically generate SRT subtitles from edge_tts cues, overlay onto video using moviepy SubtitlesClip. |
| P0-5 | **Creative Video Audio Integration** | Add audio + subtitle synthesis step to existing `VideoPipeline` after video generation: generate TTS audio and subtitles for each scene → merge with moviepy → concatenate. |
| P0-6 | **Code Layered Refactoring (API & Compositor)** | Migrate `image_generator.py` → `core/api/agnes_image.py`, `video_generator.py` → `core/api/agnes_video.py`; extract concatenation logic from pipelines to `core/compositor/concatenator.py`. |
| P0-7 | **Frontend Task Type Switcher** | Change the single-page layout to a Tab structure supporting three task types, displaying distinct configuration forms for each. |

### P1 — Important Requirements (Should have)

| ID | Feature | Description |
|----|------|------|
| P1-1 | **Narration Voice Role Selection** | In Creative and Manuscript modes, users can select from edge_tts Chinese voice roles (zh-CN-XiaoxiaoNeural, YunyangNeural, XiaoyiNeural, YunxiNeural, etc.). |
| P1-2 | **Subtitle Style Configuration** | Support adjusting subtitle font, size, color, position (bottom/top), stroke color, and stroke width. |
| P1-3 | **Manuscript - Chaining Mode** | After splitting text, chain scenes using keyframes mode: generate reference image for the first segment → first frame of segment N = end frame of segment N-1 → ensure visual continuity. |
| P1-4 | **Pre-concatenate Audio + Subtitles per Clip** | Generate audio + subtitles for each scene segment and composite them (video + audio + subtitle → output_segment.mp4), then concatenate them to ensure sync. |
| P1-5 | **Silent Narration Mode (Mute Placeholder)** | Users can choose "No Voiceover". The system generates silent audio as a timeline to drive subtitle display so subtitles still render properly. |
| P1-6 | **Video Padded for Audio Duration** | In manuscript mode, ensure each video clip duration is 1-2 seconds longer than its narration audio to prevent abrupt video truncation at narration end. |

### P2 — Nice to Have (Nice to have)

| ID | Feature | Description |
|----|------|------|
| P2-1 | **Real-Time Subtitle Preview** | Provide static preview images when users adjust subtitle styling. |
| P2-2 | **Multilingual TTS Support** | Expand the edge_tts voice role list to support English, Japanese, Korean, and other languages. |
| P2-3 | **Retain Manuscript Format** | Support pasting rich text/Markdown, automatically cleaning format before splitting segments. |
| P2-4 | **Video Generation Progress Optimization** | In simple video mode, display estimated remaining time during polling. |

---

## 4. UI Design Overview

### Overall Layout (Native HTML, Single Page App)

```
┌─────────────────────────────────────────────────┐
│  Header: Agnes Video Generator Title + Lang      │
├─────────────────────────────────────────────────┤
│  API Key Configuration Area (Shared)             │
├─────────────────────────────────────────────────┤
│  ┌─────────────┬─────────────┬─────────────┐    │
│  │ 🎬 Simple    │ 🎥 Creative │ 📝 Manuscript│    │
│  │   Video     │   Video     │   Video     │    │
│  └─────────────┴─────────────┴─────────────┘    │
│  ←── Three Task Type Tabs (Active highlighted) ──→  │
├─────────────────────────────────────────────────┤
│  Display different forms depending on active Tab:│
│                                                 │
│  [Simple Video Tab]                             │
│  • Prompt Input                                 │
│  • Mode Selection: Text2Video / Image2Video /   │
│    Keyframes                                    │
│  • Reference Image Upload (if applicable)       │
│  • Res Choice  • Duration Choice (5/10/15/18/20s)│
│  • [Generate Video] Button                      │
│                                                 │
│  [Creative Video Tab]                           │
│  • Creative Idea, Requirements, Style, Chaining │
│  • Voiceover Narration toggle & Voice Role      │
│  • Subtitle Style Customization (Accordion)     │
│  • [Generate Creative Video] Button             │
│                                                 │
│  [Manuscript Video Tab]                         │
│  • Manuscript Text Box (Large textarea)         │
│  • Scene Mode: Chaining / Independent           │
│  • Segment Duration: 5-12s range                │
│  • Style Description (Optional)                 │
│  • Voice Role / Subtitle Configuration          │
│  • [Generate Manuscript Video] Button           │
├─────────────────────────────────────────────────┤
│  Progress Display Panel (Shared WS Progress Bar)│
│  Task History List (Shared)                     │
└─────────────────────────────────────────────────┘
```

### Key Interactions

- **Tab switching** preserves/clears form data per tab (allowing users to switch back and continue editing).
- **Simple Video mode** does not display narration or subtitle options (no audio processing involved).
- **Subtitle style configuration** is collapsed by default, expanding to show options like font, color, position, etc.
- All three modes share the same real-time progress panel and WebSocket communication channel.

---

## 5. Layered Code Architecture

```
core/
├── api/                          # API Service Layer (Common)
│   ├── __init__.py
│   ├── agnes_image.py            # Migrated from image_generator.py
│   └── agnes_video.py            # Migrated from video_generator.py
│
├── audio/                        # Audio & Subtitle Layer (Common)
│   ├── __init__.py
│   ├── tts.py                    # edge_tts integration
│   ├── subtitle.py               # SRT subtitle generation & overlay
│   └── voices.py                 # TTS voice role lists
│
├── compositor/                   # Video Compositing Layer (Common)
│   ├── __init__.py
│   └── concatenator.py           # Video concatenation, audio mixing
│
├── pipelines/                    # Business Pipeline Layer (Independent pipelines)
│   ├── __init__.py
│   ├── simple_video.py           # Pipeline 1: Simple video generation
│   ├── creative_video.py         # Pipeline 2: Creative video (from pipeline.py)
│   └── manuscript_video.py       # Pipeline 3: Manuscript video generation
│
├── screenwriter.py               # Screenplay & Script Generator Agent (Creative Video)
├── config.py                     # Configuration & defaults
└── task_manager.py               # Task status and checkpoints persistence
```

**Architecture Principles**:
- `core/api/`, `core/audio/`, and `core/compositor/` are common utilities shared by all pipelines.
- `core/pipelines/` holds the business logic; pipelines do not depend on one another.
- `screenwriter.py` is shared by Creative and Manuscript pipelines.

---

## 6. Key Decisions (Approved by User)

| # | Question | Decision |
|---|------|---------|
| D1 | Manuscript Segmenting Strategy | **Duration-based split**: Estimate narrator duration per sentence (~4 chars/sec), target **5-12 seconds** segments, using punctuation boundaries (periods, question marks) to avoid cutting middle sentences. |
| D2 | Manuscript Scene Prompting | AI (Screenwriter) generates English scene prompts based on segment content. **The original text is used directly as narration audio + subtitles** (no extra narration rewriting). |
| D3 | edge_tts Default Voice | `zh-CN-XiaoxiaoNeural` (Young female), with 4 Chinese voice roles selectable. |
| D4 | Subtitle Customization Scope | P1: Font, size, color, position (top/bottom), stroke color, stroke width, background color (semi-transparent). |
| D5 | Simple Video Inputs | Expose all Agnes API parameters (mode, reference images, duration, resolution, seed, negative prompt) directly on the UI form. **No AI enhancement** is performed. |
| D6 | Compatibility | Backward compatibility: `TaskManager.load()` automatically parses older records lacking `task_type` as `CreativeVideoTask`. |
| D7 | Default Resolution | Default to 768×1152 (Portrait 9:16), with 3 resolution presets (portrait, landscape, square) provided in the UI. |
| D8 | Video-Audio Pacing | **≤ 1 second**. `video_duration = max(audio_duration + 1.0, original_video_duration)`. |

---

## 7. Agnes Video API Analysis

Based on parameters used in `core/api/agnes_video.py`:

### 7.1 Video API Parameters — `POST /v1/videos`

| Parameter | Type | Description |
|------|------|------|
| `model` | str | `"agnes-video-v2.0"` (Fixed) |
| `prompt` | str | Scene description prompt (English works best) |
| `width` | int | Video width (px) |
| `height` | int | Video height (px) |
| `num_frames` | int | Total frames = duration × frame_rate + 1 |
| `frame_rate` | int | Framerate (24 or 22 fps) |
| `seed` | int? | Random seed for reproducibility |
| `negative_prompt` | str? | Negative prompt to exclude elements |
| `image` | str? | Reference image URL/base64 (for i2v/ti2vid modes) |
| `mode` | str? | `"ti2vid"` (when image is present) |
| `extra_body.image` | str[]? | Keyframe images list (for keyframes mode) |
| `extra_body.mode` | str? | `"keyframes"` (when keyframe images are present) |

### 7.2 Generation Modes

| Mode | Identifier | Required Parameters |
|------|---------|---------|
| Text-to-Video | `t2v` | prompt, duration, resolution, seed?, negative_prompt? |
| Image-to-Video | `i2v` / `ti2vid` | above + 1 reference image (image) |
| Keyframes Animation | `keyframes` | above + 2 reference images (start + end frame, extra_body.image) |

### 7.3 Duration-to-Frames Map

| Duration | num_frames | frame_rate |
|------|-----------|------------|
| 5s | 121 | 24 |
| 10s | 241 | 24 |
| 15s | 361 | 24 |
| 18s | 441 | 24 |
| 20s | 441 | 22 |

---

*Document Version: v2.0 | Authors: PM + Architect | Date: 2025-06-14 | Status: Approved*
