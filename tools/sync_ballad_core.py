"""Synchronize/check the identical BME core. Usage: python tools/sync_ballad_core.py OTHER_REPO [--check]."""
from pathlib import Path
import hashlib
import sys

source = Path(__file__).resolve().parent.parent / 'src/08a_ballad_core.js'
target = Path(sys.argv[1]).resolve() / 'src/08a_ballad_core.js'
if not target.parent.is_dir():
    raise SystemExit('Target must be an existing repository with src/')
if '--check' not in sys.argv:
    target.write_bytes(source.read_bytes())
if not target.is_file() or source.read_bytes() != target.read_bytes():
    raise SystemExit('BME core differs')
print('BME core 1.0.0 SHA-256:', hashlib.sha256(source.read_bytes()).hexdigest())
