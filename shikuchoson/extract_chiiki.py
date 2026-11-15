from __future__ import annotations

import argparse
import json
import re
import unicodedata
import xml.etree.ElementTree as ET
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable


MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"

NS = {"main": MAIN_NS}
COLUMN_NAMES = [chr(ord("A") + index) for index in range(25)]

KIND_FLAGS = {
    "R": "city",
    "S": "ward",
    "T": "town",
    "U": "village",
}

ALIAS_COLUMNS = ["E", "F", "G", "H", "I", "J", "K", "L", "M"]


def normalize_text(value: str) -> str:
    normalized = unicodedata.normalize("NFKC", value or "").casefold()
    normalized = normalized.replace(" ", "").replace("\u3000", "")
    normalized = normalized.replace("-", "").replace("ー", "")
    return normalized


def hiragana_to_katakana(value: str) -> str:
    result = []
    for char in value:
        code_point = ord(char)
        if 0x3041 <= code_point <= 0x3096:
            result.append(chr(code_point + 0x60))
        else:
            result.append(char)
    return "".join(result)


def compact_space(value: str) -> str:
    return re.sub(r"\s+", " ", unicodedata.normalize("NFKC", value or "")).strip()


def unique_values(values: Iterable[str]) -> list[str]:
    seen = set()
    result = []
    for value in values:
        cleaned = compact_space(value)
        if cleaned and cleaned not in seen:
            seen.add(cleaned)
            result.append(cleaned)
    return result


def workbook_sheets(workbook: zipfile.ZipFile) -> dict[str, str]:
    workbook_xml = ET.fromstring(workbook.read("xl/workbook.xml"))
    rels_xml = ET.fromstring(workbook.read("xl/_rels/workbook.xml.rels"))
    rels = {node.attrib["Id"]: node.attrib["Target"] for node in rels_xml}

    sheets = {}
    for sheet in workbook_xml.find(f"{{{MAIN_NS}}}sheets"):
        rel_id = sheet.attrib[f"{{{REL_NS}}}id"]
        target = rels[rel_id]
        path = "xl/" + target.lstrip("/") if not target.startswith("xl/") else target
        sheets[sheet.attrib["name"]] = path
    return sheets


def shared_strings(workbook: zipfile.ZipFile) -> list[str]:
    if "xl/sharedStrings.xml" not in workbook.namelist():
        return []

    root = ET.fromstring(workbook.read("xl/sharedStrings.xml"))
    values = []
    for item in root.findall("main:si", NS):
        values.append("".join(text.text or "" for text in item.findall(".//main:t", NS)))
    return values


def cell_text(cell: ET.Element, strings: list[str]) -> str:
    value = cell.find("main:v", NS)
    if value is None:
        inline = cell.find("main:is", NS)
        if inline is None:
            return ""
        return "".join(text.text or "" for text in inline.findall(".//main:t", NS))

    text = value.text or ""
    if cell.attrib.get("t") == "s":
        return strings[int(text)]
    return text


def iter_sheet_rows(workbook_path: Path, sheet_name: str) -> Iterable[dict[str, str]]:
    with zipfile.ZipFile(workbook_path) as workbook:
        sheets = workbook_sheets(workbook)
        if sheet_name not in sheets:
            available = ", ".join(sheets)
            raise ValueError(f"Sheet '{sheet_name}' not found. Available sheets: {available}")

        strings = shared_strings(workbook)
        worksheet = ET.fromstring(workbook.read(sheets[sheet_name]))

        for row in worksheet.findall(".//main:sheetData/main:row", NS):
            record = {column: "" for column in COLUMN_NAMES}
            record["_row"] = row.attrib.get("r", "")
            for cell in row.findall("main:c", NS):
                match = re.match(r"([A-Z]+)", cell.attrib.get("r", ""))
                if match and match.group(1) in record:
                    record[match.group(1)] = cell_text(cell, strings)
            yield record


def row_kind(row: dict[str, str]) -> str | None:
    for column, kind in KIND_FLAGS.items():
        if row[column]:
            return kind
    return None


def search_terms(*values: str) -> list[str]:
    terms = []
    for value in values:
        cleaned = compact_space(value)
        if not cleaned:
            continue
        terms.append(cleaned)
        terms.append(normalize_text(cleaned))
        terms.append(normalize_text(hiragana_to_katakana(cleaned)))
    return unique_values(terms)


def build_candidate(row: dict[str, str]) -> dict[str, object] | None:
    kind = row_kind(row)
    if kind is None:
        return None

    name = compact_space(row["F"])
    if name == "特別区部":
        return None

    reading = compact_space(row["N"])
    prefecture = compact_space(row["D"])
    display_name = f"{prefecture}{name}"
    aliases = unique_values(row[column] for column in ALIAS_COLUMNS)
    terms = search_terms(row["D"], name, reading, *aliases)

    return {
        "code": row["C"],
        "prefectureCode": row["A"],
        "localCode": row["B"],
        "prefecture": prefecture,
        "name": name,
        "displayName": display_name,
        "shortName": compact_space(row["G"]),
        "reading": reading,
        "kind": kind,
        "aliases": aliases,
        "searchText": " ".join(terms),
    }


def build_compact_candidate(candidate: dict[str, object]) -> dict[str, str]:
    return {
        "id": str(candidate["code"]),
        "displayName": str(candidate["displayName"]),
        "kind": str(candidate["kind"]),
        "searchText": str(candidate["searchText"]),
    }


def extract_candidates(workbook_path: Path, sheet_name: str) -> list[dict[str, object]]:
    candidates = []
    for row in iter_sheet_rows(workbook_path, sheet_name):
        candidate = build_candidate(row)
        if candidate is not None:
            candidates.append(candidate)
    return candidates


def write_json(output_path: Path, payload: object) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Extract municipality search candidates from the chiiki.xlsx workbook."
    )
    parser.add_argument("--input", type=Path, default=Path(__file__).with_name("chiiki.xlsx"))
    parser.add_argument("--sheet", default="Sheet1")
    parser.add_argument("--output", type=Path, default=Path(__file__).with_name("municipalities.json"))
    parser.add_argument("--full", action="store_true", help="Write the full extraction payload.")
    parser.add_argument("--stats", action="store_true", help="Print counts without writing the output file.")
    args = parser.parse_args()

    candidates = extract_candidates(args.input, args.sheet)
    payload_full = {
        "source": {
            "file": args.input.name,
            "sheet": args.sheet,
        },
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "count": len(candidates),
        "items": candidates,
    }
    payload_compact = {
        "source": payload_full["source"],
        "generatedAt": payload_full["generatedAt"],
        "count": payload_full["count"],
        "items": [build_compact_candidate(candidate) for candidate in candidates],
    }

    if args.stats:
        by_kind: dict[str, int] = {}
        for candidate in candidates:
            kind = str(candidate["kind"])
            by_kind[kind] = by_kind.get(kind, 0) + 1
        print(json.dumps({"count": len(candidates), "byKind": by_kind}, ensure_ascii=False, indent=2))
        return

    write_json(args.output, payload_full if args.full else payload_compact)
    print(f"Wrote {len(candidates)} candidates to {args.output}")


if __name__ == "__main__":
    main()