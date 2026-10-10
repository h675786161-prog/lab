#!/usr/bin/env python3
"""Build Echo Performance real-data fixtures from the user's source ZIP.

The source chat is kept byte-identical for real-heavy-259. Long DOM fixtures keep
chat metadata exactly once and repeat only the 259 message records.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import zipfile

EXPECTED = {
    "奇怪童话镇 - 2026-09-08@00h45m58s692ms - Branch #3.jsonl": "8b57666fb79ed84fe5914910d3b74873e2cb7bdc2cce5d8178056690f497f5d3",
    "CRYSTAL_CLARITY.json": "b37bde2ccfe3ddb1a9a5a1ec43a7e0875f559b19648063ce738d24da140b0cf3",
    "加菲也开学_8.22.json": "53919743b4c7ec16ea21f4460a74ed29f06ce890d1d246eee48b919b978be52b",
    "奇怪童话镇1.json": "bbe74db6d109a6ee6268bb26b6858760775b07500a67fa28487b863f22a79dbd",
}

EXPECTED_GENERATED = {
    "real-heavy-259.jsonl": "8b57666fb79ed84fe5914910d3b74873e2cb7bdc2cce5d8178056690f497f5d3",
    "long-dom-1036.jsonl": "745cab2d17841100486309233adbe7783492bfd1ac0764f15d26dbbe3b07d577",
    "long-dom-1295.jsonl": "683939286cef6c44204b172625af85e352232776f32f29ee4d875bc16b4eeb78",
}


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def member_by_basename(archive: zipfile.ZipFile, basename: str) -> str:
    matches = [name for name in archive.namelist() if Path(name).name == basename]
    if len(matches) != 1:
        raise RuntimeError(f"Expected exactly one {basename!r} in ZIP, found {matches}")
    return matches[0]


def read_validated(archive: zipfile.ZipFile, basename: str) -> bytes:
    data = archive.read(member_by_basename(archive, basename))
    actual = sha256(data)
    expected = EXPECTED[basename]
    if actual != expected:
        raise RuntimeError(f"SHA256 mismatch for {basename}: expected {expected}, got {actual}")
    return data


def validate_jsonl(data: bytes, expected_messages: int) -> dict:
    lines = data.splitlines()
    rows = [json.loads(line) for line in lines]
    metadata_rows = [row for row in rows if isinstance(row, dict) and "chat_metadata" in row]
    if len(metadata_rows) != 1:
        raise RuntimeError(f"Expected exactly one chat metadata row, found {len(metadata_rows)}")
    if len(rows) - 1 != expected_messages:
        raise RuntimeError(f"Expected {expected_messages} message rows, found {len(rows) - 1}")
    first = rows[0]
    if "chat_metadata" not in first:
        raise RuntimeError("The first JSONL row must be chat metadata")
    return {
        "lines": len(rows),
        "message_records": len(rows) - 1,
        "metadata_records": 1,
        "world_backstage_present": "world_backstage_v1" in first.get("chat_metadata", {}),
    }


def write_file(path: Path, data: bytes) -> dict:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return {"bytes": len(data), "sha256": sha256(data)}


def build(zip_path: Path, out_dir: Path) -> dict:
    out_dir.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path) as archive:
        chat = read_validated(archive, "奇怪童话镇 - 2026-09-08@00h45m58s692ms - Branch #3.jsonl")
        crystal = read_validated(archive, "CRYSTAL_CLARITY.json")
        garfield = read_validated(archive, "加菲也开学_8.22.json")
        preset = read_validated(archive, "奇怪童话镇1.json")

    source_lines = chat.splitlines()
    if len(source_lines) != 260:
        raise RuntimeError(f"Expected 260 source lines, found {len(source_lines)}")
    metadata, messages = source_lines[0], source_lines[1:]
    if len(messages) != 259:
        raise RuntimeError(f"Expected 259 source messages, found {len(messages)}")

    fixtures = {
        "real-heavy-259.jsonl": chat,
        "long-dom-1036.jsonl": b"\n".join([metadata] + messages * 4),
        "long-dom-1295.jsonl": b"\n".join([metadata] + messages * 5),
    }

    manifest = {
        "schema": 1,
        "source_zip": str(zip_path),
        "construction": {
            "real-heavy-259": "byte-identical source chat",
            "long-dom-1036": "metadata once + 259 real message records repeated four times",
            "long-dom-1295": "metadata once + 259 real message records repeated five times",
            "send_date": "preserved exactly; no synthetic timestamp rewrite in the canonical fixtures",
        },
        "files": {},
    }

    for filename, data in fixtures.items():
        expected_messages = {"real-heavy-259.jsonl": 259, "long-dom-1036.jsonl": 1036, "long-dom-1295.jsonl": 1295}[filename]
        validation = validate_jsonl(data, expected_messages)
        expected_hash = EXPECTED_GENERATED[filename]
        actual_hash = sha256(data)
        if actual_hash != expected_hash:
            raise RuntimeError(f"Generated fixture hash drift for {filename}: expected {expected_hash}, got {actual_hash}")
        info = write_file(out_dir / filename, data)
        manifest["files"][filename] = {**info, **validation}

    assets = {
        "themes/CRYSTAL_CLARITY.json": crystal,
        "themes/加菲也开学_8.22.json": garfield,
        "presets/奇怪童话镇1.json": preset,
    }
    for relative, data in assets.items():
        manifest["files"][relative] = write_file(out_dir / relative, data)

    manifest_path = out_dir / "generated-manifest.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("zip", type=Path, help="Path to 新建文件夹.zip")
    parser.add_argument("--out", type=Path, default=Path("fixtures/echo-performance-real/generated"))
    args = parser.parse_args()
    manifest = build(args.zip, args.out)
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
