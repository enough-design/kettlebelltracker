"""Truth for every capture, by set: swings, presses, cleans (None = unknown). Built from James's counts and set notes.
Cleans count every clean in the set, including the one that starts a press set."""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from ohp_common import CAPS as OHP
RAW = 'data/raw/'
T = {  # file: {set: (swings, presses, cleans)}
 'kb_raw_2026-11-11-13-05-20_12kg_2x10.csv': {1: (10, 0, 0), 2: (10, 0, 0)},
 'kb_raw_2026-11-11-13-50-08_12kg_4x10.csv': {1: (10, 0, 0), 2: (10, 0, 0), 3: (10, 0, 0), 4: (10, 0, 0)},
 'kb_raw_2026-11-11-14-15-55_20kg_4sets.csv': {1: (11, 0, 0), 2: (10, 0, 0), 3: (10, 0, 0), 4: (10, 0, 0)},
 'kb_raw_2026-11-12-14-56-28_20kg_half-swings-set1.csv': {1: (10, 0, 0), 2: (10, 0, 0)},          # set 1 all half swings
 'kb_raw_12kg-swings_2026-11-13-15-47-38.csv': {1: (10, 0, 0), 2: (7, 0, 0), 3: (0, 0, 0)},        # set 2: 6 full + 1 partial; set 3 floor bangs
 # press captures: swings / cleans from the set notes (None where the note does not give a number)
 OHP['A'][0]: {1: (0, 8, 1), 2: (0, 8, 1), 3: (0, 8, 1)},
 OHP['B'][0]: {1: (0, 8, 1), 2: (0, None, 1), 3: (0, 8, 1)},
 OHP['C'][0]: {1: (0, 8, 1), 2: (0, 8, 1), 3: (0, 8, 1)},
 OHP['D'][0]: {1: (0, 8, 1), 2: (0, 8, 1)},
 OHP['E'][0]: {1: (0, 8, 1), 2: (0, 8, 1), 3: (0, 8, 1), 4: (0, 0, 8)},
 OHP['F'][0]: {1: (0, 8, 1), 2: (0, 10, 1)},
 OHP['G'][0]: {1: (0, 8, 4), 2: (4, 4, 1), 3: (0, 10, 1), 4: (0, 8, 1)},
 OHP['H'][0]: {1: (0, 8, 1), 2: (0, 8, 1), 3: (4, 4, 1)},
 OHP['I'][0]: {1: (0, 8, 1), 2: (0, 8, 1), 3: (0, None, 4), 4: (0, 4, 5), 5: (0, 4, 4)},
 OHP['J'][0]: {1: (0, 8, 4), 2: (None, 6, 1), 3: (4, 4, 1), 4: (0, 4, 4)},
 # first blind test of Auto-detect (13 Nov 16:53). Sets 4 and 5: Nano on the BACK face of the bell. Set 1 presses unclear (4 or 5); set 5 note says
 # '8 cleans into 5 presses' but the data is 8 swings then 5 cleans with drops - to confirm with James.
 # second blind test of Auto-detect (v6), 13 Nov 21:14. Set 2: the stream stopped (Nano restarted) about 2 s before the end of the presses,
 # so the last presses are cut off; presses unscored.
 # 15 Nov swing-only sets, Nano on front and back (James: all full except the sets noted short). Counts from James where given, else the
 # Nano's own count (no disagreement noted). Back face: 10:39 set 1; 10:59 sets 2, 3, 5; calibration sets 4, 5.
 'kb_raw_12kg-swing-trace_2026-11-15-10-39-17.csv': {1: (10, 0, 0), 2: (10, 0, 0)},
 'kb_raw_12kg-swing-trace_2026-11-15-10-59-51.csv': {1: (20, 0, 0), 2: (20, 0, 0), 3: (11, 0, 0), 4: (10, 0, 0), 5: (10, 0, 0)},
 'kb_raw_12kg-swing-halfvfullvbackvfront_2026-11-15-11-16-16.csv': {1: (10, 0, 0), 2: (10, 0, 0), 3: (10, 0, 0), 4: (10, 0, 0), 5: (10, 0, 0)},
 # 11:29 retest: sets 4 and 5 short swings, many too short to register on the Nano (James: fine), so swing counts unscored.
 'kb_raw_12kg-swing-halfvfullvbackvfront_2026-11-15-11-29-57.csv': {1: (20, 0, 0), 2: (11, 0, 0), 3: (10, 0, 0)},
 # 15 Nov 12:13 Auto test, Nano on the back (sets 4 and 7 mounting not noted). 4 swings, 4 cleans, 4 presses per set; sets 1, 2, 9 had a
 # clean into the rack before the presses (5 cleans, James's convention; set 1 order S, C, C(rack), P). Set 8: 10 floor bangs, nothing counted.
 'kb_raw_12kg-auto-test_2026-11-15-12-13-23.csv': {1: (4, 4, 5), 2: (4, 4, 5), 3: (4, 4, 4), 4: (4, 4, 4), 5: (4, 4, 4), 6: (4, 4, 4), 7: (4, 4, 4), 8: (0, 0, 0), 9: (4, 4, 5)},
 # 15 Nov 14:46 clean/rack tests, Nano on the back: slow cleans with 2-3 s and 5 s+ rack holds; clean, settle, 4 presses x3;
 # clean and press straight out of it; alternating clean / press. All correct on the page (James).
 'kb_raw_12kg-cleans-test_2026-11-15-14-46-32.csv': {1: (0, 0, 5), 2: (0, 0, 5), 3: (0, 12, 3), 4: (0, 4, 1), 5: (0, 4, 4)},
 # 15 Nov 16:05 cleans, Cleans mode: sets 1-2 right hand, 3-5 LEFT hand (first left-hand data). Counts from James.
 'kb_raw_12kg-cleans-RHS-and-LHS-test_2026-11-15-16-05-41.csv': {1: (0, 0, 10), 2: (0, 0, 10), 3: (0, 0, 10), 4: (0, 0, 10), 5: (0, 0, 5)},
 # 15 Nov 16:27 cleans: set 1 right, 2-3 left, 4 right then left after 3 reps (hand switch without putting the bell down).
 'kb_raw_12kg-cleans-test_2026-11-15-16-27-28.csv': {1: (0, 0, 5), 2: (0, 0, 5), 3: (0, 0, 5), 4: (0, 0, 6)},
 'kb_raw_12kg-mix_2026-11-13-21-14-44.csv': {1: (10, 5, 6), 2: (5, None, 5)},
 'kb_raw_12kg-swings_2026-11-13-16-53-01.csv': {1: (8, None, 5), 2: (8, 5, 5), 3: (8, 5, 1), 4: (8, 5, 1), 5: (None, None, None)},
}
