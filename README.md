# Kettlebell tracker

Arduino Nano 33 BLE Sense Rev2 stuck on a kettlebell, streaming live over Bluetooth to a Web Bluetooth page.
Live page: https://enough-design.github.io/kettlebelltracker/ (Chrome on Android / macOS).

| Path | What |
|---|---|
| `index.html` | The dashboard page (served by GitHub Pages). Single self-contained file. |
| `firmware/kb_tracker/kb_tracker.ino` | Nano firmware (v2). Libraries: ArduinoBLE, Arduino_BMI270_BMM150. |
| `data/raw/` | Raw CSV exports from the page: swing runs (12 and 20 kg, incl. a half-swing set and floor bangs) and overhead press captures (7.5, 12, 20 kg). The two 10 Nov files are early hand-held tests: `..._firmware-v1` is the first single-sample format (ms, ax..gz only, about 27 Hz, device clock jumps back 35 s at row 129) and `..._hand-swings-in-air_about-11` is the first file with phases (about 28 Hz, before batching). |
| `data/replays/` | Rep packets as hex JSON (for page tests) and rep dumps from the firmware replay. |
| `tools/harness2.cpp`, `tools/stubs/` | Compiles the real sketch against stub Arduino headers and replays a raw CSV through it. |
| `tools/analysis/` | Python scripts (pandas / numpy / scipy) used for tuning. |
| `tools/tests/` | Playwright page tests (headless Chromium). `viztest.js` replays recorded swing sets through the swing-trace angle model; `viztest_page.js` checks the trace card shows for Swings only. `userviewtest.js` walks a whole workout through the user view (simulator for swings and cleans, replayed press and Auto captures). `cleanviztest.js` replays the clean recordings through the clean dial (card for Cleans only, one tone per live clean, needle in the rack at each count). `limbtest.js` checks left / right: the hand of every labelled clean (live and final, incl. a mid-set switch), press and Auto hands, the swap switch, clean and press power, the balance maths and the CSV columns. |

Replay a CSV through the firmware logic:
`g++ -std=c++17 -I tools/stubs -I firmware/kb_tracker tools/harness2.cpp -o harness2 && ./harness2 <modes, see harness2.cpp>`

Design notes and decisions live in the claude.ai Project "Kettlebell tracker" (`kettlebell-tracker-notes.md`).
Firmware has not yet been tested on hardware beyond the page's rep/raw packets; thresholds validated on 12 kg and 20 kg only.
