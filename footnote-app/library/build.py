#!/usr/bin/env python3
"""Build the Footnote question library.

Reads library/far.txt, aud.txt, reg.txt, checks them, and writes the PROMPTS
array into index.html (between the "const PROMPTS = [" line and its closing
"];"). Also writes library/REVIEW.md, a readable sheet for checking answers.

Run from the repo root:  python3 library/build.py
"""
import json, re, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
LIB = ROOT / "library"
FILES = ["far.txt", "aud.txt", "reg.txt"]
TIER = {1: "On the face", 2: "Review-course favorite", 3: "Solid", 4: "Sharp", 5: "Deep cut", 6: "Footnote"}

def norm(s):
    s = s.lower().replace("&", " and ")
    s = re.sub(r"['’.]", "", s)
    s = re.sub(r"[^a-z0-9]+", " ", s)
    s = " ".join(w for w in s.split() if w not in ("a", "an", "the"))
    return s.strip()

def parse():
    prompts, errors = [], []
    for fn in FILES:
        cur = None
        for n, line in enumerate((LIB / fn).read_text().splitlines(), 1):
            where = f"{fn}:{n}"
            t = line.strip()
            if not t or (t.startswith("#") and not t.startswith("##")):
                continue
            if t.startswith("##"):
                parts = [p.strip() for p in t[2:].split("|")]
                if len(parts) != 3:
                    errors.append(f"{where}: header needs 'id | SECTION | prompt'"); cur = None; continue
                cur = {"id": parts[0], "sec": parts[1], "q": parts[2], "a": [], "where": where}
                prompts.append(cur); continue
            if cur is None:
                errors.append(f"{where}: answer line before any ## header"); continue
            parts = [p.strip() for p in t.split("|")]
            if len(parts) < 2:
                errors.append(f"{where}: needs at least 'rarity | answer'"); continue
            m = re.fullmatch(r"([1-6])(\*?)", parts[0])
            if not m:
                errors.append(f"{where}: rarity must be 1-6, optionally followed by *"); continue
            display = parts[1]
            aliases = [display] + [a.strip() for a in (parts[2] if len(parts) > 2 else "").split(";") if a.strip()]
            note = " | ".join(parts[3:]).strip() if len(parts) > 3 else ""
            cur["a"].append({"r": int(m.group(1)), "gem": bool(m.group(2)), "display": display,
                             "aliases": aliases, "note": note, "where": where})
    return prompts, errors

def validate(prompts, errors):
    seen = set()
    for p in prompts:
        w = p["where"]
        if p["id"] in seen: errors.append(f"{w}: duplicate id {p['id']}")
        seen.add(p["id"])
        if p["sec"] not in ("FAR", "AUD", "REG"): errors.append(f"{w}: section must be FAR, AUD or REG")
        if len(p["a"]) < 10: errors.append(f"{w}: {p['id']} has {len(p['a'])} answers (need at least 10)")
        gems = [a for a in p["a"] if a["gem"]]
        if len(gems) != 1: errors.append(f"{w}: {p['id']} has {len(gems)} gems (need exactly 1)")
        if not any(a["r"] == 1 for a in p["a"]): errors.append(f"{w}: {p['id']} has no rarity-1 answer")
        owner = {}
        for i, a in enumerate(p["a"]):
            for al in a["aliases"]:
                k = norm(al)
                if not k: continue
                if k in owner and owner[k] != i:
                    errors.append(f"{a['where']}: alias '{al}' also belongs to '{p['a'][owner[k]]['display']}'")
                owner[k] = i
    return errors

def to_js(prompts):
    out = []
    for p in prompts:
        rows = []
        for a in p["a"]:
            uniq = []
            for al in a["aliases"]:
                k = al.lower()
                if k not in uniq: uniq.append(k)
            row = [a["r"], a["display"], "|".join(uniq)]
            if a["note"] or a["gem"]: row.append(a["note"])
            if a["gem"]: row.append(1)
            rows.append("  " + json.dumps(row, ensure_ascii=False))
        out.append(" {id:%s, sec:%s, q:%s, a:[\n%s\n ]}" % (json.dumps(p["id"]), json.dumps(p["sec"]),
                   json.dumps(p["q"], ensure_ascii=False), ",\n".join(rows)))
    return ",\n".join(out)

def review(prompts):
    L = ["# Footnote question library: review sheet", "",
         f"{len(prompts)} prompts, {sum(len(p['a']) for p in prompts)} answers. Edit the .txt files, not this sheet, then run `python3 library/build.py`.", ""]
    for sec in ("FAR", "AUD", "REG"):
        ps = [p for p in prompts if p["sec"] == sec]
        L += [f"## {sec} ({len(ps)} prompts)", ""]
        for p in ps:
            L += [f"### {p['q']}  `{p['id']}`", "", "| Rarity | Answer | Note |", "|---|---|---|"]
            for a in sorted(p["a"], key=lambda a: a["r"]):
                L.append(f"| {a['r']} {TIER[a['r']]}{' 💎' if a['gem'] else ''} | {a['display']} | {a['note']} |")
            L.append("")
    return "\n".join(L)

def main():
    prompts, errors = parse()
    errors = validate(prompts, errors)
    if errors:
        print("Library has problems:\n  " + "\n  ".join(errors)); sys.exit(1)
    html_path = ROOT / "index.html"
    html = html_path.read_text()
    start = html.index("const PROMPTS = [\n") + len("const PROMPTS = [\n")
    end = html.index("\n];", start)
    html = html[:start] + to_js(prompts) + html[end:]
    html_path.write_text(html)
    (LIB / "REVIEW.md").write_text(review(prompts))
    counts = {s: sum(p["sec"] == s for p in prompts) for s in ("FAR", "AUD", "REG")}
    print(f"OK: {len(prompts)} prompts {counts}, {sum(len(p['a']) for p in prompts)} answers")

if __name__ == "__main__":
    main()
