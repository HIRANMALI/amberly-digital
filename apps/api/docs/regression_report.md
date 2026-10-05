# Agnes Video Generator v2.0 — Major Version Regression Test Report

| Metadata | Value |
|--------|-----|
| Date | 2026-06-19 12:02 UTC |
| Version | fbe52bf Merge branch 'v2.0-dev' |
| Report Version | 2.0 |
| Auto Validation | 27/63 Passed |

## Overview

| Status | Count |
|------|------|
| Total | 9 |
| ✅ Completed | 0 |
| ❌ Failed | 4 |
| ⏭️ Skipped | 5 |
| 🔄 Running | 0 |
| ⏳ Pending | 0 |

Endpoint verification: 0/9 ✅

---

## Simple Video (Simple)

### S1 Pure Text t2v — ⏭️ skipped
### S2 Image to Video ti2vid — ⏭️ skipped
### S3 Keyframes keyframes — ⏭️ skipped

| Check Item | S1 | S2 | S3 |
|---|---|---|---|
| F1_final_video_exists | ✅ | ✅ | ✅ |
| F1_final_video_nonempty | ✅ | ✅ | ✅ |
| F2_duration_gt_0 | ⏭️ | ⏭️ | ⏭️ |
| F4_has_audio_stream | ⏭️ | ⏭️ | ⏭️ |
| F4_has_speech | N/A | N/A | N/A |
| F6_text_match | N/A | N/A | N/A |
| F7_duration_reasonable | ⏭️ | ⏭️ | ⏭️ |
| R10_full_subtitle | N/A | N/A | N/A |
| R1_task_state_valid | ✅ | ✅ | ✅ |
| R2_task_type | simple | simple | simple |
| R2_task_type_matches | ✅ | ✅ | ✅ |
| R3_all_completed | N/A | N/A | N/A |
| R4_final_path_exists | ✅ | ✅ | ✅ |
| R5_has_video_id | ✅ | ✅ | ✅ |
| R5_task_json | ✅ | ✅ | ✅ |
| R6_curl_sh | ✅ | ✅ | ✅ |
| R6_has_video_id_in_curl | ✅ | ✅ | ✅ |
| R7_audio_files | N/A | N/A | N/A |
| R7_sub_dirs_exist | N/A | N/A | N/A |
| R8_subtitle_srt | N/A | N/A | N/A |
| R9_full_narration | N/A | N/A | N/A |

---

## Creative Video (Creative)

### C1 Pure Text + Independent + No Voice — ⏭️ skipped
### C2 With Ref Image + Keyframes + No Voice — ⏭️ skipped
### C3 Ref Image Generates End Frame + Keyframes + No Voice — ❌ failed
### C4 Independent Scenes + Voice & Subtitles — ❌ failed

| Check Item | C1 | C2 | C3 | C4 |
|---|---|---|---|---|

---

## Manuscript Video (Manuscript)

### M1 Short Manuscript + Voice — ❌ failed
### M2 Short Manuscript + Custom Subtitles — ❌ failed

| Check Item | M1 | M2 |
|---|---|---|

---

## Endpoint Verification (E1-E9)

| Endpoint | Status | Detail |
|------|------|------|
| E1 | ❌ | HTTPConnectionPool(host='localhost', port=8765): Max retries exceeded with url: / (Caused by NewConnectionError('<urllib3.connection.HTTPConnection object at 0x0000029CB521B240>: Failed to establish a new connection: [WinError 10061] No connection could be made because the target machine actively refused it')) |
| E2 | ❌ | HTTPConnectionPool(host='localhost', port=8765): Max retries exceeded with url: /api/config (Caused by NewConnectionError('<urllib3.connection.HTTPConnection object at 0x0000029CB521A7A0>: Failed to establish a new connection: [WinError 10061] No connection could be made because the target machine actively refused it')) |
| E3 | ❌ | HTTPConnectionPool(host='localhost', port=8765): Max retries exceeded with url: /api/tasks/simple (Caused by NewConnectionError('<urllib3.connection.HTTPConnection object at 0x0000029CB521A8B0>: Failed to establish a new connection: [WinError 10061] No connection could be made because the target machine actively refused it')) |
| E4 | ❌ | HTTPConnectionPool(host='localhost', port=8765): Max retries exceeded with url: /api/tasks/creative (Caused by NewConnectionError('<urllib3.connection.HTTPConnection object at 0x0000029CB521A9C0>: Failed to establish a new connection: [WinError 10061] No connection could be made because the target machine actively refused it')) |
| E5 | ❌ | HTTPConnectionPool(host='localhost', port=8765): Max retries exceeded with url: /api/tasks/manuscript (Caused by NewConnectionError('<urllib3.connection.HTTPConnection object at 0x0000029CB521A470>: Failed to establish a new connection: [WinError 10061] No connection could be made because the target machine actively refused it')) |
| E6 | ❌ | HTTPConnectionPool(host='localhost', port=8765): Max retries exceeded with url: /api/tasks (Caused by NewConnectionError('<urllib3.connection.HTTPConnection object at 0x0000029CB521A580>: Failed to establish a new connection: [WinError 10061] No connection could be made because the target machine actively refused it')) |
| E7 | ❌ | HTTPConnectionPool(host='localhost', port=8765): Max retries exceeded with url: /api/tasks (Caused by NewConnectionError('<urllib3.connection.HTTPConnection object at 0x0000029CB5219040>: Failed to establish a new connection: [WinError 10061] No connection could be made because the target machine actively refused it')) |
| E8 | ❌ | HTTPConnectionPool(host='localhost', port=8765): Max retries exceeded with url: /api/tasks (Caused by NewConnectionError('<urllib3.connection.HTTPConnection object at 0x0000029CB5219BF0>: Failed to establish a new connection: [WinError 10061] No connection could be made because the target machine actively refused it')) |
| E9 | ❌ | HTTPConnectionPool(host='localhost', port=8765): Max retries exceeded with url: /api/tasks (Caused by NewConnectionError('<urllib3.connection.HTTPConnection object at 0x0000029CB521A030>: Failed to establish a new connection: [WinError 10061] No connection could be made because the target machine actively refused it')) |

---

## Manual Verification Required

The following checks cannot be validated by script due to visual constraints, manual confirmation required:

| Check Item | Operation | Expected |
|--------|------|------|
| F5 Subtitle Visibility | Play final_video.mp4 and observe screen | Subtitle content, position, and style match configuration |

> Audio correctness (F4) and subtitle text matching (F6) are automatically verified by the script via whisper ASR.

## Error Summary

- **C1** (Pure Text + Independent + No Voice): No completed task
- **C2** (With Ref Image + Keyframes + No Voice): No completed task
- **C3** (Ref Image Generates End Frame + Keyframes + No Voice): HTTPConnectionPool(host='localhost', port=8765): Max retries exceeded with url: /api/tasks (Caused by NewConnectionError('<urllib3.connection.HTTPConnection object at 0x0000029CB521B130>: Failed to establish a new connection: [WinError 10061] No connection could be made because the target machine actively refused it'))
- **C4** (Independent Scenes + Voice & Subtitles): HTTPConnectionPool(host='localhost', port=8765): Max retries exceeded with url: /api/tasks (Caused by NewConnectionError('<urllib3.connection.HTTPConnection object at 0x0000029CB521B350>: Failed to establish a new connection: [WinError 10061] No connection could be made because the target machine actively refused it'))
- **M1** (Short Manuscript + Voice): HTTPConnectionPool(host='localhost', port=8765): Max retries exceeded with url: /api/tasks (Caused by NewConnectionError('<urllib3.connection.HTTPConnection object at 0x0000029CB521B020>: Failed to establish a new connection: [WinError 10061] No connection could be made because the target machine actively refused it'))
- **M2** (Short Manuscript + Custom Subtitles): HTTPConnectionPool(host='localhost', port=8765): Max retries exceeded with url: /api/tasks (Caused by NewConnectionError('<urllib3.connection.HTTPConnection object at 0x0000029CB521AF10>: Failed to establish a new connection: [WinError 10061] No connection could be made because the target machine actively refused it'))
- **S1** (Pure Text t2v): No completed task
- **S2** (Image to Video ti2vid): No completed task
- **S3** (Keyframes keyframes): No completed task
