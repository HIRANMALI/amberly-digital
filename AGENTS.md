# AGENTS.md — Agnes Video Generator v2.0

> **Audience**: SoftwareCompany Team (Product Manager / Architect / Engineer / QA Engineer) and AI Agent
> **Current Phase**: 🟢 **Development Completed (v2.0) — Maintenance Mode**
> **Companion Documents**: `docs/system_design.md` (Architecture), `docs/regression_test_plan.md` (Regression Testing)

---

## 0. Environment Deployment & Verification (Must-read for AI Agents)

> This section provides full guidelines for AI Agents (Claude, Cursor, QoderWork, etc.) to deploy and verify this project in a clean environment.

### 0.1 Environment Check

Before performing any operations, ensure the target environment meets the following conditions:

```bash
# Check Python version (requires 3.10+)
python3 --version

# Check ffmpeg (required for video concatenation and audio processing)
ffmpeg -version

# If ffmpeg is not installed:
# macOS:   brew install ffmpeg
# Ubuntu:  sudo apt install ffmpeg
# Windows: choco install ffmpeg or download from https://ffmpeg.org/download.html
```

### 0.2 One-click Deployment

```bash
# Clone the project (if not already cloned)
git clone https://github.com/your-org/agnes-video-generator.git
cd agnes-video-generator

# One-click start (automatically creates venv, installs dependencies, and starts the service)
./start.sh
```

Upon successful startup, the service listens at `http://localhost:8765`. macOS will automatically open the page in the browser.

For manual deployment:

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python server.py
```

### 0.3 API Key Configuration

An Agnes AI API Key is required for video generation. Two configuration methods:

```bash
# Method 1: Environment Variable (Recommended for Agents)
export AGNES_API_KEY="your-api-key"

# Method 2: Via API (simulating Web UI operations)
curl -X POST http://localhost:8765/api/config \
  -H "Content-Type: application/json" \
  -d '{"api_key": "your-api-key"}'
```

### 0.4 Deployment Verification Checklist

After deployment, verify each item according to the checklist:

#### Layer 1: Basic Connectivity

```bash
# 1. Web UI is reachable
curl -s -o /dev/null -w "%{http_code}" http://localhost:8765/
# Expected: 200

# 2. API config reads normally
curl -s http://localhost:8765/api/config | python3 -m json.tool
# Expected: {"ok": true, "api_key": "...(masked)"}

# 3. TTS voice list is reachable
curl -s http://localhost:8765/api/voices | python3 -m json.tool
# Expected: returns a JSON array containing 4 voice roles

# 4. Task list is reachable
curl -s http://localhost:8765/api/tasks | python3 -m json.tool
# Expected: {"ok": true, "tasks": [...]}
```

#### Layer 2: Static Analysis

```bash
# Python syntax check (all .py files)
.venv/bin/python -m py_compile server.py
.venv/bin/python -m py_compile core/config.py
.venv/bin/python -m py_compile core/task_manager.py
.venv/bin/python -m py_compile core/screenwriter.py
.venv/bin/python -m py_compile core/api/agnes_chat.py
.venv/bin/python -m py_compile core/api/agnes_image.py
.venv/bin/python -m py_compile core/api/agnes_video.py
.venv/bin/python -m py_compile core/audio/tts.py
.venv/bin/python -m py_compile core/audio/subtitle.py
.venv/bin/python -m py_compile core/compositor/concatenator.py
.venv/bin/python -m py_compile core/compositor/processor.py
.venv/bin/python -m py_compile core/pipelines/simple_video.py
.venv/bin/python -m py_compile core/pipelines/creative_video.py
.venv/bin/python -m py_compile core/pipelines/manuscript_video.py
.venv/bin/python -m py_compile models/task.py

# Key module imports validation
.venv/bin/python -c "from core.api.agnes_video import AgnesVideoAPI; print('AgnesVideoAPI OK')"
.venv/bin/python -c "from core.api.agnes_image import AgnesImageAPI; print('AgnesImageAPI OK')"
.venv/bin/python -c "from core.api.agnes_chat import AgnesChatAPI; print('AgnesChatAPI OK')"
.venv/bin/python -c "from core.audio.tts import EdgeTTSEngine, SilentTTSEngine; print('TTS OK')"
.venv/bin/python -c "from core.audio.subtitle import SubtitleGenerator; print('Subtitle OK')"
.venv/bin/python -c "from core.compositor.concatenator import VideoConcatenator; print('Concatenator OK')"
.venv/bin/python -c "from models.task import parse_task_state, SimpleVideoTask, CreativeVideoTask, ManuscriptVideoTask; print('Models OK')"
```

#### Layer 3: Endpoint Functional Validation

```bash
# Create simple video task (parameter validation)
curl -X POST http://localhost:8765/api/tasks/simple \
  -H "Content-Type: application/json" \
  -d '{"prompt": "A cat chasing a butterfly in a garden", "mode": "t2v", "duration": 5}'

# Create creative video task (parameter validation)
curl -X POST http://localhost:8765/api/tasks/creative \
  -H "Content-Type: application/json" \
  -d '{"idea": "Space exploration story", "video_width": 768, "video_height": 1152}'

# Create manuscript video task (parameter validation)
curl -X POST http://localhost:8765/api/tasks/manuscript \
  -H "Content-Type: application/json" \
  -d '{"manuscript_text": "This is the first segment. This is the second segment."}'

# Verify task list contains all three types
curl -s http://localhost:8765/api/tasks | python3 -c "
import json, sys
data = json.load(sys.stdin)
types = set(t.get('task_type') for t in data.get('tasks', []))
print(f'Task types found: {types}')
assert 'simple' in types, 'Missing simple task'
assert 'creative' in types, 'Missing creative task'
assert 'manuscript' in types, 'Missing manuscript task'
print('All 3 task types verified!')
"
```

#### Layer 4: Subtitle Multi-line Function Validation

```bash
# Verify subtitle splitting logic
.venv/bin/python -c "
from core.audio.subtitle import SubtitleGenerator

# Short text is not split
assert SubtitleGenerator._split_long_text('Short text', 14) == 'Short text'

# Long Chinese text split into two lines
result = SubtitleGenerator._split_long_text('这是一段比较长的中文字幕文本需要拆分显示在视频上方', 14)
assert '\n' in result, f'Expected newline in: {repr(result)}'
lines = result.split('\n')
assert len(lines) == 2, f'Expected 2 lines, got {len(lines)}'

# Prioritize split at punctuation marks
result = SubtitleGenerator._split_long_text('今天天气真好，我们一起去公园散步吧', 14)
assert result == '今天天气真好，\n我们一起去公园散步吧', f'Got: {repr(result)}'

# Long English text split by word
result = SubtitleGenerator._split_long_text('This is a very long English subtitle text that should be split', 14)
assert '\n' in result

# Empty text and existing newlines are not modified
assert SubtitleGenerator._split_long_text('', 14) == ''
assert SubtitleGenerator._split_long_text('Existing\nnewline', 14) == 'Existing\nnewline'

print('All subtitle multi-line tests passed!')
"
```

### 0.5 Troubleshooting & Common Issues

| Symptom | Cause | Solution |
|------|------|---------|
| `ModuleNotFoundError: No module named 'xxx'` | venv not active or dependencies not installed | Run `.venv/bin/pip install -r requirements.txt` |
| `ffmpeg not found` | ffmpeg is not installed | Install via `brew install ffmpeg` or system package manager |
| Port 8765 is occupied | Previous server process did not release the port | Stop the process using `lsof -ti:8765 \| xargs kill` and retry |
| Video generation failed with 401 | Invalid or unconfigured API Key | Check `AGNES_API_KEY` env variable or configuration on `/api/config` |
| Subtitle characters render as blocks | Missing CJK fonts | Check if `resource/fonts/STHeitiMedium.ttc` is present |
| TTS has no sound output | Outdated edge_tts version | Run `.venv/bin/pip install 'edge_tts>=6.1.0'` |

---

## 1. AI Agent Trigger Words

| User Phrase | Action to Perform | Description |
|---------|-------------------|------|
| **"修复 Bug: ..."** | Invoke `software-engineer` (BugFix quick path) | Locate → Fix → Verify → Report |
| **"执行大版本回归"** | Execute full regression tests per `docs/regression_test_plan.md` | 9 concurrent scenarios + endpoint validation |
| **"新增功能: ..."** | Invoke `software-product-manager` → Requirements analysis | Incremental feature development |
| **"需求分析" / "只做 PRD"** | Invoke `software-product-manager` | Partial workflow execution |
| **"架构评审"** | Invoke `software-architect` | Partial workflow execution |
| **"部署项目" / "初始化环境"** | Execute per "0. Environment Deployment & Verification" | Deployment in clean environment |
| **"验证项目" / "跑一下检查"** | Execute per "0.4 Deployment Verification Checklist" | Post-deployment validation |

---

## 2. Project Positioning

An all-in-one Web application for video generation based on Agnes AI's **completely free** model, supporting **three task types**:

- **Simple Video**: Single-call Agnes Video API wrapper exposing all parameter options in a structured UI form (t2v / i2v / ti2vid / keyframes).
- **Creative Long Video**: AI scriptwriting → storyboard generation → video rendering → edge_tts voice narration + fine-grained synced subtitle overlays → merging.
- **Manuscript Long Video**: Long text input → speaking-time estimated segmentation → AI scene prompt generation → segment video rendering → unified TTS + subtitles → merging.

---

## 3. Technical Stack

| Layer | Selection |
|------|------|
| Backend | Python FastAPI + WebSocket |
| Data Models | Pydantic v2 |
| Video Processing | moviepy + ffmpeg |
| TTS Engine | edge_tts >= 6.1.0 (Free, no API Key required) |
| Subtitles | srt >= 3.5.0 + moviepy (word-level fine-grained + multi-line wrapping) |
| Frontend | HTML/CSS/JS + Tailwind CDN (Single-file `static/index.html`, 7 languages i18n) |
| LLM | Agnes Chat API (`agnes-2.0-flash`) — Free |
| Image Model | `agnes-image-2.1-flash` (t2i) / `agnes-image-2.0-flash` (i2i) — Free |
| Video Model | `agnes-video-v2.0` — Free |
| Logging | `logging.getLogger(__name__)` |

---

## 4. Directory Structure

```
agnes-video-generator/
├── server.py                         # FastAPI server routing and WebSocket
├── start.sh                          # One-click startup script
├── requirements.txt                  # Python dependencies
│
├── models/
│   ├── __init__.py
│   └── task.py                       # Task models, configs, requests and responses
│
├── core/
│   ├── __init__.py
│   ├── config.py                     # API key persistent logic, font resolution, default configs
│   ├── task_manager.py               # State management and checkpoint resume
│   ├── screenwriter.py               # Screenplay Agent (story, script, narration, keyframe prompts)
│   │
│   ├── api/
│   │   ├── __init__.py
│   │   ├── agnes_chat.py             # LLM Chat API wrapper
│   │   ├── agnes_image.py            # Agnes Image API wrapper
│   │   └── agnes_video.py            # Agnes Video API wrapper
│   │
│   ├── audio/
│   │   ├── __init__.py
│   │   ├── tts.py                    # EdgeTTSEngine + SilentTTSEngine
│   │   └── subtitle.py               # SRT parser (word cues to SRT) + moviepy overlay
│   │
│   ├── compositor/
│   │   ├── __init__.py
│   │   ├── concatenator.py           # Concatenation and audio/subtitle overlays
│   │   └── processor.py              # Scale, crop, freeze frames, and silence generation
│   │
│   └── pipelines/
│       ├── __init__.py               # BasePipeline
│       ├── simple_video.py           # Pipeline: Simple video
│       ├── creative_video.py         # Pipeline: Creative video (10-step flow)
│       └── manuscript_video.py       # Pipeline: Manuscript video (5-step flow)
│
├── utils/
│   ├── __init__.py
│   ├── image.py                      # Image helpers (downloads, base64 utility)
│   └── video.py                      # Video downloader
│
├── resource/
│   └── fonts/                        # Subtitle CJK fonts
│       ├── STHeitiMedium.ttc         # CJK default fallback font
│       └── MicrosoftYaHeiNormal.ttc  # CJK alternative font
│
├── static/
│   └── index.html                    # 3-Tab Web UI layout with 7-language localization
│
├── scripts/
│   └── regression_runner.py          # 9-scenario automated regression test suite
│
└── docs/
    ├── system_design.md              # Architecture documentation
    ├── regression_test_plan.md       # Regression test plan
    ├── class-diagram.mermaid         # Class diagram
    └── sequence-diagram.mermaid      # Sequence diagram
```

---

## 5. BugFix Workflow

When the user asks to **"修复 Bug: ..."**, the Lead Agent proceeds as follows:

```
1. Locate
   - Read the user bug description.
   - Use codegraph / grep to locate affected files and lines.
   - Reproduce the bug (e.g., via API call if possible).

2. Fix
   - Invoke software-engineer to perform the fix.
   - Ensure the fix complies with AGENTS.md specifications.

3. Verify
   - Run "bash start.sh" (confirm Uvicorn starts normally on port 8765).
   - Use curl to verify the impacted endpoint returns correct responses.
   - Ensure existing features are not broken.

4. Report
   - Explain the root cause, implementation details, and modified files.
   - Attach verification results (e.g., curl outputs).
```

---

## 6. Major Version Regression Testing

When the user asks to **"执行大版本回归"**, the Lead Agent loads `docs/regression_test_plan.md` to execute the regression tests.

### Workflow

```
User says "执行大版本回归"
       ↓
┌───────────────────────────────────────────┐
│ 1. Prep → git status + assets check + start │
│ 2. Concurrent Execution → 9 scenarios      │
│ 3. Automated Check → F1-F7, R1-R10, E1-E9  │
│ 4. Report Generation → JSON & MD reports   │
│ 5. Manual Checks → request user review     │
└───────────────────────────────────────────┘
```

### 9 Scenarios Matrix

| ID | Type | Scenario | Weight |
|----|------|------|------|
| S1 | Simple | Pure text t2v | 1 |
| S2 | Simple | Image-to-video ti2vid | 1 |
| S3 | Simple | Keyframe animation | 1 |
| C1 | Creative | Text + Independent + Mute | 3 |
| C2 | Creative | Ref Image + Keyframes + Mute | 3 |
| C3 | Creative | Ref Image End Frame + Keyframes + Mute | 3 |
| C4 | Creative | Independent + TTS/Subtitle | 4 |
| M1 | Manuscript | Short Manuscript + Narration | 4 |
| M2 | Manuscript | Short Manuscript + Custom style | 4 |

### Execution Commands

```bash
# Full regression run
python scripts/regression_runner.py --auto-start

# Resume tests
python scripts/regression_runner.py --resume --auto-start

# Quick validation of existing files
python scripts/regression_runner.py --quick
```

---

## 7. Role Responsibilities

### 7.1 Product Manager (Xu Qingchu)

**Input**: User feature request
**Output**: `PRD_REFACTOR.md` (incremental PRD)

**Output guidelines**:
- 3-5 Product Goals
- User Stories
- Feature Backlog (P0/P1/P2)
- UI Design Concept (ASCII mockups)
- Maintain existing technical stack; paid services are forbidden.

---

### 7.2 Architect (Gao Jianyuan)

**Input**: PRD documentation
**Output**: `docs/system_design.md` updates

---

### 7.3 Software Engineer (Kou Douma)

**Input**: Bug details / System Design
**Output**: Source code changes or bug fixes

**Code style constraints**:
- Python: Google style docstrings, type hinting, async/await for IO operations.
- Frontend: ES6+, zero build steps.
- Files must use UTF-8 encoding.

---

### 7.4 QA Engineer (Yan Guoguan)

**Input**: Engineer code deliveries
**Output**: Validation report

**Checklist hierarchy**:

#### Layer 1: Static Analysis
```
[ ] Python Syntax Check: python -m py_compile all .py files
[ ] Import checks: python -c "from core.api.agnes_video import AgnesVideoAPI" etc.
[ ] Frontend: HTML/JS syntax errors check
```

#### Layer 2: Unit Testing
| Module | Target Checklist |
|------|--------|
| `models/task.py` | Serialization, task parsing with union discriminator |
| `core/audio/subtitle.py` | SRT format output, `_split_long_text` multi-line wrapping |
| `core/audio/tts.py` | EdgeTTSEngine + SilentTTSEngine |
| `manuscript_video.py` | `split_manuscript()` duration splitting algorithm |
| `core/config.py` | Configuration maps, CJK font fallbacks |
| `core/task_manager.py` | Backward compatibility (no task_type → CREATIVE) |

#### Layer 3: Integration Validation
| Endpoint | Target Check |
|------|--------|
| `GET /` | Returns 200, serves 3-Tab HTML |
| `GET /api/config` | Returns ok: true |
| `GET /api/voices` | Returns 4 TTS voice roles |
| `POST /api/tasks/simple` | Schema check, type SIMPLE |
| `POST /api/tasks/creative` | Schema check, type CREATIVE |
| `POST /api/tasks/manuscript` | Schema check, type MANUSCRIPT |
| `GET /api/tasks` | Returns tasks list containing all three types |
| `GET /api/tasks/{id}` | Returns task detail containing task_type |
| `POST /api/tasks/{id}/stop` | Terminates execution of task |
| `GET /api/video/{id}` | Streams or downloads final MP4 |

---

## 8. Shared Knowledge Specifications

### 8.1 Log Prefixes

| Prefix | Module |
|------|------|
| `[Startup]` | server.py startup |
| `[WS]` | WebSocket connection states |
| `[Resume]` | server.py task resumption |
| `[Stop]` | server.py task stopping |
| `[Pipeline]` | creative_video.py |
| `[Simple]` | simple_video.py |
| `[Manuscript]` | manuscript_video.py |
| `[TTS]` | tts.py |
| `[Subtitle]` | subtitle.py |
| `[Compositor]` | compositor/ utilities |
| `[AgnesImage]` | agnes_image.py |
| `[AgnesVideo]` | agnes_video.py |
| `[AgnesChat]` | agnes_chat.py |
| `[TaskManager]` | task_manager.py |
| `[Screenwriter]` | screenwriter.py |

### 8.2 Error Strategies

| Action | Retry Plan |
|------|------|
| LLM Requests | Retry 3 times, with 15s incremental delays |
| Video Submission | Retry 5 times, with 30s incremental delays |
| Polling Loops | Poll every 15s, log status every 10 iterations |
| PipelineShutdown | Bubble up exception, persist current state to task_state.json |
| TTS Failures | Fall back to SilentTTSEngine (mute audio + subtitles) |

### 8.3 Backward Compatibility

- `TaskManager.load()` automatically converts task records without a `task_type` field into `CreativeVideoTask`.
- Existing `task_state.json` field names are preserved.

### 8.4 API Response Format

```json
// Success
{"ok": true, "task_id": "...", ...}

// Failure
HTTPException(status_code=4xx/5xx, detail="...")
```

### 8.5 WebSocket Messages

```json
{
  "type": "progress",
  "task_id": "...",
  "step": "video_split",
  "status": "running",
  "message": "Splitting text segments...",
  "progress": 0.3,
  "data": {"current": 2, "total": 5}
}
```

### 8.6 Video-Audio Synchronization

```python
final_duration = max(audio_duration + 1.0, original_video_duration)
# padding ≤ 1s, freeze last frame if audio is longer than video
```

Both Creative Video and Manuscript Video use the "MoneyPrinterTurbo" method: concatenate all video segments first, then overlay a single merged audio track + subtitles track. This prevents compounding pacing errors. TTS volume is automatically boosted by 2.5x to compensate for default low volume in edge_tts.

### 8.7 Manuscript Split Algorithm

```python
def split_manuscript(text: str) -> list[dict]:
    """
    1. Split text into candidate sentences using period/question/exclamation marks.
    2. Estimate speech duration for each sentence: est_duration = len(text) / 4.0
    3. Greedy combine: combine sentences until duration ∈ [5, 12] seconds.
    4. Sentences longer than 12s are accepted without splitting.
    5. Short sentences (< 5s) at the tail are combined into the previous segment.
    """
```

### 8.8 Subtitle Wrapping Algorithm

```python
def _split_long_text(txt: str, max_chars_per_line: int) -> str:
    """
    1. Check for CJK characters.
    2. CJK text: If character count exceeds threshold, split into 2 lines:
       - Prioritize breaking at middle-range CJK punctuation marks (，。、；！？).
       - Fall back to splitting at the midpoint of character counts.
    3. Non-CJK text: If word count exceeds threshold, split into 2 lines at word boundaries.
    4. Dynamic character limit = (video_width - 40) // fontsize.
    """
```

Subtitle rendering uses `method="caption"` instead of `method="label"`, paired with `size=(available_w, None)` to constrain subtitle width for wrapping.

### 8.9 Fine-grained SRT Generation

```python
def _generate_fine_srt_from_word_cues(word_cues, max_duration=2.5, max_chars=18):
    """
    1. Convert edge_tts SubMaker word cues to list of (start, end, text) tuples.
    2. Calculate word pauses (gap).
    3. Greedy group words using max_duration and max_chars thresholds:
       - Break group if total duration limit reached.
       - Break group if character limit reached.
       - Break group if pause gap > 0.4s and group contains content.
    4. Post-process: merge overly short tail groups.
    5. Ensure group duration ≥ 0.3s, without overlap.
    """
```

### 8.10 Font Fallback Resolution

```python
def resolve_font_path(font: str) -> str:
    """
    Priority hierarchy:
    1. Valid absolute path → use directly.
    2. Valid filename → search in resource/fonts/.
    3. Recognized non-CJK font name (Arial, Helvetica, etc.) → fallback to STHeitiMedium.ttc.
    4. Others → treat as system font name.
    """
```

---

## 9. Complete API Endpoint List

| Method | Path | Description |
|------|------|------|
| GET | `/` | Web UI page |
| GET | `/api/config` | Fetch API Key (masked) |
| POST | `/api/config` | Save API Key |
| GET | `/api/voices` | List available TTS voice roles (4 roles) |
| POST | `/api/tasks/simple` | Submit simple video task |
| POST | `/api/tasks/creative` | Submit creative video task |
| POST | `/api/tasks/manuscript` | Submit manuscript video task |
| POST | `/api/tasks` | Legacy endpoint (redirects to creative mode) |
| GET | `/api/tasks` | List all tasks with task_type badge |
| GET | `/api/tasks/{id}` | Get task details |
| POST | `/api/tasks/{id}/resume` | Resume an interrupted task |
| POST | `/api/tasks/{id}/stop` | Stop a running task |
| GET | `/api/video/{id}` | Stream/download final video |
| WS | `/ws/{id}` | WebSocket progress push |

---

## 10. Key Decision Log

| ID | Decision | Details |
|----|------|------|
| D1 | Manuscript Segmenting | Speaking time estimation ~4 chars/sec, 5-12s segments, keep sentences whole |
| D2 | Manuscript Scene Prompt | LLM generates English prompt, original text is used for audio and subtitles |
| D3 | TTS Default Voice | `zh-CN-XiaoxiaoNeural` |
| D4 | Video Padding | ≤ 1s padding |
| D5 | Simple Video Inputs | Expose all 8 parameters of Agnes Video API, no AI enhancement |
| D6 | Compatibility | Parse tasks lacking `task_type` as CREATIVE |
| D7 | Localization | Maintain 7 languages (zh/en/ru/ja/ko/ms/id) |
| D8 | TTS Integration | Use Microsoft edge_tts free solution |
| D9 | Subtitle Wrap | Calculate character threshold dynamically, wrap on punctuation, use method="caption" |
| D10 | Compositing | MoneyPrinterTurbo strategy: concat segments, then mix unified audio/subtitles track |
| D11 | TTS Volume | Boost TTS voice volume by 2.5x |

---

*Document Version: v5.0 | Last Updated: 2026-06-15 | Status: 🟢 Development Completed (v2.0) — Maintenance Mode*
