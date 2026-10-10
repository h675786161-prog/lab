#!/usr/bin/env python3
"""Audit world_backstage_v1 storage without mutating chat data."""

from __future__ import annotations

import argparse
import hashlib
import json
import statistics
from pathlib import Path


def dumps(value, *, sort_keys=False) -> bytes:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=sort_keys).encode("utf-8")


def size(value) -> int:
    return len(dumps(value))


def digest(value) -> str:
    return hashlib.sha256(dumps(value, sort_keys=True)).hexdigest()


def summarize(values: list[int]) -> dict:
    if not values:
        return {"count": 0, "sum": 0, "min": 0, "median": 0, "max": 0, "mean": 0}
    return {
        "count": len(values),
        "sum": sum(values),
        "min": min(values),
        "median": statistics.median(values),
        "max": max(values),
        "mean": statistics.mean(values),
    }


def list_repetition(values: list[list]) -> dict:
    total_elements = 0
    total_bytes = 0
    unique: dict[str, int] = {}
    for array in values:
        for value in array:
            item_size = size(value)
            item_hash = digest(value)
            total_elements += 1
            total_bytes += item_size
            unique.setdefault(item_hash, item_size)
    unique_bytes = sum(unique.values())
    return {
        "totalElements": total_elements,
        "uniqueElements": len(unique),
        "repeatedElementRatio": (1 - len(unique) / total_elements) if total_elements else 0,
        "totalElementBytes": total_bytes,
        "uniqueElementBytes": unique_bytes,
        "repeatedByteRatio": (1 - unique_bytes / total_bytes) if total_bytes else 0,
    }


def audit(chat_path: Path) -> dict:
    with chat_path.open("r", encoding="utf-8") as handle:
        first = json.loads(handle.readline())
    metadata = first.get("chat_metadata", {})
    wb = metadata.get("world_backstage_v1")
    if not isinstance(wb, dict):
        raise RuntimeError("chat_metadata.world_backstage_v1 is missing or not an object")

    overrides = wb.get("branchOverrides", {})
    if not isinstance(overrides, dict):
        raise RuntimeError("world_backstage_v1.branchOverrides is not an object")

    override_items = list(overrides.items())
    override_sizes = [size(value) for _, value in override_items]
    states = [value.get("state", {}) for _, value in override_items if isinstance(value, dict)]

    field_names = sorted({key for state in states if isinstance(state, dict) for key in state})
    fields = {}
    for field in field_names:
        present = [state[field] for state in states if isinstance(state, dict) and field in state]
        hashes = [digest(value) for value in present]
        field_sizes = [size(value) for value in present]
        entry = {
            "type": type(present[0]).__name__ if present else None,
            "snapshotsPresent": len(present),
            "uniqueWholeValues": len(set(hashes)),
            "wholeValueDuplicateRatio": (1 - len(set(hashes)) / len(hashes)) if hashes else 0,
            "bytes": summarize(field_sizes),
        }
        if present and all(isinstance(value, list) for value in present):
            entry["listRepetition"] = list_repetition(present)
            entry["listLengths"] = summarize([len(value) for value in present])
        fields[field] = entry

    top_level_sizes = {key: size(value) for key, value in wb.items()}
    branch_bytes = size(overrides)
    wb_bytes = size(wb)

    return {
        "chat": str(chat_path),
        "worldBackstage": {
            "bytes": wb_bytes,
            "topLevelFieldBytes": dict(sorted(top_level_sizes.items(), key=lambda pair: -pair[1])),
        },
        "branchOverrides": {
            "count": len(overrides),
            "bytes": branch_bytes,
            "ratioOfWorldBackstage": branch_bytes / wb_bytes if wb_bytes else 0,
            "overrideBytes": summarize(override_sizes),
            "exactDuplicateWholeOverrides": len(overrides) - len({digest(value) for value in overrides.values()}),
            "stateFields": fields,
        },
        "interpretationRules": [
            "This is a storage audit only. It does not prove CPU cost by itself.",
            "RepeatedByteRatio is element-level repetition across branch snapshots, not a proposed compression ratio.",
            "Do not use duplicated long-DOM fixtures to infer natural world_backstage_v1 evolution beyond the original chat.",
        ],
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("chat", type=Path)
    parser.add_argument("--out", type=Path)
    args = parser.parse_args()
    result = audit(args.chat)
    text = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(text, encoding="utf-8")
    print(text, end="")


if __name__ == "__main__":
    main()
