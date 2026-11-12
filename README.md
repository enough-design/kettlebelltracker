# Kettlebell tracker

Arduino Nano 33 BLE Sense Rev2 stuck on a kettlebell, streaming live over Bluetooth to a Web Bluetooth page.
Live page: https://enough-design.github.io/kettlebelltracker/ (Chrome on Android / macOS).

| Path | What |
|---|---|
| `index.html` | The dashboard page (served by GitHub Pages). Single self-contained file. |
| `firmware/kb_tracker/kb_tracker.ino` | Nano firmware (v2). Libraries: ArduinoBLE, Arduino_BMI270_BMM150. |
| `data/raw/` | Raw CSV exports from the page (12 kg and 20 kg swing runs, incl. a half-swing set). |
| `data/replays/` | Rep packets as hex JSON (for page tests) and rep dumps from the firmware replay. |
| `tools/harness2.cpp`, `tools/stubs/` | Compiles the real sketch against stub Arduino headers and replays a raw CSV through it. |
| `tools/analysis/` | Python scripts (pandas / numpy / scipy) used for tuning. |
| `tools/tests/` | Playwright page tests (headless Chromium). |

Replay a CSV through the firmware logic:
`g++ -std=c++17 -I tools/stubs -I firmware/kb_tracker tools/harness2.cpp -o harness2 && ./harness2 <modes, see harness2.cpp>`

Design notes and decisions live in the claude.ai Project "Kettlebell tracker" (`kettlebell-tracker-notes.md`).
Firmware has not yet been tested on hardware beyond the page's rep/raw packets; thresholds validated on 12 kg and 20 kg only.
