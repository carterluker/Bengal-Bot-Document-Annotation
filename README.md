# BengalBot Interactive Document Annotation (Prototype)

BengalBot is ISU's planned AI writing-feedback tool, built into Canvas, giving every student equal access to feedback that knows their course and assignment, with ISU data staying on ISU servers.

This repository is a **prototype of one proposed feature: interactive document annotation.** Students often can't tell *where* in their writing AI feedback applies. This demo shows the idea:

1. Upload a draft.
2. See a preview with problem areas highlighted.
3. Hover or click a highlight for details, or ask a follow-up question about it.

## Running the demo

No install or build step. Open `index.html` in any modern browser.

## Using it

1. **Upload:** Enter a course and assignment, then drop in a `.txt`/`.md` file, paste text, or click **Use sample essay**.
2. **Review:** Click **Get feedback**. Highlights appear in the document, color-coded as Clarity, Evidence, Style, or Structure.
   - Hover a highlight for a quick preview in the side panel.
   - Click it (or an item in the list) for the explanation and a suggested fix.
   - Use **Prev/Next** to step through feedback, and the category chips to filter.
3. **Ask:** In the detail panel, type a question or use a preset ("Show me an example", etc.).

## What is real and what is simulated

This is a front-end demo only. **There is no AI model.**

- Analysis (`analyze()` in `app.js`) uses simple rules: filler words, vague nouns, unsourced claims, passive voice, very long sentences, "In this essay I will…" openers, and thin paragraphs.
- Follow-up replies (`reply()` in `app.js`) are canned, keyed on the highlight's category and the question's wording.
- Everything runs in the browser; no data is sent anywhere.

To make it real, replace `analyze()` with a call to a BengalBot model that returns `{start, end, cat, title, body, fix}` ranges, and `reply()` with a model call that includes the highlighted text, course, and assignment.

## Files

| File | Purpose |
|------|---------|
| `index.html` | Page structure for the upload, loading, and review screens |
| `styles.css` | Layout and highlight colors |
| `app.js` | Analysis rules, rendering, interaction, simulated chat |
| `initial_prompt.md` | Original project brief |

## Ideas for next steps

- Real model integration with assignment rubric as context
- Canvas (LTI) integration and `.docx`/PDF upload
- Accept/dismiss feedback and track revisions between drafts
- Instructor view to tune what feedback is given
