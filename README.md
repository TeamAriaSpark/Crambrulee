# 🍮 cram brûlée

**The study app with a crispy top.** A play on crème brûlée — because a great cram session, like a great custard, is all about applying the right heat at the right time.

Our special sauce is science-backed: **active recall beats rereading**. Retrieval practice — forcing your brain to reach for an answer — builds far stronger memories than passively going over notes. cram brûlée bakes that into every step.

## How it works

1. **Toss in your ingredients** — upload or paste your study materials (.txt / .md).
2. **Set the timer** — tell us how long until your test (usually under 72 hours).
3. **We cook up your cram plan** — a timeline optimized for your window, with practice tests as milestones.
4. **Follow the recipe** — simple repeating cycles of:
   - 🍳 **Study** — AI summaries and cheat sheets covering the most important material
   - 🧠 **Active recall** — flashcards with notes closed
   - 🔥 **Practice tests** — simulated test conditions
   - ☕ **Strategic breaks**, 💤 **real sleep**, and 🫐 **brain nutrients** folded in
5. **Refry** — after each practice test, your summaries, flashcards, and next test are re-cooked with extra heat on your weak topics. Earlier batches stay on the shelf — flip back to any previous version whenever you like.

## Running it

```bash
npm install
npm run dev      # local dev server
npm run build    # production build in dist/
```

Everything runs client-side; your notes never leave the browser (progress is saved to localStorage).

## Stack

- [Vite](https://vitejs.dev/) + [React](https://react.dev/)
- No backend — the content engine (summaries, flashcards, test generation, refrying) lives in `src/lib/engine.js`, and the schedule planner in `src/lib/planner.js`.
