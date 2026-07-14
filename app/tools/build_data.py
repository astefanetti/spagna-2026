#!/usr/bin/env python3
"""
Genera app/data/days.json e app/data/pages.json a partire dai file
markdown in docs/. Da rilanciare ogni volta che si modifica un file
in docs/giorni/, docs/00-03-*.md, docs/allegati/ o docs/appendici/.

Uso (dalla cartella app/):
    python3 tools/build_data.py
    # opzionale: --src ../../docs --out ../data
"""
import argparse
import datetime
import json
import re
import sys
from pathlib import Path


def _json_default(o):
    if isinstance(o, (datetime.date, datetime.datetime)):
        return o.isoformat()
    raise TypeError(f"Object of type {o.__class__.__name__} is not JSON serializable")

try:
    import yaml
except ImportError:
    sys.exit("Serve pyyaml: pip install pyyaml --break-system-packages")


def split_frontmatter(text: str):
    """Divide un file markdown in (frontmatter_dict, body_markdown)."""
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        return {}, text.strip("\n")
    end_idx = None
    for i in range(1, len(lines)):
        if lines[i].strip() == "---":
            end_idx = i
            break
    if end_idx is None:
        return {}, text.strip("\n")
    fm_text = "\n".join(lines[1:end_idx])
    body = "\n".join(lines[end_idx + 1:]).strip("\n")
    try:
        fm = yaml.safe_load(fm_text) or {}
    except yaml.YAMLError:
        fm = {}
    return fm, body


def first_heading(md: str) -> str:
    m = re.search(r"^#\s+(.+)$", md, re.MULTILINE)
    return m.group(1).strip() if m else ""


def build_days(src: Path):
    days = []
    giorni_dir = src / "giorni"
    for f in sorted(giorni_dir.glob("*.md")):
        text = f.read_text(encoding="utf-8")
        fm, body = split_frontmatter(text)
        day_num = fm.get("day")
        try:
            day_num = int(day_num)
        except (TypeError, ValueError):
            m = re.search(r"(\d+)", f.stem)
            day_num = int(m.group(1)) if m else 0
        entry = dict(fm)
        entry["day"] = day_num
        entry["body"] = body
        entry["source_file"] = f"docs/giorni/{f.name}"
        days.append(entry)
    days.sort(key=lambda d: d.get("day") or 0)
    return days


PAGE_DEFS = [
    ("introduzione", "Guida", "00-introduzione.md"),
    ("preparazione", "Guida", "01-preparazione.md"),
    ("logistica-van", "Guida", "02-logistica-van.md"),
    ("gestione-scorte", "Guida", "03-gestione-scorte.md"),
    ("checklist-generale", "Allegati", "allegati/checklist-generale.md"),
    ("ristoranti", "Allegati", "allegati/ristoranti.md"),
    ("aree-camper", "Allegati", "allegati/aree-camper.md"),
    ("numeri-utili", "Appendici", "appendici/numeri-utili.md"),
    ("navigazione", "Appendici", "appendici/navigazione.md"),
]


def build_pages(src: Path):
    pages = []
    for order, (page_id, group, rel_path) in enumerate(PAGE_DEFS):
        f = src / rel_path
        if not f.exists():
            print(f"[avviso] pagina mancante: {rel_path}", file=sys.stderr)
            continue
        text = f.read_text(encoding="utf-8")
        fm, body = split_frontmatter(text)
        title = fm.get("title") or first_heading(body) or page_id
        pages.append({
            "id": page_id,
            "group": group,
            "title": title,
            "order": order,
            "body": body,
            "source_file": f"docs/{rel_path}",
        })
    return pages


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default="../../docs")
    ap.add_argument("--out", default="../data")
    args = ap.parse_args()

    here = Path(__file__).resolve().parent
    src = (here / args.src).resolve()
    out = (here / args.out).resolve()
    out.mkdir(parents=True, exist_ok=True)

    days = build_days(src)
    pages = build_pages(src)

    (out / "days.json").write_text(
        json.dumps(days, ensure_ascii=False, indent=2, default=_json_default),
        encoding="utf-8",
    )
    (out / "pages.json").write_text(
        json.dumps(pages, ensure_ascii=False, indent=2, default=_json_default),
        encoding="utf-8",
    )

    print(f"OK: {len(days)} giorni -> {out / 'days.json'}")
    print(f"OK: {len(pages)} pagine -> {out / 'pages.json'}")


if __name__ == "__main__":
    main()
