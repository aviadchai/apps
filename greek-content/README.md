# Greek content pipeline

Build-time content generation for the Greek learning app.

**The app never calls an LLM at runtime.** Content is generated once here, reviewed
by a human, frozen as static JSON, and only then shipped.

```
generate  →  review  →  approve  →  ship
```

## Files

| File | What it is |
|------|------------|
| `generate-greek-content.js` | Node script. Asks the content-engine worker for each lesson, validates, dedups, sorts. Produces `greek-content.json` + `review-needed.json`. |
| `greek-content.json` | Generated raw content (all items). **A ~20-item sample is checked in so you can see the shape.** |
| `review-needed.json` | Items the validator flagged (missing fields / literal-translation smell / bad enum). Empty in the sample. |
| `review.html` | Human review UI. Load the JSON, keep/flag each card, export the approved set. |
| `greek-content.approved.json` | Output of the review step — **this is what ships.** (Not checked in; you create it.) |

## 1. Generate

Needs Node 18+ (uses global `fetch`).

```bash
node generate-greek-content.js
```

- Lessons live in the `CONFIG` array at the top of the script — edit `topic` /
  `level` / `count` freely (seeded with an A1/A2 set: greetings, everyday phrases,
  numbers, food, directions, shopping, small talk).
- Config via env vars:
  - `WORKER_URL` — the content-engine worker (defaults to the app's existing worker).
  - `MODEL` — the model the worker asks for (defaults to a strong build-time model).
- The script retries the worker with exponential backoff, regenerates a lesson once
  if the model returns unparseable JSON, and logs progress per lesson.
- It **only aggregates what the worker returns** — it never invents or hardcodes any
  Greek content itself.

### Validation

Each item must carry: `target`, `pronunciation`, `translation`, `literal_gloss`
(may be `null`), `register`, `frequency_rank`, `srs_bucket`, `mnemonic`, `example`,
`example_translation`.

Items are **flagged** into `review-needed.json` when a field is missing, an enum is
off (`register` / `frequency_rank`), or the natural `translation` is suspiciously close
to the `literal_gloss` (a literal-translation smell). Flagged items still appear in
`greek-content.json` — flagging is a heads-up for review, not a delete.

Items are deduplicated by `target` and ordered by `frequency_rank` (high → low).

## 2. Review

Open `review.html` and load `greek-content.json`.

- Served over http (e.g. `npx serve` in this folder) it auto-loads; opened directly
  from disk (`file://`) use the file picker shown at the top.
- Every card shows target, pronunciation, translation, literal gloss, register,
  mnemonic and example. Items with validation warnings are marked.
- Toggle each card **✓ שמור (keep)** or **⚑ סמן לתיקון (flag)**. Choices are saved to
  `localStorage`, so you can review over several sittings.

## 3. Approve & ship

In `review.html`, click **⬇ ייצוא המאושרים**. It downloads
`greek-content.approved.json` — every kept item, with internal `_*` bookkeeping
fields stripped. That file is the shippable content.

To ship: copy `greek-content.approved.json` into the app and load it as static data.
Regenerate only when you want to add or change lessons — repeat generate → review →
approve.
