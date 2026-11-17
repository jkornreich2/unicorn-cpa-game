# Unicorn: Seed to IPO

A CPA exam study game. You are the first finance hire at Kestrel AI, a fictional startup, and take it from seed round to IPO by solving cases from the three core sections: FAR, AUD and REG.

## Play
Open `dist/index.html` in a browser. It is one self-contained file.

## Layout
- `content/cases/far.json`, `aud.json`, `reg.json` – the cases. **Edit these to add or fix questions.**
- `content/cases/tcp.json`, `bar.json` – discipline-section cases (TCP, BAR), parked: checked but not in the core game yet
- `content/outline/` – the AICPA blueprint content areas and topics for each section. Every case's `studyArea` must match one ("Area III · Revenue Recognition"), and REVIEW.md shows which topics still have no cases
- `web/template.html` – the game screens and logic
- `web/models.js` – the garage and loft buildings, rebuilt in code from the SketchUp designs (merged meshes)
- `web/hq.js` – the 3D headquarters (Three.js r128 from cdnjs): one floor per answered case
- `scripts/build.mjs` – checks every case, then builds `dist/index.html`
- `REVIEW.md` – every case with its answer, for CPA review (generated)
- `prototypes/` – earlier experiments, including Lemonade Ledger for beginners

## Working on cases
Requires Node.js 18 or later.

    npm run check    # check the case files for mistakes
    npm run build    # build the game and refresh REVIEW.md

Each case has a `review` block. When a CPA signs off, fill in `reviewedBy` and `currentAsOf`.
Case types: `mcq` (multiple choice, `answer` is the position of the right option starting at 0),
`num` (a dollar amount, with `tolerance`), and `je` (a journal entry with `debit` and `credit`).

## Roadmap
1. Playtest chapter one (12 cases) and log feedback as GitHub issues
2. ~~Move cases into content files and map them to the AICPA blueprints~~ Done
3. Grow to 300–400 cases, add task-based simulations
4. CPA review of every case, with a "current as of" date on REG content
5. Mobile app with Expo, saved progress with Supabase, App Store release

Kestrel AI and its people are fictional. Content is for study and is not tax or accounting advice.
