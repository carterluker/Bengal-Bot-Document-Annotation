# BengalBot Interactive Document Annotation (Prototype)

BengalBot is ISU's planned AI writing-feedback tool, built into Canvas, giving every student equal access to feedback that knows their course and assignment, with ISU data staying on ISU servers.

This repository is a **prototype of one proposed feature: interactive document annotation.** Students often can't tell *where* in their writing AI feedback applies. This demo shows the idea:

1. Upload a draft.
2. See a preview with problem areas highlighted.
3. Hover or click a highlight for details, or ask a follow-up question about it.

## Running the demo

Requires Node 18+ and an Anthropic API key.

```
npm install
copy config.example.json config.json     (macOS/Linux: cp)
# edit config.json and set "apiKey"
npm start
```

Then open http://localhost:3000.

### Configuration

All settings live in `config.json`, which is gitignored. Only `config.example.json` (placeholder values) is committed.

| Key | Meaning |
|-----|---------|
| `apiKey` | Your Anthropic API key (required) |
| `model` | Claude model ID, default `claude-haiku-5-5` |
| `port` | Local port, default `3000` |

The key is read only by `server.js`; it is never sent to the browser.

## Using it

1. **Upload:** Enter a course and assignment, then drop in a `.txt`/`.md` file, paste text, or click **Use sample essay**. Click **Get feedback**.
2. **Review and ask (one page):** The draft appears with color-coded highlights (Clarity, Evidence, Style, Structure). The full feedback list sits beside it.
   - Hover a highlight for a quick preview.
   - Click a highlight (or a list item) to open its explanation, suggested fix, and a follow-up chat for that passage.
   - Use **← Back to all feedback** (or press Esc) to close the detail and return to the full list. Prev/Next steps through items, and category chips filter them.

## How it works

- `server.js` serves the page and exposes two endpoints that call the Claude API with the official SDK:
  - `/api/analyze`: sends the draft, course, and assignment; Claude returns a title and annotations as structured JSON (exact quote, category, title, explanation, suggestion).
  - `/api/ask`: answers a follow-up about one highlight, with the draft and earlier chat as context.
- `app.js` locates each returned quote in the draft to place highlights. Quotes that can't be found verbatim are dropped.
- The draft and assignment are treated as untrusted data in the prompts.

## Notes and limits

- Drafts are limited to 30,000 characters.
- Drafts are sent to the Claude API. A production BengalBot would run on ISU-controlled infrastructure to meet the data-sovereignty goal.
- This prototype has no accounts, storage, or rate limiting. It binds to localhost only.

## Files

| File | Purpose |
|------|---------|
| `index.html`, `styles.css`, `app.js` | Front end |
| `server.js` | Static server and Claude API proxy |
| `config.example.json` | Template for the private `config.json` |
| `initial_prompt.md` | Original project brief |

## Ideas for next steps

- Include the assignment rubric as context
- Canvas (LTI) integration and `.docx`/PDF upload
- Accept/dismiss feedback and track revisions between drafts
- Instructor view to tune what feedback is given
