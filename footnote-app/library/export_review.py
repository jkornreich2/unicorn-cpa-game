#!/usr/bin/env python3
"""Write the library as JSON for the review page: library/review-data.json.
Run from the repo root: python3 library/export_review.py [out_path]"""
import json, sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from build import parse, validate, AREAS

prompts, errors = parse()
errors = validate(prompts, errors)
if errors: sys.exit("Fix the library first:\n  " + "\n  ".join(errors))
out = {"areas": AREAS, "prompts": [
    {"id": p["id"], "sec": p["sec"], "area": p["area"], "q": p["q"],
     "a": [{"r": a["r"], "gem": a["gem"], "display": a["display"],
            "aliases": "; ".join(a["aliases"][1:]), "note": a["note"]} for a in p["a"]]}
    for p in prompts]}
path = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else pathlib.Path(__file__).parent / "review-data.json"
path.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
print(f"wrote {path} ({path.stat().st_size // 1024} KB, {len(out['prompts'])} prompts)")
