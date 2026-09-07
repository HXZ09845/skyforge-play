from pathlib import Path
import json, hashlib
root = Path(__file__).resolve().parents[1]
manifest = json.loads((root / "asset-manifest.json").read_text())
for name, expected in manifest.items():
    path = root / name
    assert path.is_file(), name
    assert hashlib.sha256(path.read_bytes()).hexdigest() == expected, name
assert (root / "index.wasm").read_bytes()[:4] == b"\x00asm"
html = (root / "index.html").read_text()
assert "$GODOT_" not in html
assert "threads: false" in html
assert "skyforgePause" in html
print(f"Validated {len(manifest)} runtime assets")
