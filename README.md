# Unicorn: Seed to IPO

A CPA exam study game. You are the first finance hire at Kestrel AI, a fictional startup, and take it from seed round to IPO by solving cases from the three core sections: FAR, AUD and REG.

## Play
Open `dist/index.html` in a browser. It is one self-contained file.

## Layout
- `content/cases/far.json`, `aud.json`, `reg.json` – the cases. **Edit these to add or fix questions.**
- `web/template.html` – the game screens and logic
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
2. ~~Move cases out of the HTML into `content/cases/*.json`~~ Done. Next: map each case to the AICPA blueprints
3. Grow to 300–400 cases, add task-based simulations
4. CPA review of every case, with a "current as of" date on REG content
5. Mobile app with Expo, saved progress with Supabase, App Store release

Kestrel AI and its people are fictional. Content is for study and is not tax or accounting advice.
