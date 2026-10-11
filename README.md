# Document editor A

A House App for semantic HTML articles with rich text, tables, source editing and export. Edits use native Room Drafts; Save explicitly queues the current draft.

## Build and publish

Use Node 24.21 or newer. Run `npm ci --ignore-scripts --no-audit --no-fund`, then `npm run verify` to run the complete local checks and build `dist/`. Configure `origin` as the intended House App Git remote, commit the reviewed source on `main`, then run `npm run publish`. Publication verifies the exact clean source and atomically pushes `main` plus a parentless built `release`; it never commits or resets work. Verify the admitted App revision after publication. Hosted acceptance is separate from local checks.

## Starter documents

`starter/` contains two unchanged licensed example documents at their existing Room paths. Both editor variants carry the same union schema and starter. A edits HTML articles; B edits block-tree articles. These are separate representations, not interoperable copies, and neither variant converts the other. No Room migration or binding changes are needed.

License files and source attribution are retained with the code and examples. Original example content and required legal notices can name their authors and sources.

The test gate verifies the exact seven application suites and runs each in a fresh process with unchanged per-test limits. Runner regressions reject missing suites, skipped assertions and false-success totals.
