# Contributing to Lenny

Lenny accepts changes that improve the path from intent to a verified
merge-ready implementation while preserving its boundary: config the coding
agent reads, not a resident runtime.

## Before opening a pull request

1. Work on a branch.
2. Keep personal councils, private paths and company-specific policy out of the
   public core.
3. Add a test for every deterministic behavior change.
4. Run `npm run check`.
5. Explain the user-visible outcome, evidence and residual limitation.

Skills are Markdown with YAML frontmatter. Support scripts require Node.js 20+
and must remain dependency-free unless a dependency is proven necessary.

Lenny never auto-merges. A human reviews and merges every pull request.
