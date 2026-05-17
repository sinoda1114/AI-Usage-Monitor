#!/usr/bin/env python3
"""Build Chrome Web Store submission zip (manifest at zip root, no extra parent folder)."""
from __future__ import annotations

import json
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

FILES = [
    "manifest.json",
    "background.js",
    "usage-collector.js",
    "i18n.js",
    "popup.html",
    "popup.js",
    "popup.css",
    "options.html",
    "options.js",
]


def main() -> None:
    version = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))["version"]
    out = ROOT / "releases" / f"ai-usage-monitor-store-v{version}.zip"
    out.parent.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zf:
        for name in FILES:
            path = ROOT / name
            if not path.is_file():
                raise SystemExit(f"missing: {path}")
            zf.write(path, arcname=name)

        icons = ROOT / "icons"
        if not icons.is_dir():
            raise SystemExit(f"missing dir: {icons}")
        for path in sorted(icons.glob("*.png")):
            zf.write(path, arcname=f"icons/{path.name}")

        loc = ROOT / "_locales"
        if not loc.is_dir():
            raise SystemExit(f"missing dir: {loc}")
        for path in sorted(loc.rglob("*")):
            if path.is_file():
                arc = path.relative_to(ROOT).as_posix()
                zf.write(path, arcname=arc)

    print(out)
    print(f"size: {out.stat().st_size} bytes")


if __name__ == "__main__":
    main()
