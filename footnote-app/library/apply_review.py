#!/usr/bin/env python3
"""Apply edits saved in the Footnote review page to the library .txt files.

Usage (from the repo root):
  python3 library/apply_review.py edits.json [--dry-run]

edits.json is a list of the review page's documents (or {"docs": [...]}), each:
  {id, sec, area, q, a: [{r, gem, display, aliases, note}], status, comment, isNew, applied}

Only documents with applied != true are used. Prompts marked "deleted" are removed.
Edited or new prompts are written in place (new ones go at the end of the section's
part-2 file). Prints a report of what changed and of flagged prompts and notes for Claude.
Run library/build.py afterwards to validate and rebuild the game.
"""
import json, re, sys, pathlib

LIB = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(LIB))
from build import parse  # noqa: E402

HEADER = re.compile(r"^## ([a-z0-9-]+) \|")

def clean(s):
    return re.sub(r"\s+", " ", str(s or "").replace("|", "/")).strip()

def block(p):
    lines = [f"## {p['id']} | {p['sec']} | {clean(p['q'])} | {p['area']}"]
    for a in p["a"]:
        if not clean(a.get("display")): continue
        aliases = "; ".join(x for x in (clean(y) for y in str(a.get("aliases", "")).split(";")) if x)
        note = clean(a.get("note"))
        line = f"{int(a['r'])}{'*' if a.get('gem') else ''} | {clean(a['display'])} | {aliases}"
        if note: line += f" | {note}"
        lines.append(line)
    return lines

def same(p, cur):
    """Is the edited prompt identical to the current library version?"""
    if not cur: return False
    def key(x, from_lib):
        ans = []
        for a in x["a"]:
            als = a["aliases"][1:] if from_lib else [clean(y) for y in str(a.get("aliases", "")).split(";") if clean(y)]
            ans.append((int(a["r"]), bool(a["gem"]), clean(a["display"]), tuple(clean(y) for y in als), clean(a.get("note"))))
        return (x["sec"], x["area"], clean(x["q"]), tuple(ans))
    return key(p, False) == key(cur, True)

def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    dry = "--dry-run" in sys.argv
    raw = json.loads(pathlib.Path(args[0]).read_text())
    docs = raw.get("docs", raw) if isinstance(raw, dict) else raw
    docs = [d.get("data", d) if isinstance(d, dict) and "data" in d and isinstance(d["data"], dict) else d for d in docs]
    pending = [d for d in docs if not d.get("applied")]

    current = {p["id"]: p for p in parse()[0]}
    files = {fn.name: fn.read_text().split("\n") for fn in sorted(LIB.glob("*.txt"))}
    where = {}
    for fn, lines in files.items():
        for i, l in enumerate(lines):
            m = HEADER.match(l)
            if m: where[m.group(1)] = fn

    def span(lines, pid):
        start = next(i for i, l in enumerate(lines) if (m := HEADER.match(l)) and m.group(1) == pid)
        end = start + 1
        while end < len(lines) and not lines[end].startswith("#"): end += 1
        while end > start + 1 and not lines[end - 1].strip(): end -= 1   # keep the blank line between blocks
        return start, end

    changed, deleted, added, unchanged, flagged = [], [], [], [], []
    for d in pending:
        pid = d["id"]
        if d.get("comment", "").strip() or d.get("status") == "flagged":
            flagged.append((pid, d.get("status"), d.get("comment", "").strip()))
        if d.get("status") == "deleted":
            if pid in where:
                lines = files[where[pid]]; s, e = span(lines, pid)
                while e < len(lines) and not lines[e].strip(): e += 1
                del lines[s:e]; deleted.append(pid); where.pop(pid)
            continue
        if same(d, current.get(pid)):
            unchanged.append(pid); continue
        if pid in where:
            lines = files[where[pid]]; s, e = span(lines, pid)
            lines[s:e] = block(d); changed.append(pid)
        else:
            fn = f"{d['sec'].lower()}2.txt"
            lines = files.setdefault(fn, [f"# FOOTNOTE LIBRARY: {d['sec']}, part 2   (format explained at the top of far.txt)"])
            if "# ---------- Added in review ----------" not in lines:
                while lines and not lines[-1].strip(): lines.pop()
                lines += ["", "# ---------- Added in review ----------"]
            while lines and not lines[-1].strip(): lines.pop()
            lines += [""] + block(d)
            where[pid] = fn; added.append(pid)

    if not dry:
        for fn, lines in files.items():
            text = "\n".join(lines).rstrip("\n") + "\n"
            (LIB / fn).write_text(text)
    print(f"{'Would change' if dry else 'Changed'}: {len(changed)} edited, {len(added)} added, {len(deleted)} deleted, {len(unchanged)} reviewed with no changes")
    for label, ids in (("edited", changed), ("added", added), ("deleted", deleted)):
        if ids: print(f"  {label}: " + ", ".join(ids))
    if flagged:
        print("Flagged or with notes for Claude:")
        for pid, st, c in flagged: print(f"  [{st}] {pid}: {c or '(no note)'}")

if __name__ == "__main__":
    main()
