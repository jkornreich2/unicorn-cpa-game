// Builds the playable game from the case files.
//   node scripts/build.mjs          check every case, then write dist/index.html
//   node scripts/build.mjs --check  check every case only
//
// Source of truth:
//   content/cases/far.json, aud.json, reg.json   the cases (edit these)
//   web/template.html                            the game screens and logic
// Output:
//   dist/index.html                              one self-contained page to play or publish

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ROUNDS = ["seed", "series-a", "ipo"];
const SECTIONS = ["FAR", "AUD", "REG"];      // core sections: these make up the game
const PARKED = ["TCP"];                        // discipline sections: checked, but not in the game yet
const TYPES = ["mcq", "num", "je"];
const REQUIRED = ["id", "round", "order", "section", "topic", "from", "message", "question", "type", "explanation", "takeaway"];

const errors = [];
const cases = [];
const ids = new Set();

// Outlines: content/outline/<section>.json lists the study modules. When a section has one,
// every case in it must carry a studyArea of the form "Area · Module" that matches it.
const outlines = {};
for (const s of [...SECTIONS, ...PARKED]) {
  const p = join(root, `content/outline/${s.toLowerCase()}.json`);
  if (!existsSync(p)) continue;
  const o = JSON.parse(readFileSync(p, "utf8"));
  outlines[s] = new Set(o.areas.flatMap((a) => a.modules.map((m) => `${a.area} · ${m}`)));
}

const parked = [];
for (const section of [...SECTIONS, ...PARKED]) {
  const file = `content/cases/${section.toLowerCase()}.json`;
  if (PARKED.includes(section) && !existsSync(join(root, file))) continue;
  let list;
  try {
    list = JSON.parse(readFileSync(join(root, file), "utf8"));
  } catch (e) {
    errors.push(`${file}: could not read or parse (${e.message})`);
    continue;
  }
  if (!Array.isArray(list)) { errors.push(`${file}: must be a list of cases`); continue; }

  list.forEach((c, i) => {
    const where = `${file} case ${c.id || "#" + (i + 1)}`;
    const bad = (msg) => errors.push(`${where}: ${msg}`);
    for (const f of REQUIRED) if (c[f] === undefined || c[f] === "") bad(`missing "${f}"`);
    if (ids.has(c.id)) bad(`id "${c.id}" is used twice`);
    ids.add(c.id);
    if (c.section !== section) bad(`section is "${c.section}" but this file is for ${section}`);
    if (!ROUNDS.includes(c.round)) bad(`round must be one of ${ROUNDS.join(", ")}`);
    if (outlines[section] && !outlines[section].has(c.studyArea))
      bad(`studyArea "${c.studyArea || ""}" is not a module in content/outline/${section.toLowerCase()}.json`);
    if (!TYPES.includes(c.type)) bad(`type must be one of ${TYPES.join(", ")}`);
    if (c.type === "mcq") {
      if (!Array.isArray(c.options) || c.options.length < 2) bad("needs at least 2 options");
      else if (!Number.isInteger(c.answer) || c.answer < 0 || c.answer >= c.options.length)
        bad(`answer must be the position of the right option, 0 to ${c.options.length - 1}`);
    }
    if (c.type === "num") {
      if (typeof c.answer !== "number") bad("answer must be a number");
      if (typeof c.tolerance !== "number" || c.tolerance < 0) bad("tolerance must be 0 or more");
    }
    if (c.type === "je") {
      if (typeof c.amount !== "number" || c.amount <= 0) bad("amount must be a positive number");
      if (!Array.isArray(c.accounts) || c.accounts.length < 2) bad("needs at least 2 accounts to pick from");
      else {
        if (!c.accounts.includes(c.debit)) bad(`debit "${c.debit}" is not in the accounts list`);
        if (!c.accounts.includes(c.credit)) bad(`credit "${c.credit}" is not in the accounts list`);
      }
      if (c.debit === c.credit) bad("debit and credit must be different accounts");
    }
    (PARKED.includes(section) ? parked : cases).push(c);
  });
}

// Every round needs at least one case or the round-close screen breaks.
for (const r of ROUNDS) if (!cases.some((c) => c.round === r)) errors.push(`no cases in round "${r}"`);

if (errors.length) {
  console.error(`Found ${errors.length} problem(s):\n- ` + errors.join("\n- "));
  process.exit(1);
}

cases.sort((a, b) => ROUNDS.indexOf(a.round) - ROUNDS.indexOf(b.round) || a.order - b.order);
const counts = SECTIONS.map((s) => `${s} ${cases.filter((c) => c.section === s).length}`).join(", ");
const unreviewed = cases.filter((c) => !c.review?.reviewedBy).length;
console.log(`All ${cases.length} cases pass (${counts}). ${unreviewed} not yet reviewed by a CPA.`);
if (parked.length) console.log(`${parked.length} parked case(s) also pass (${PARKED.join(", ")}); not included in the game.`);
if (process.argv.includes("--check")) process.exit(0);

// Convert to the compact shape the game code reads.
const game = cases.map((c) => {
  const g = { id: c.id, r: ROUNDS.indexOf(c.round), sec: c.section, topic: c.topic, from: c.from,
    msg: c.message, q: c.question, type: c.type, why: c.explanation, tip: c.takeaway };
  if (c.type === "mcq") Object.assign(g, { opts: c.options, ans: c.answer });
  if (c.type === "num") Object.assign(g, { ans: c.answer, tol: c.tolerance });
  if (c.type === "je") Object.assign(g, { amt: c.amount, accts: c.accounts, dr: c.debit, cr: c.credit });
  return g;
});

const template = readFileSync(join(root, "web/template.html"), "utf8");
const marker = "/*__CASES__*/[]";
if (!template.includes(marker)) { console.error(`web/template.html is missing ${marker}`); process.exit(1); }
const json = JSON.stringify(game, null, 1).replace(/</g, "\\u003c");
mkdirSync(join(root, "dist"), { recursive: true });
writeFileSync(join(root, "dist/index.html"), template.replace(marker, json));
console.log("Wrote dist/index.html");
