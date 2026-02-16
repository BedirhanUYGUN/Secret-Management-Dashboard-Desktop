from dataclasses import dataclass
from typing import List, Optional


@dataclass
class ImportPair:
    key: str
    value: str


@dataclass
class ParsedImport:
    project_heading: Optional[str]
    pairs: List[ImportPair]
    skipped: int


def parse_txt_import(content: str) -> ParsedImport:
    project_heading: Optional[str] = None
    pairs: List[ImportPair] = []
    skipped = 0

    for raw_line in content.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue

        if line.startswith("[") and line.endswith("]"):
            project_heading = line[1:-1].strip() or None
            continue

        if "=" not in line:
            skipped += 1
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if not key:
            skipped += 1
            continue

        pairs.append(ImportPair(key=key, value=value))

    return ParsedImport(project_heading=project_heading, pairs=pairs, skipped=skipped)
