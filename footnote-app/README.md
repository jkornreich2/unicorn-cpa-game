# Footnote

Daily rarity trivia for CPA candidates. Seven prompts, 25 seconds each; rarer correct answers score more.
Install it from the browser: iPhone Share → Add to Home Screen; Android menu → Install app.

Plain static site for GitHub Pages: `index.html` (the whole game), `manifest.webmanifest`, `sw.js` (offline), `icons/`.

## Editing the questions

The question library lives in plain-text files, one per section: `library/far.txt`, `library/aud.txt` and `library/reg.txt`. Each prompt is a `## id | SECTION | Prompt` line followed by one answer per line:

```
rarity | Answer as shown | alternate spellings; separated; by semicolons | optional note
```

Rarity runs from 1 (on the face) to 6 (footnote). Mark exactly one answer per prompt as the gem with `*` after its rarity, like `6*`.

After editing, run `python3 library/build.py`. It checks every prompt and writes the questions into `index.html`. The checks are: at least 10 answers, one gem, a rarity-1 answer, and no alias shared by two answers. It also refreshes `library/REVIEW.md`, a table view for proofreading.

## Reviewing questions

The Footnote Question Review page (a private claude.ai artifact) lists every prompt for review. You can edit rarity, gems, answers, alternate spellings and notes there, test answers with the game's matcher, mark prompts reviewed, flag them for Claude, delete them or add new ones. Edits save automatically to the page's database.

To publish the review, ask Claude to "apply my review". Claude then does the following:

1. Exports the saved edits to a JSON file.
2. Runs `python3 library/apply_review.py edits.json`, which rewrites the library files and lists flagged prompts.
3. Runs `python3 library/build.py` to validate and rebuild the game, then pushes the result.
4. Refreshes the review page's copy of the library with `python3 library/export_review.py <path>/library.json`, and marks the applied edits so the review progress stays.
