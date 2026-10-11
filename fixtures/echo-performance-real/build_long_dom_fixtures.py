#!/usr/bin/env python3
"""Build Echo real-data long-DOM fixtures without duplicating chat metadata.

Input is the original SillyTavern JSONL chat. The first JSON record is copied
verbatim exactly once. Message records are repeated verbatim, preserving every
field and message body. No world_backstage_v1 / branchOverrides state is
synthesized or duplicated beyond the original metadata record.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def parse_records(raw: bytes) -> list[bytes]:
    # splitlines() correctly handles an original file with no trailing newline.
    records = raw.splitlines()
    if not records:
        raise ValueError("empty JSONL chat")
    for index, record in enumerate(records, 1):
        try:
            json.loads(record)
        except Exception as exc:
            raise ValueError(f"invalid JSON on record {index}") from exc
    return records


def validate_source(records: list[bytes]) -> None:
    metadata = json.loads(records[0])
    if not isinstance(metadata, dict) or "chat_metadata" not in metadata:
        raise ValueError("record 1 must be the single SillyTavern chat metadata row")
    for index, record in enumerate(records[1:], 2):
        obj = json.loads(record)
        if isinstance(obj, dict) and "chat_metadata" in obj:
            raise ValueError(f"unexpected chat_metadata on message record {index}")


def build(metadata: bytes, messages: list[bytes], multiplier: int) -> bytes:
    if multiplier < 1:
        raise ValueError("multiplier must be >= 1")
    # Deliberately do not reserialize records. This preserves all source fields,
    # message bodies and metadata bytes. Repeated send_date values are accepted;
    # shift them only if a future real-browser test proves SillyTavern requires it.
    return b"\n".join([metadata, *(messages * multiplier)]) + b"\n"


def inspect(raw: bytes) -> dict:
    records = parse_records(raw)
    metadata_rows = 0
    for record in records:
        obj = json.loads(record)
        if isinstance(obj, dict) and "chat_metadata" in obj:
            metadata_rows += 1
    return {
        "bytes": len(raw),
        "records": len(records),
        "metadataRows": metadata_rows,
        "messageRows": len(records) - metadata_rows,
        "endsWithNewline": raw.endswith(b"\n"),
        "sha256": sha256(raw),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path, help="original real-heavy JSONL chat")
    parser.add_argument("--out-dir", type=Path, required=True)
    args = parser.parse_args()

    source_raw = args.source.read_bytes()
    records = parse_records(source_raw)
    validate_source(records)
    metadata, messages = records[0], records[1:]
    if len(messages) != 259:
        raise ValueError(f"expected 259 source messages, found {len(messages)}")

    args.out_dir.mkdir(parents=True, exist_ok=True)
    real_path = args.out_dir / "real-heavy-259.jsonl"
    # Fixture A is an exact byte copy, including whether the source ends with \n.
    real_path.write_bytes(source_raw)

    specs = [(4, "long-dom-1036.jsonl", 1036), (5, "long-dom-1295.jsonl", 1295)]
    for multiplier, name, expected_messages in specs:
        payload = build(metadata, messages, multiplier)
        target = args.out_dir / name
        target.write_bytes(payload)
        summary = inspect(payload)
        if summary["metadataRows"] != 1 or summary["messageRows"] != expected_messages:
            raise RuntimeError(f"fixture validation failed for {name}: {summary}")

    manifest = {
        "rules": {
            "metadataCopiedOnce": True,
            "messageRecordsPreservedVerbatim": True,
            "messageBodiesModified": False,
            "sendDateShifted": False,
            "worldBackstageNaturalEvolutionClaimAllowed": False,
        },
        "fixtures": {
            name: inspect((args.out_dir / name).read_bytes())
            for name in ["real-heavy-259.jsonl", "long-dom-1036.jsonl", "long-dom-1295.jsonl"]
        },
    }
    (args.out_dir / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
