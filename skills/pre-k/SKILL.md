---
name: pre-k
description: Use when the user wants something explained as simply as possible OR wants a visual explainer of a code change. Typed triggers include "pre-k", "pre-K skill", and "prek"; voice triggers include "kindergarten", "kindergartner", and "kindergartener skill"; also "ELI5", "explain like I'm five", "explain like I'm two", and "explain it simply". BOTH names mean THIS skill. For code changes/diffs/PRs (or when the user says "visual", "show me", "explain this diff"), use the Visual Explainer mode to produce a self-contained HTML page.
---

# Pre-K (formerly Kindergartner)

Two modes. Pick by subject: **concepts get the three levels; code changes get
the visual explainer** (or both, when a concept explanation would benefit from
a picture). If the user says "visual" / "show me" / points at a diff, branch,
or PR - it's the Visual Explainer.

## Mode 1 - The Three Levels (concepts, plans, results)

Explain the topic at hand (the thing just discussed, or whatever the user
names) at THREE levels, in this exact order, each clearly labeled. Apply it to
EACH item if there are several.

### 🧒 Explain like I'm 5
2–5 short sentences. Everyday words, one concrete picture or analogy (toys,
snacks, chores, a piggy bank). No jargon. A curious 5-year-old should fully
get it.

### 👶 Explain like I'm 2
1–3 tiny sentences. The absolute core, in the simplest possible words -
concrete objects only. If a word would need explaining, it's too big; swap it.

### 📝 Layman summary
3–4 plain-adult-English sentences (no jargon): what it is, why it matters, and
the one thing to remember.

## Mode 2 - The Visual Explainer (code changes, diffs, branches, PRs)

*Adapted from Geoffrey Litt's explain-diff.* Produce a self-contained HTML
page. Publish it with the host's artifact facility when one exists; otherwise
save it in the repository and report the path. Use a 🎨 favicon and a concise,
stable title. The page has four sections, in order:

1. **Background** - what the existing system does, written two ways on the
   same page: a pre-k paragraph (the ELI5 voice above) AND the narrow
   technical context someone needs for THIS change. Assume the reader has
   never seen the codebase.
2. **Intuition** - the essence, not the full details. Walk one **toy example**
   (tiny concrete data: "the user asks to be notified when a build fails") through
   before-and-after behavior. Use **simple HTML/CSS diagrams** - boxes,
   arrows, simplified UI mockups, data-flow strips - never ASCII art. Show
   example data flowing through the system.
3. **The Code** - a high-level walkthrough of the actual changes, grouped
   logically (not file-by-file). Short excerpts in `<pre>` blocks with
   `white-space: pre-wrap`, each with a one-sentence plain-English caption.
   Use callouts (tinted boxes) for key concepts, definitions, and edge cases.
4. **Quiz** - five multiple-choice questions of medium difficulty testing
   substantive understanding (behavior and consequences, not trivia).
   **All answer options must be similar length and equally plausible** - the
   correct answer must NOT be identifiable as the longest/most detailed
   option. Answers + one-line explanations at the bottom, hidden behind a
   `<details>` toggle.

Rules for the page:
- Plain, warm, clear prose - the pre-k spirit at adult reading level; jargon
  only when the code itself forces it, and then defined in a callout.
- Self-contained (inline CSS, no external assets), light/dark theme aware.
- Faithful: diagrams and toy examples must match what the code actually does
  - read the diff before drawing. If a simplification would mislead, pick a
  different simplification.
- End with a "what to poke at" line: the one file/behavior the reader should
  look at next.

## Rules (both modes)
- No unspelled acronyms, no hedging. (Mode 1: no code at all.)
- Analogies must be FAITHFUL - never distort the real thing just to make it
  cute. If the simple version would mislead, pick a better analogy.
- The goal is INNOVATION, not just comprehension: after reading, the user
  should be able to build on the idea.
- Keep it warm and fun. This is a teaching moment, not a summary dump.
