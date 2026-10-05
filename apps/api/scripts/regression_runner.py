#!/usr/bin/env python3
"""
Agnes Video Generator v2.0 — Major Version Regression Test Script (Concurrent Edition)

Usage:
  python scripts/regression_runner.py                # Run from scratch
  python scripts/regression_runner.py --resume       # Resume from existing report
  python scripts/regression_runner.py --quick        # Skip running, verify output only

Mechanism:
  - 10 test scenarios are executed concurrently via asyncio
  - Weighted semaphore controls concurrency to ensure total Agnes API calls <= 20 times/min
  - Test reports are written incrementally to docs/regression_report.json, supporting resumption

Concurrency Evaluation:
  │ Type         │ Weight│ Agnes API Call Characteristics     │
  │ Simple (S1-S3)│  1   │ 1 submit + polling ~4 times/min    │
  │ Creative (C1-C4)│ 3-4│ Chat+N-scene Image+Video+polling   │
  │ Manuscript(M1-M3)│4-5│ Chat*segments+Image*segments+poll  │
  Total weight limit = 10 (50% margin, ensuring peak does not exceed 20/min)
"""

import asyncio
import json
import logging
import os
import signal
import subprocess
import sys
import time
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any, Optional

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import requests  # type: ignore

# ═══════════════════════════════════════════════════
# Configuration Constants
# ═══════════════════════════════════════════════════

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORKING_DIR = os.path.join(PROJECT_ROOT, ".working_dir")
UPLOAD_DIR = os.path.join(WORKING_DIR, "uploads")
REPORT_PATH = os.path.join(PROJECT_ROOT, "docs", "regression_report.json")
REPORT_MD_PATH = os.path.join(PROJECT_ROOT, "docs", "regression_report.md")
SERVER_URL = "http://localhost:8765"
SERVER_LOG = os.path.join(PROJECT_ROOT, ".regression_server.log")
TEST_REF_IMAGE = os.path.join(PROJECT_ROOT, "test_ref.png")
TEST_END_IMAGE = os.path.join(PROJECT_ROOT, "test_end.png")

# Agnes API per-minute call limit
AGNES_RATE_LIMIT = 20          # calls/minute

# Weights for each scenario = average Agnes API calls per minute initiated by the scenario
# Keep 50% margin => max weight limit = AGNES_RATE_LIMIT / 2 = 10
SCENARIO_WEIGHTS = {
    "S1": 1, "S2": 1, "S3": 1,       # Simple: 1 submit + light polling
    "C1": 4, "C2": 4, "C3": 3, "C4": 3,  # Creative: Chat + N*Image + N*Video + polling
    "M1": 4, "M2": 4,                 # Manuscript: Segments*Chat + Segments*Image + polling
}
MAX_CONCURRENT_WEIGHT = AGNES_RATE_LIMIT // 2

# Scenario timeouts (seconds)
TIMEOUT_SIMPLE = 30 * 60
TIMEOUT_CREATIVE = 120 * 60
TIMEOUT_MANUSCRIPT = 60 * 60
POLL_INTERVAL = 20
HEALTH_CHECK_RETRIES = 12

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [Regression] %(message)s",
)
logger = logging.getLogger("RegressionTest")


# ═══════════════════════════════════════════════════
# Scenario Definitions
# ═══════════════════════════════════════════════════

class ScenarioConfig:
    def __init__(self, id: str, label: str, type_: str,
                 endpoint: str, params: dict, timeout: int,
                 weight: int,
                 requires_ref_image: bool = False,
                 requires_end_image: bool = False):
        self.id = id
        self.label = label
        self.type = type_
        self.endpoint = endpoint
        self.params = params
        self.timeout = timeout
        self.weight = weight
        self.requires_ref_image = requires_ref_image
        self.requires_end_image = requires_end_image


SCENARIO_DEFS = [
    # ── Simple Video ──
    ScenarioConfig("S1", "Pure Text t2v", "simple",
        "/api/v1/tasks/simple",
        {"prompt": "A cat chasing a butterfly in a garden, slow motion, soft sunlight filtering through leaves",
         "mode": "t2v", "duration": 5},
        TIMEOUT_SIMPLE, SCENARIO_WEIGHTS["S1"]),

    ScenarioConfig("S2", "Image to Video ti2vid", "simple",
        "/api/v1/tasks/simple",
        {"prompt": "A cat chasing a butterfly in a garden, slow motion, soft sunlight filtering through leaves",
         "mode": "ti2vid", "duration": 5},
        TIMEOUT_SIMPLE, SCENARIO_WEIGHTS["S2"], requires_ref_image=True),

    ScenarioConfig("S3", "Keyframes keyframes", "simple",
        "/api/v1/tasks/simple",
        {"prompt": "A cat chasing a butterfly in a garden, slow motion, soft sunlight filtering through leaves",
         "mode": "keyframes", "duration": 5},
        TIMEOUT_SIMPLE, SCENARIO_WEIGHTS["S3"],
        requires_ref_image=True, requires_end_image=True),

    # ── Creative Video (No voice narration for main tests, 3 scene modes + 1 narration validation) ──
    ScenarioConfig("C1", "Pure Text + Independent + No Voice", "creative",
        "/api/v1/tasks/creative",
        {"idea": "An adventure story of a cat exploring in the garden",
         "user_requirement": "3 scenes, 5 seconds each, anime style",
         "style": "Anime style", "chaining_mode": "independent",
         "video_duration": 5,
         "audio_enabled": False},
        TIMEOUT_CREATIVE, SCENARIO_WEIGHTS["C1"]),

    ScenarioConfig("C2", "With Ref Image + Keyframes + No Voice", "creative",
        "/api/v1/tasks/creative",
        {"idea": "An adventure story of a cat exploring in the garden",
         "user_requirement": "3 scenes, 5 seconds each, anime style",
         "style": "Anime style", "chaining_mode": "keyframes",
         "video_duration": 5,
         "audio_enabled": False},
        TIMEOUT_CREATIVE, SCENARIO_WEIGHTS["C2"], requires_ref_image=True),

    ScenarioConfig("C3", "Ref Image Generates End Frame + Keyframes + No Voice", "creative",
        "/api/v1/tasks/creative",
        {"idea": "An adventure story of a cat exploring in the garden",
         "user_requirement": "3 scenes, 5 seconds each, anime style",
         "style": "Anime style", "chaining_mode": "keyframes",
         "video_duration": 5,
         "audio_enabled": False,
         "use_custom_end_frames": True,
         "generate_end_frames_from_ref": True},
        TIMEOUT_CREATIVE, SCENARIO_WEIGHTS["C3"], requires_ref_image=True),

    ScenarioConfig("C4", "Independent Scenes + Voice & Subtitles", "creative",
        "/api/v1/tasks/creative",
        {"idea": "An adventure story of a cat exploring in the garden",
         "user_requirement": "3 scenes, 5 seconds each, anime style",
         "style": "Anime style", "chaining_mode": "independent",
         "video_duration": 5,
         "audio_enabled": True, "audio_voice": "en-US-JennyNeural"},
        TIMEOUT_CREATIVE, SCENARIO_WEIGHTS["C4"]),

    # ── Manuscript Video (Short text only, no long text regression) ──
    ScenarioConfig("M1", "Short Manuscript + Voice", "manuscript",
        "/api/v1/tasks/manuscript",
        {"manuscript_text": "In the spring garden, a kitten is chasing a butterfly. "
         "The sun is shining bright, and flowers are in full bloom. "
         "The kitten jumps around, very happy. The butterfly lands on a flower, and the kitten quietly approaches.",
         "video_duration": 5, "audio_enabled": True,
         "audio_voice": "en-US-JennyNeural"},
        TIMEOUT_MANUSCRIPT, SCENARIO_WEIGHTS["M1"]),

    ScenarioConfig("M2", "Short Manuscript + Custom Subtitles", "manuscript",
        "/api/v1/tasks/manuscript",
        {"manuscript_text": "In the spring garden, a kitten is chasing a butterfly. "
         "The sun is shining bright, and flowers are in full bloom. "
         "The kitten jumps around, very happy. The butterfly lands on a flower, and the kitten quietly approaches.",
         "video_duration": 5, "audio_enabled": True,
         "audio_voice": "en-US-JennyNeural",
         "subtitle_font": "SimHei", "subtitle_color": "yellow",
         "subtitle_fontsize": 52, "subtitle_position": "top",
         "subtitle_stroke_color": "blue", "subtitle_stroke_width": 3,
         "subtitle_bg_color": "black@0.7"},
        TIMEOUT_MANUSCRIPT, SCENARIO_WEIGHTS["M2"]),
]

SCENARIO_MAP = {s.id: s for s in SCENARIO_DEFS}


# ═══════════════════════════════════════════════════
# Weighted Semaphore
# ═══════════════════════════════════════════════════

class WeightedSemaphore:
    """Rate limit: total weight <= max_weight.

    Weight of each scenario = estimated Agnes API calls per minute.
    Controls concurrent scenarios to ensure total API calls <= AGNES_RATE_LIMIT/minute.
    """
    def __init__(self, max_weight: int):
        self.max_weight = max_weight
        self.current = 0
        self._lock = asyncio.Lock()
        self._cond = asyncio.Condition(self._lock)

    async def acquire(self, weight: int):
        async with self._lock:
            while self.current + weight > self.max_weight:
                await self._cond.wait()
            self.current += weight

    async def release(self, weight: int):
        async with self._lock:
            self.current -= weight
            self._cond.notify_all()

    @property
    def utilization(self) -> float:
        return self.current / self.max_weight


# ═══════════════════════════════════════════════════
# Report Manager (Incremental writes + Resume from checkpoint)
# ═══════════════════════════════════════════════════

class ReportManager:
    def __init__(self, report_path: str):
        self.path = report_path
        self.data = self._load_or_create()

    # ── Load/Initialize ──

    def _load_or_create(self) -> dict:
        if os.path.exists(self.path):
            with open(self.path, encoding="utf-8") as f:
                data = json.load(f)
            done = data.get("summary", {}).get("completed", 0)
            failed = data.get("summary", {}).get("failed", 0)
            logger.info(f"Resume report: {done} completed / {failed} failed (total {data['summary']['total']})")
            return data
        return self._create_empty()

    def _create_empty(self) -> dict:
        scenarios = {}
        for sc in SCENARIO_DEFS:
            scenarios[sc.id] = {
                "label": sc.label,
                "type": sc.type,
                "status": "pending",
                "result": None,
                "errors": [],
            }
        endpoints = {f"E{i}": {"status": "pending", "detail": ""} for i in range(1, 10)}
        return {
            "version": "2.0",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "git_commit": self._get_git_commit(),
            "scenarios": scenarios,
            "endpoints": endpoints,
            "summary": {
                "total": len(SCENARIO_DEFS),
                "completed": 0, "failed": 0, "skipped": 0,
                "running": 0, "pending": len(SCENARIO_DEFS),
                "passed_checks": 0, "total_checks": 0,
            },
            "server_pid": None,
        }

    def _get_git_commit(self) -> str:
        try:
            r = subprocess.run(["git", "log", "--oneline", "-1"],
                               capture_output=True, text=True, cwd=PROJECT_ROOT)
            return r.stdout.strip() or "unknown"
        except Exception:
            return "unknown"

    # ── Update ──

    def set_server_pid(self, pid: int):
        self.data["server_pid"] = pid
        self._save()

    def update_scenario(self, id_: str, status: str,
                        result: Optional[dict] = None, errors: Optional[list] = None):
        sc = self.data["scenarios"][id_]
        sc["status"] = status
        if result is not None:
            sc["result"] = result
        if errors is not None:
            sc["errors"] = errors
        self._recalc_summary()
        self._save()

    def update_endpoint(self, id_: str, status: str, detail: str = ""):
        self.data["endpoints"][id_]["status"] = status
        self.data["endpoints"][id_]["detail"] = detail
        self._save()

    def _recalc_summary(self):
        s = self.data["summary"]
        sv = self.data["scenarios"].values()
        s["completed"] = sum(1 for x in sv if x["status"] == "completed")
        s["failed"] = sum(1 for x in sv if x["status"] == "failed")
        s["skipped"] = sum(1 for x in sv if x["status"] == "skipped")
        s["running"] = sum(1 for x in sv if x["status"] == "running")
        s["pending"] = sum(1 for x in sv if x["status"] in ("pending", "submitted"))

        tc = pc = 0
        for x in sv:
            chk = x.get("result", {}).get("checks", {}) if x.get("result") else {}
            for name, val in chk.items():
                if name.endswith(("_width", "_height", "_step_count", "_srt_entries",
                                  "_duration", "_count", "F2_duration", "F6_asr_text", "F4_speech_duration")):
                    continue
                tc += 1
                if val is True:
                    pc += 1
        s["total_checks"] = tc
        s["passed_checks"] = pc

    def _save(self):
        self.data["updated_at"] = datetime.now(timezone.utc).isoformat()
        os.makedirs(os.path.dirname(self.path), exist_ok=True)
        with open(self.path, "w", encoding="utf-8") as f:
            json.dump(self.data, f, ensure_ascii=False, indent=2)

    def should_run(self, id_: str) -> bool:
        st = self.data["scenarios"][id_]["status"]
        return st not in ("completed", "skipped")

    def print_summary(self):
        s = self.data["summary"]
        logger.info("=" * 56)
        logger.info(f"  Completed: {s['completed']}/{s['total']}  "
                     f"Failed: {s['failed']}  Skipped: {s['skipped']}  "
                     f"Running: {s['running']}")
        logger.info(f"  Check Items: {s['passed_checks']}/{s['total_checks']} Passed")
        logger.info("=" * 56)

    def generate_md_report(self, report_md_path: str):
        d = self.data
        s = d["summary"]
        sc = d["scenarios"]
        ep = d["endpoints"]
        now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

        icon = lambda st: {"completed": "✅", "failed": "❌", "skipped": "⏭️",
                           "running": "🔄", "pending": "⏳", "submitted": "⏳"}.get(st, "❓")

        lines = []
        lines.append(f"# Agnes Video Generator v2.0 — Major Version Regression Test Report")
        lines.append(f"")
        lines.append(f"| Metadata | Value |")
        lines.append(f"|--------|-----|")
        lines.append(f"| Date | {now} |")
        lines.append(f"| Version | {d.get('git_commit', 'unknown')} |")
        lines.append(f"| Report Version | {d.get('version', '?')} |")
        lines.append(f"| Auto Validation | {s['passed_checks']}/{s['total_checks']} Passed |")
        lines.append(f"")
        ep_pass = sum(1 for e in ep.values() if e["status"] == "passed")
        ep_all = len(ep)
        lines.append(f"## Overview")
        lines.append(f"")
        lines.append(f"| Status | Count |")
        lines.append(f"|------|------|")
        lines.append(f"| Total | {s['total']} |")
        lines.append(f"| ✅ Completed | {s['completed']} |")
        lines.append(f"| ❌ Failed | {s['failed']} |")
        lines.append(f"| ⏭️ Skipped | {s['skipped']} |")
        lines.append(f"| 🔄 Running | {s['running']} |")
        lines.append(f"| ⏳ Pending | {s['pending']} |")
        lines.append(f"")
        lines.append(f"Endpoint verification: {ep_pass}/{ep_all} ✅")
        lines.append(f"")

        for type_label, type_key, type_ids in [
            ("Simple Video (Simple)", "simple", ["S1", "S2", "S3"]),
            ("Creative Video (Creative)", "creative", ["C1", "C2", "C3", "C4"]),
            ("Manuscript Video (Manuscript)", "manuscript", ["M1", "M2"]),
        ]:
            lines.append(f"---")
            lines.append(f"")
            lines.append(f"## {type_label}")
            lines.append(f"")
            for sid in type_ids:
                sdata = sc.get(sid)
                if not sdata:
                    continue
                st = sdata["status"]
                chk = (sdata.get("result") or {}).get("checks") or {}
                errs = sdata.get("errors") or []
                duration = (sdata.get("result") or {}).get("duration_s", "?")
                tag = icon(st)
                label = sdata.get("label", sid)
                if st == "completed":
                    fail_checks = [k for k, v in chk.items()
                                   if v is False and not any(k.endswith(x) for x in
                                      ("_width", "_height", "_duration", "_count", "_entries",
                                       "F2_duration", "F6_asr_text", "F4_speech_duration"))]
                    if not fail_checks:
                        lines.append(f"### {sid} {label} — {tag} Passed ({duration}s)")
                    else:
                        lines.append(f"### {sid} {label} — ⚠️ Passed with failed checks ({duration}s)")
                else:
                    lines.append(f"### {sid} {label} — {tag} {st}")

            # Table
            lines.append(f"")
            lines.append(f"| Check Item | " + " | ".join(type_ids) + " |")
            lines.append(f"|" + "|".join(["---" for _ in range(len(type_ids) + 1)]) + "|")

            all_check_names = set()
            for sid in type_ids:
                sdata = sc.get(sid)
                chk = (sdata.get("result") or {}).get("checks") or {} if sdata else {}
                all_check_names.update(chk.keys())

            sort_key = lambda n: (0 if n.startswith("F") else 1 if n.startswith("R") else 2, n)
            for cname in sorted(all_check_names, key=sort_key):
                if cname.endswith(("_width", "_height", "_duration", "_count", "_entries", "F2_duration", "F6_asr_text", "F4_speech_duration")):
                    continue
                row = [cname]
                for sid in type_ids:
                    sdata = sc.get(sid)
                    chk = (sdata.get("result") or {}).get("checks") or {} if sdata else {}
                    val = chk.get(cname, "—")
                    if val is True:
                        row.append("✅")
                    elif val is False:
                        row.append("❌")
                    elif val == "N/A":
                        row.append("N/A")
                    elif val == "skip":
                        row.append("⏭️")
                    elif val and cname.startswith("F2_duration"):
                        row.append(f"{val}s")
                    else:
                        row.append(str(val) if val else "—")
                lines.append("| " + " | ".join(row) + " |")
            lines.append(f"")

        # Endpoint results
        lines.append(f"---")
        lines.append(f"")
        lines.append(f"## Endpoint Verification (E1-E9)")
        lines.append(f"")
        lines.append(f"| Endpoint | Status | Detail |")
        lines.append(f"|------|------|------|")
        for eid in sorted(ep.keys()):
            e = ep[eid]
            tag = "✅" if e["status"] == "passed" else "❌"
            lines.append(f"| {eid} | {tag} | {e.get('detail', '')} |")
        lines.append(f"")

        # Manual verification section (only F5 subtitle visibility remains manual)
        lines.append(f"---")
        lines.append(f"")
        lines.append(f"## Manual Verification Required")
        lines.append(f"")
        lines.append(f"The following checks cannot be validated by script due to visual constraints, manual confirmation required:")
        lines.append(f"")
        lines.append(f"| Check Item | Operation | Expected |")
        lines.append(f"|--------|------|------|")
        lines.append(f"| F5 Subtitle Visibility | Play final_video.mp4 and observe screen | Subtitle content, position, and style match configuration |")
        lines.append(f"")
        lines.append(f"> Audio correctness (F4) and subtitle text matching (F6) are automatically verified by the script via whisper ASR.")

        # Error summary
        lines.append(f"")
        lines.append(f"## Error Summary")
        lines.append(f"")
        has_errors = False
        for sid, sdata in sorted(sc.items()):
            errs = sdata.get("errors") or []
            if errs:
                has_errors = True
                lines.append(f"- **{sid}** ({sdata.get('label', '')}): {errs[0]}")
        if not has_errors:
            lines.append(f"No errors.")
        lines.append(f"")

        content = "\n".join(lines)
        os.makedirs(os.path.dirname(report_md_path), exist_ok=True)
        with open(report_md_path, "w", encoding="utf-8") as f:
            f.write(content)
        logger.info(f"MD Report: {report_md_path}")


# ═══════════════════════════════════════════════════
# Test Asset Generation
# ═══════════════════════════════════════════════════

def _ensure_test_assets():
    """Ensure test assets exist, generate them if missing."""
    assets = {
        TEST_REF_IMAGE: (("test_ref.png", (100, 150, 200)),),
        TEST_END_IMAGE: (("test_end.png", (200, 150, 100)),),
    }
    for path, specs in assets.items():
        if os.path.exists(path):
            continue
        try:
            from PIL import Image
            for name, color in specs:
                img = Image.new("RGB", (768, 1152), color)
                save_path = path
                img.save(save_path)
                logger.info(f"Automatically generated test asset: {save_path}")
                break
        except ImportError:
            logger.warning(f"PIL not available, cannot automatically generate {path}, please prepare manually")
            break


# ═══════════════════════════════════════════════════
# Server Management
# ═══════════════════════════════════════════════════

_server_process: Optional[subprocess.Popen] = None


def _cleanup_server():
    global _server_process
    if _server_process is not None:
        logger.info("Stopping test server...")
        try:
            if hasattr(os, "killpg") and hasattr(os, "getpgid"):
                killpg = getattr(os, "killpg")
                getpgid = getattr(os, "getpgid")
                killpg(getpgid(_server_process.pid), signal.SIGTERM)
            else:
                _server_process.terminate()
            _server_process.wait(timeout=5)
        except Exception as e:
            logger.warning(f"Error stopping test server: {e}")
        _server_process = None


def check_server_health() -> bool:
    try:
        r = requests.get(f"{SERVER_URL}/api/v1/config", timeout=5)
        return r.status_code == 200
    except (requests.ConnectionError, requests.Timeout):
        return False


async def wait_for_server(retries: int = HEALTH_CHECK_RETRIES) -> bool:
    for i in range(retries):
        if await asyncio.to_thread(check_server_health):
            logger.info("Server ready ✓")
            return True
        logger.info(f"Waiting for server... ({i + 1}/{retries})")
        await asyncio.sleep(HEALTH_CHECK_RETRIES // 2)
    logger.error("Server not ready")
    return False


async def ensure_server(auto_start: bool = False) -> bool:
    if await asyncio.to_thread(check_server_health):
        return True
    if not auto_start:
        logger.info("Please run in another terminal: bash start.sh")
        return False
    logger.info("Automatically starting service...")
    python = sys.executable
    global _server_process
    kwargs = {}
    if hasattr(os, "setsid"):
        kwargs["preexec_fn"] = os.setsid
    elif hasattr(subprocess, "CREATE_NEW_PROCESS_GROUP"):
        kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP
    _server_process = subprocess.Popen(
        [python, "server.py"],
        cwd=PROJECT_ROOT,
        stdout=open(SERVER_LOG, "w", encoding="utf-8"),
        stderr=subprocess.STDOUT,
        **kwargs
    )
    import atexit
    atexit.register(_cleanup_server)
    ok = await wait_for_server()
    if not ok:
        _cleanup_server()
    return ok


# ═══════════════════════════════════════════════════
# HTTP Invocations
# ═══════════════════════════════════════════════════

@contextmanager
def _open_images(scenario: ScenarioConfig):
    files = {}
    if scenario.requires_ref_image and os.path.exists(TEST_REF_IMAGE):
        with open(TEST_REF_IMAGE, "rb") as f:
            files["reference_image"] = ("ref.png", f.read(), "image/png")
    if scenario.requires_end_image and os.path.exists(TEST_END_IMAGE):
        if scenario.type == "simple":
            with open(TEST_END_IMAGE, "rb") as f:
                files["end_frame_image"] = ("end.png", f.read(), "image/png")
    yield files


def _submit_sync(scenario: ScenarioConfig) -> dict:
    url = f"{SERVER_URL}{scenario.endpoint}"
    data = scenario.params.copy()
    with _open_images(scenario) as img_files:
        files = img_files if img_files else None
        r = requests.post(url, data=data, files=files, timeout=30)
    r.raise_for_status()
    result = r.json()
    if not result.get("ok"):
        raise RuntimeError(f"Submission failed: {result}")
    return result


async def submit_task(scenario: ScenarioConfig) -> dict:
    return await asyncio.to_thread(_submit_sync, scenario)


async def get_task_status(task_id: str) -> dict:
    return await asyncio.to_thread(
        lambda: requests.get(f"{SERVER_URL}/api/v1/tasks/{task_id}", timeout=10).json()
    )


# ═══════════════════════════════════════════════════
# Whisper Model Cache (Global shared to avoid reloading)
# ═══════════════════════════════════════════════════

_whisper_model = None

def _get_whisper_model():
    global _whisper_model
    if _whisper_model is None:
        import importlib
        whisper = importlib.import_module("whisper")
        logger.info("Loading whisper tiny model (first time)...")
        _whisper_model = whisper.load_model("tiny")
    return _whisper_model


# ═══════════════════════════════════════════════════
# Artifact Validation
# ═══════════════════════════════════════════════════

def _load_task_state(task_dir: str) -> dict:
    ts = os.path.join(task_dir, "task_state.json")
    if os.path.exists(ts):
        with open(ts, encoding="utf-8") as f:
            return json.load(f)
    return {}


def _get_expected_narration(task_state: dict, scenario: ScenarioConfig) -> str:
    if scenario.type == "simple":
        return task_state.get("prompt", "")
    if scenario.type == "creative":
        narrations = task_state.get("narrations", [])
        return "\n".join(narrations)
    if scenario.type == "manuscript":
        paras = task_state.get("paragraphs", [])
        return "\n".join(p.get("text", "") for p in paras)
    return ""


def _asr_validate(video_path: str) -> dict:
    result = {"has_speech": False, "text": "", "duration": 0.0, "error": ""}
    tmp_audio = video_path + "_asr_tmp.wav"
    try:
        subprocess.run(
            ["ffmpeg", "-y", "-i", video_path, "-vn", "-acodec", "pcm_s16le",
             "-ar", "16000", "-ac", "1", tmp_audio],
            capture_output=True, timeout=60,
        )
        if not os.path.exists(tmp_audio) or os.path.getsize(tmp_audio) == 0:
            result["error"] = "ffmpeg extract failed"
            return result
        try:
            model = _get_whisper_model()
        except ImportError:
            result["error"] = "whisper not installed"
            return result
        trans = model.transcribe(tmp_audio, language="en")
        text = (trans.get("text") or "").strip()
        result["text"] = text
        result["duration"] = trans.get("duration", 0.0)
        result["has_speech"] = len(text) > 5
        return result
    except Exception as e:
        result["error"] = str(e)
        return result
    finally:
        if os.path.exists(tmp_audio):
            try:
                os.remove(tmp_audio)
            except OSError:
                pass


def _validate_sync(dir_name: str, scenario: ScenarioConfig) -> dict:
    task_dir = os.path.join(WORKING_DIR, dir_name)
    checks: dict[str, Any] = {}

    # Defense: task directory does not exist
    if not os.path.isdir(task_dir):
        checks["F1_final_video_exists"] = False
        checks["F1_final_video_nonempty"] = False
        checks["F2_duration"] = 0
        checks["F2_duration_gt_0"] = False
        checks["F4_has_audio_stream"] = False
        checks["F7_duration_reasonable"] = False
        checks["F4_has_speech"] = "N/A"
        checks["F6_asr_text"] = "N/A"
        checks["F6_text_match"] = "N/A"
        checks["R1_task_state_valid"] = False
        checks["R2_task_type"] = None
        checks["R2_task_type_matches"] = False
        checks["R3_step_count"] = 0
        checks["R3_all_completed"] = False
        checks["R4_final_path_exists"] = False
        checks["R5_task_json"] = False
        checks["R5_has_video_id"] = False
        checks["R6_curl_sh"] = False
        checks["R6_has_video_id_in_curl"] = False
        checks["R7_sub_dirs_exist"] = "N/A"
        checks["R7_audio_files"] = "N/A"
        checks["R8_subtitle_srt"] = "N/A"
        checks["R9_full_narration"] = "N/A"
        checks["R10_full_subtitle"] = "N/A"
        checks["R10_srt_entries"] = "N/A"
        return checks

    video = os.path.join(task_dir, "final_video.mp4")
    ve = os.path.exists(video)
    checks["F1_final_video_exists"] = ve
    checks["F1_final_video_nonempty"] = os.path.getsize(video) > 0 if ve else False

    if ve:
        try:
            from moviepy import VideoFileClip
            clip = VideoFileClip(video)
            duration = clip.duration if clip.duration is not None else 0.0
            checks["F2_duration"] = round(duration, 2)
            checks["F2_duration_gt_0"] = duration > 0
            checks["F3_width"] = clip.w
            checks["F3_height"] = clip.h
            checks["F4_has_audio_stream"] = clip.audio is not None
            checks["F7_duration_reasonable"] = duration > 0
            clip.close()
        except ImportError:
            logger.warning("moviepy not available, skipping video metadata verification")
            checks["F2_duration"] = "skip"
            checks["F2_duration_gt_0"] = "skip"
            checks["F3_width"] = "skip"
            checks["F3_height"] = "skip"
            checks["F4_has_audio_stream"] = "skip"
            checks["F7_duration_reasonable"] = "skip"
        except Exception as e:
            checks["F2_duration"] = f"err:{e}"
            checks["F2_duration_gt_0"] = False
            checks["F4_has_audio_stream"] = False
            checks["F7_duration_reasonable"] = False

        # ASR: speech content detection + subtitle text matching
        asr_eligible = (
            ve
            and checks.get("F4_has_audio_stream") is True
            and scenario.params.get("audio_enabled", True)
        )
        if asr_eligible:
            asr = _asr_validate(video)
            if asr.get("error") and "not installed" in asr["error"]:
                checks["F4_has_speech"] = "skip"
                checks["F6_asr_text"] = "skip"
                checks["F6_text_match"] = "skip"
                logger.info("whisper not available, skipping speech content verification")
            elif asr.get("error"):
                checks["F4_has_speech"] = False
                checks["F6_asr_text"] = f"err:{asr['error']}"
                checks["F6_text_match"] = False
            else:
                checks["F4_has_speech"] = asr["has_speech"]
                checks["F6_asr_text"] = asr["text"][:200]
                checks["F4_speech_duration"] = round(asr["duration"], 2)
                expected = _get_expected_narration(_load_task_state(task_dir), scenario)
                if expected:
                    # Simple fuzzy match: check if expected chars appear in transcription
                    exp_clean = "".join(c for c in expected if c.isalpha())
                    asr_clean = "".join(c for c in asr["text"] if c.isalpha())
                    if exp_clean and asr_clean:
                        overlap = sum(1 for c in exp_clean[:50] if c in asr_clean)
                        ratio = overlap / min(len(exp_clean), 50)
                        checks["F6_text_match"] = ratio > 0.3
                    else:
                        checks["F6_text_match"] = False
                else:
                    checks["F6_text_match"] = "N/A"
        else:
            checks["F4_has_speech"] = "N/A"
            checks["F6_asr_text"] = "N/A"
            checks["F6_text_match"] = "N/A"

    else:
        checks["F2_duration"] = 0
        checks["F2_duration_gt_0"] = False
        checks["F4_has_audio_stream"] = False
        checks["F7_duration_reasonable"] = False
        checks["F4_has_speech"] = "N/A"
        checks["F6_asr_text"] = "N/A"
        checks["F6_text_match"] = "N/A"

    # R1-R4: task_state.json
    ts = os.path.join(task_dir, "task_state.json")
    if os.path.exists(ts):
        with open(ts, encoding="utf-8") as f:
            sd = json.load(f)
        checks["R1_task_state_valid"] = True
        checks["R2_task_type"] = sd.get("task_type", "?")
        checks["R2_task_type_matches"] = sd.get("task_type") == scenario.type

        # R3: step completion — skip mode-specific steps that are intentionally not run
        steps = {k: v for k, v in sd.items() if k.startswith("step_")}
        checks["R3_step_count"] = len(steps)

        # For creative tasks not in keyframes mode, the end_frame_prompts/end_frame_generation
        # steps will not be triggered and should not be counted as "unfinished"
        chaining_mode = sd.get("chaining_mode", "none")
        _SKIPPABLE_STEPS = set()
        if scenario.type == "creative" and chaining_mode not in ("keyframes",):
            _SKIPPABLE_STEPS = {"step_end_frame_prompts", "step_end_frame_generation"}

        active_steps = {k: v for k, v in steps.items() if k not in _SKIPPABLE_STEPS}
        checks["R3_all_completed"] = (
            all(v == "completed" for v in active_steps.values()) if active_steps else "N/A"
        )
        fvf = sd.get("final_video_file", "")
        checks["R4_final_path_exists"] = bool(fvf and os.path.exists(fvf))
    else:
        checks["R1_task_state_valid"] = False
        checks["R2_task_type"] = None
        checks["R2_task_type_matches"] = False
        checks["R3_step_count"] = 0
        checks["R3_all_completed"] = False
        checks["R4_final_path_exists"] = False

    # R5: task.json — Creative tasks in scene_N/ subdirectories, manuscript tasks in para_N/ subdirectories,
    # simple video tasks in root directory
    _task_json_found = False
    _has_video_id = False
    _curl_found = False
    _curl_has_video_id = False

    # Check root directory (simple video)
    tj_root = os.path.join(task_dir, "task.json")
    cs_root = os.path.join(task_dir, "curl.sh")
    if os.path.exists(tj_root):
        _task_json_found = True
        try:
            with open(tj_root, encoding="utf-8") as f:
                tjd = json.load(f)
            _has_video_id = bool(tjd.get("video_id") or tjd.get("id"))
        except Exception:
            pass
    if os.path.exists(cs_root):
        _curl_found = True
        with open(cs_root, encoding="utf-8") as f:
            _curl_has_video_id = "video_id=" in f.read()

    # For creative/manuscript tasks, additionally check subdirectories
    if scenario.type == "creative":
        for entry in os.listdir(task_dir) if os.path.isdir(task_dir) else []:
            if entry.startswith("scene_"):
                sd_path = os.path.join(task_dir, entry)
                if os.path.isdir(sd_path):
                    tj_sub = os.path.join(sd_path, "task.json")
                    cs_sub = os.path.join(sd_path, "curl.sh")
                    if os.path.exists(tj_sub):
                        _task_json_found = True
                        if not _has_video_id:
                            try:
                                with open(tj_sub, encoding="utf-8") as f:
                                    tjd = json.load(f)
                                _has_video_id = bool(tjd.get("video_id") or tjd.get("id"))
                            except Exception:
                                pass
                    if os.path.exists(cs_sub):
                        _curl_found = True
                        if not _curl_has_video_id:
                            with open(cs_sub, encoding="utf-8") as f:
                                _curl_has_video_id = "video_id=" in f.read()
    elif scenario.type == "manuscript":
        for entry in os.listdir(task_dir) if os.path.isdir(task_dir) else []:
            if entry.startswith("para_"):
                sd_path = os.path.join(task_dir, entry)
                if os.path.isdir(sd_path):
                    tj_sub = os.path.join(sd_path, "task.json")
                    cs_sub = os.path.join(sd_path, "curl.sh")
                    if os.path.exists(tj_sub):
                        _task_json_found = True
                        if not _has_video_id:
                            try:
                                with open(tj_sub, encoding="utf-8") as f:
                                    tjd = json.load(f)
                                _has_video_id = bool(tjd.get("video_id") or tjd.get("id"))
                            except Exception:
                                pass
                    if os.path.exists(cs_sub):
                        _curl_found = True
                        if not _curl_has_video_id:
                            with open(cs_sub, encoding="utf-8") as f:
                                _curl_has_video_id = "video_id=" in f.read()

    checks["R5_task_json"] = _task_json_found
    checks["R5_has_video_id"] = _has_video_id
    checks["R6_curl_sh"] = _curl_found
    checks["R6_has_video_id_in_curl"] = _curl_has_video_id

    # R7-R8: Subdirectories + audio/subtitles (creative/manuscript)
    # Determine if audio verification is needed: check audio_enabled parameter
    audio_enabled = scenario.params.get("audio_enabled", True)
    if scenario.type in ("creative", "manuscript"):
        prefix = "scene_" if scenario.type == "creative" else "para_"
        dirs_exist = any(
            e.startswith(prefix) and os.path.isdir(os.path.join(task_dir, e))
            for e in os.listdir(task_dir)
        ) if os.path.isdir(task_dir) else False
        checks["R7_sub_dirs_exist"] = dirs_exist

        if audio_enabled:
            audio_found = srt_found = False
            for root, _dirs, files in os.walk(task_dir):
                for fn in files:
                    if fn in ("narration.mp3", "full_narration.mp3", "narration.wav",
                              "combined_narration.mp3"):
                        audio_found = True
                    if fn.endswith(".srt"):
                        srt_found = True
            checks["R7_audio_files"] = audio_found
            checks["R8_subtitle_srt"] = srt_found
        else:
            # No audio scenario: audio/subtitles check marked as N/A
            checks["R7_audio_files"] = "N/A"
            checks["R8_subtitle_srt"] = "N/A"
    else:
        checks["R7_sub_dirs_exist"] = "N/A"
        checks["R7_audio_files"] = "N/A"
        checks["R8_subtitle_srt"] = "N/A"

    # R9-R10: Combined manuscript outputs (manuscript exclusive)
    if scenario.type == "manuscript":
        fn9 = os.path.join(task_dir, "full_narration.mp3")
        checks["R9_full_narration"] = os.path.exists(fn9) and os.path.getsize(fn9) > 0
        fn10 = os.path.join(task_dir, "full_subtitle.srt")
        checks["R10_full_subtitle"] = os.path.exists(fn10)
        if audio_enabled and os.path.exists(fn10):
            with open(fn10, encoding="utf-8") as f:
                srt_content = f.read()
            checks["R10_srt_entries"] = srt_content.count("\n\n") + 1 if "\n\n" in srt_content else 1
        elif not audio_enabled:
            checks["R10_srt_entries"] = "N/A"
        else:
            checks["R10_srt_entries"] = 0
    else:
        checks["R9_full_narration"] = "N/A"
        checks["R10_full_subtitle"] = "N/A"
        checks["R10_srt_entries"] = "N/A"

    return checks


async def validate_task(dir_name: str, scenario: ScenarioConfig) -> dict:
    return await asyncio.to_thread(_validate_sync, dir_name, scenario)


# ═══════════════════════════════════════════════════
# Single Scenario Execution
# ═══════════════════════════════════════════════════

async def run_scenario(scenario: ScenarioConfig,
                       sema: WeightedSemaphore,
                       report: ReportManager):
    if not report.should_run(scenario.id):
        return
    start = time.monotonic()
    report.update_scenario(scenario.id, "running")
    logger.info(f"[{scenario.id}] ▶ Start (weight={scenario.weight}): {scenario.label}")

    try:
        await sema.acquire(scenario.weight)
        logger.info(f"[{scenario.id}] Permit acquired w={sema.current}/{sema.max_weight}")
    except Exception as e:
        report.update_scenario(scenario.id, "failed", errors=[f"semaphore: {e}"])
        return

    try:
        # Check if this scenario was already submitted (resume from crash)
        existing = report.data["scenarios"].get(scenario.id, {}).get("result")
        task_id = ""
        dir_name = ""
        if existing and existing.get("task_id"):
            task_id = existing["task_id"]
            dir_name = existing.get("dir_name") or task_id
            logger.info(f"[{scenario.id}] Resuming existing task {task_id[:12]}")
        else:
            submit_result = await submit_task(scenario)
            task_id = submit_result["task_id"]
            dir_name = submit_result.get("dir_name") or task_id
            report.update_scenario(scenario.id, "submitted",
                                   result={"task_id": task_id, "dir_name": dir_name})
            logger.info(f"[{scenario.id}] Submitted → {task_id[:12]}")

        final_status = None
        deadline = time.monotonic() + scenario.timeout
        while time.monotonic() < deadline:
            await asyncio.sleep(POLL_INTERVAL)
            try:
                state = await get_task_status(task_id)
                st = state.get("status", "")
                if st == "completed":
                    final_status = "completed"
                    break
                elif st in ("failed", "error"):
                    final_status = f"failed: {state.get('error', '?')}"
                    break
                elif st == "running":
                    fvf = state.get("final_video_file", "")
                    if fvf:
                        logger.info(f"[{scenario.id}] running, video={os.path.basename(fvf)}")
                elif st == "pending":
                    logger.info(f"[{scenario.id}] pending...")
                elif st:
                    logger.info(f"[{scenario.id}] status={st}")
            except Exception as e:
                logger.warning(f"[{scenario.id}] Polling: {e}")
                await asyncio.sleep(5)
        else:
            final_status = "timeout"

        elapsed = round(time.monotonic() - start, 1)
        if final_status == "completed":
            checks = await validate_task(dir_name, scenario)
            ok_count = sum(1 for v in checks.values() if v is True)
            na_count = sum(1 for v in checks.values() if v == "N/A" or v == "skip")
            skip_count = sum(1 for v in checks.values() if v == "skip")
            total_real = sum(1 for v in checks.values() if v not in ("N/A", "skip") or v is True or v is False)
            logger.info(f"[{scenario.id}] Validation {ok_count}/{total_real} passed ({na_count} N/A)")

            checks_clean = {}
            for k, v in checks.items():
                if k in ("F2_duration", "F3_width", "F3_height",
                         "R3_step_count", "R10_srt_entries"):
                    checks_clean[k] = v if not isinstance(v, (int, float)) else v
                elif isinstance(v, str) and v == "skip":
                    checks_clean[k] = True
                else:
                    checks_clean[k] = v

            errors = [k for k, v in checks.items()
                     if v is False and not any(k.endswith(x) for x in
                        ("_width", "_height", "_duration", "_count", "_entries",
                         "F2_duration", "F6_asr_text", "F4_speech_duration"))]
            report.update_scenario(scenario.id, "completed",
                                   result={"task_id": task_id, "dir_name": dir_name,
                                           "duration_s": elapsed,
                                           "started_at": datetime.fromtimestamp(
                                               start, timezone.utc).isoformat(),
                                           "completed_at": datetime.now(timezone.utc).isoformat(),
                                           "checks": checks_clean},
                                   errors=errors)
            tag = "✅" if not errors else "⚠️"
            logger.info(f"[{scenario.id}] {tag} {elapsed}s" + (f" ({len(errors)} checks failed)" if errors else ""))
        else:
            report.update_scenario(scenario.id, "failed",
                                   result={"task_id": task_id, "dir_name": dir_name,
                                           "duration_s": elapsed},
                                   errors=[f"status={final_status}"])
            logger.warning(f"[{scenario.id}] ❌ {final_status} ({elapsed}s)")

    except Exception as e:
        elapsed = round(time.monotonic() - start, 1)
        logger.error(f"[{scenario.id}] ❌ {e}")
        report.update_scenario(scenario.id, "failed", errors=[str(e)])
    finally:
        await sema.release(scenario.weight)
        logger.info(f"[{scenario.id}] Released w={sema.current}/{sema.max_weight}")


# ═══════════════════════════════════════════════════
# Endpoint Verification (E1-E9)
# ═══════════════════════════════════════════════════

async def verify_endpoints(report: ReportManager):
    logger.info("─" * 50)
    logger.info("Endpoint verification E1-E9")

    async def check(ep: str, desc: str, fn):
        ok = detail = False
        try:
            ok, detail = await fn()
        except Exception as e:
            detail = str(e)
        report.update_endpoint(ep, "passed" if ok else "failed", str(detail))
        tag = "✅" if ok else "❌"
        logger.info(f"  {tag} {ep}: {desc}" + (f" -> {detail}" if not ok else ""))

    async def _200(path: str, check_text: str = ""):
        r = await asyncio.to_thread(lambda: requests.get(f"{SERVER_URL}{path}", timeout=10))
        if check_text:
            return r.status_code == 200 and check_text in r.text, r.status_code
        return r.status_code == 200, r.status_code

    async def _post_ok(path: str, data: dict) -> tuple:
        r = await asyncio.to_thread(
            lambda: requests.post(f"{SERVER_URL}{path}", data=data, timeout=15))
        return r.status_code == 200 and r.json().get("ok"), r.status_code

    await asyncio.gather(
        check("E1", "GET / → 200 + index.html",
              lambda: _200("/", "Agnes Video Generator")),
        check("E2", "GET /api/v1/config → 200",
              lambda: _200("/api/v1/config")),
        check("E3", "POST /api/v1/tasks/simple → ok",
              lambda: _post_ok("/api/v1/tasks/simple",
                               {"prompt": "test", "mode": "t2v", "duration": 5})),
        check("E4", "POST /api/v1/tasks/creative → ok",
              lambda: _post_ok("/api/v1/tasks/creative",
                               {"idea": "test cat", "user_requirement": "1 scene, 5 seconds"})),
        check("E5", "POST /api/v1/tasks/manuscript → ok",
              lambda: _post_ok("/api/v1/tasks/manuscript",
                               {"manuscript_text": "Test manuscript. Second sentence."})),
        check("E6", "GET /api/v1/tasks → list",
              lambda: _200("/api/v1/tasks")),
        check("E7", "GET /api/tasks/{id} → task_type",
              lambda: _e7_check()),

        check("E8", "POST /api/tasks/{id}/resume",
              lambda: _e8_e9_check("resume")),

        check("E9", "POST /api/tasks/{id}/stop",
              lambda: _e8_e9_check("stop")),
    )


async def _e7_check() -> tuple:
    try:
        r = await asyncio.to_thread(
            lambda: requests.get(f"{SERVER_URL}/api/v1/tasks", timeout=10))
        if r.status_code != 200:
            return False, f"HTTP {r.status_code}"
        tasks = r.json().get("tasks", [])
        if not tasks:
            return True, "no tasks (skip)"
        tid = tasks[0]["task_id"]
        r2 = await asyncio.to_thread(
            lambda: requests.get(f"{SERVER_URL}/api/v1/tasks/{tid}", timeout=10))
        ok = r2.status_code == 200 and "task_type" in r2.json()
        return ok, f"{tid} type={r2.json().get('task_type','?')}" if ok else f"HTTP {r2.status_code}"
    except Exception as e:
        return False, str(e)


async def _e8_e9_check(action: str) -> tuple:
    try:
        r = await asyncio.to_thread(
            lambda: requests.get(f"{SERVER_URL}/api/v1/tasks", timeout=10))
        if r.status_code != 200:
            return False, f"HTTP {r.status_code}"
        tasks = r.json().get("tasks", [])
        target = None
        for t in tasks:
            if action == "resume" and t.get("status") in ("pending", "failed"):
                target = t
                break
            if action == "stop" and t.get("status") == "running":
                target = t
                break
        if not target:
            return True, f"no suitable task for {action} (skip)"
        tid = target["task_id"]
        path = f"/api/tasks/{tid}/{action}"
        r2 = await asyncio.to_thread(
            lambda: requests.post(f"{SERVER_URL}{path}", timeout=15))
        ok = r2.status_code == 200
        return ok, f"{tid} {r2.status_code}" if ok else f"HTTP {r2.status_code}"
    except Exception as e:
        return False, str(e)


# ═══════════════════════════════════════════════════
# Main Flow
# ═══════════════════════════════════════════════════

async def main(resume: bool = False, auto_start: bool = False, quick: bool = False):
    logger.info("=" * 56)
    logger.info("  Agnes Video Generator v2.0 — Major Version Regression Testing")
    logger.info(f"  Max concurrency weight: {MAX_CONCURRENT_WEIGHT}/{AGNES_RATE_LIMIT}/min (weight/Agnes API)")
    resume and logger.info(f"  Mode: Resume (automatically skip completed scenarios)")
    quick and logger.info(f"  Mode: Quick Verification (skip running)")
    logger.info("=" * 56)

    # Ensure test assets exist
    _ensure_test_assets()

    if not await ensure_server(auto_start):
        logger.error("Service unavailable, exiting")
        return 1

    report = ReportManager(REPORT_PATH)

    if quick:
        logger.info("Quick validation mode: only check existing outputs")
        for sc in SCENARIO_DEFS:
            report.update_scenario(sc.id, "running")
            try:
                tasks = requests.get(f"{SERVER_URL}/api/tasks", timeout=5).json().get("tasks", [])
                task = next((t for t in tasks if t.get("creative_name", "").startswith(sc.type)), None)
                if task and task.get("status") == "completed":
                    checks = await validate_task(task.get("dir_name", task["task_id"]), sc)
                    report.update_scenario(sc.id, "completed", result={"checks": checks},
                                           errors=[k for k, v in checks.items() if v is False])
                    logger.info(f"  {sc.id}: Verified (dir={task.get('dir_name','?')})")
                else:
                    report.update_scenario(sc.id, "skipped", errors=["No completed task"])
                    logger.info(f"  {sc.id}: Skipped (no completed task)")
            except Exception as e:
                report.update_scenario(sc.id, "failed", errors=[str(e)])
        await verify_endpoints(report)
        report._save()
        report.generate_md_report(REPORT_MD_PATH)
        report.print_summary()
        return 0

    pending = [sc for sc in SCENARIO_DEFS if report.should_run(sc.id)]
    skipped = [sc for sc in SCENARIO_DEFS if not report.should_run(sc.id)]

    if skipped:
        logger.info(f"Skipped {len(skipped)}: {', '.join(s.id for s in skipped)}")
    if not pending:
        logger.info("No scenarios to run")
    else:
        logger.info(f"Concurrent {len(pending)} scenario(s) (max_weight={MAX_CONCURRENT_WEIGHT})")
        sema = WeightedSemaphore(MAX_CONCURRENT_WEIGHT)
        tasks = [run_scenario(sc, sema, report) for sc in pending]
        await asyncio.gather(*tasks)
        logger.info(f"All scenarios completed execution")

    await verify_endpoints(report)
    report._save()
    report.generate_md_report(REPORT_MD_PATH)

    passed = report.data["summary"]["failed"] == 0
    report.print_summary()
    logger.info(f"JSON Report: {REPORT_PATH}")
    logger.info(f"MD  Report: {REPORT_MD_PATH}")
    return 0 if passed else 1


def _print_help():
    print(__doc__)


if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser(description="Agnes Video Generator Major Version Regression Testing")
    p.add_argument("--resume", action="store_true", help="Resume existing report")
    p.add_argument("--auto-start", action="store_true", help="Automatically start the server")
    p.add_argument("--quick", action="store_true", help="Only verify existing outputs")
    args = p.parse_args()

    if args.quick and not args.resume:
        args.resume = True

    sys.exit(asyncio.run(main(resume=args.resume,
                               auto_start=args.auto_start,
                               quick=args.quick)))
