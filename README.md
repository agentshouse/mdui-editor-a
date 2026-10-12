# Document editor A

A House App for semantic HTML articles with rich text, tables, source editing and export. Edits use native Room Drafts; Save explicitly queues the current draft.

## Build and publish

Use Node 24.21 or newer. Run `npm ci --ignore-scripts --no-audit --no-fund`, then `npm run verify` to run the complete local checks and build `dist/`. Configure `origin` as the intended House App Git remote, commit the reviewed source on `main`, then run `npm run publish`. Publication verifies the exact clean source and atomically pushes `main` plus a parentless built `release`; it never commits or resets work. Verify the admitted App revision after publication. Hosted acceptance is separate from local checks.

## Starter documents

`starter/` contains two unchanged licensed example documents at their existing Room paths. Both editor variants carry the same union schema and starter. A edits HTML articles; B edits block-tree articles. These are separate representations, not interoperable copies, and neither variant converts the other. No Room migration or binding changes are needed.

License files and source attribution are retained with the code and examples. Original example content and required legal notices can name their authors and sources.

The test gate verifies the exact seven application suites and runs each in a fresh process with unchanged per-test limits. Runner regressions reject missing suites, skipped assertions and false-success totals.

## Portable publisher safety

The publisher accepts credential-free HTTPS House App remotes on any host, including
`https://<host>/app/new.git` for creation. Choose only a host and App you are authorized
to publish to. Host portability does not authorize publication to another environment.
For initial creation, use `npm run publish -- --name "<display name>"`; `--name` is
optional and no default display name is invented. The helper reports only complete,
explicitly returned App/Git receipt URLs and never changes `origin`. After creation,
inspect the returned canonical App in House and set its actual Git URL as `origin`
before another publication. Never retry an uncertain creation blindly.

`npm run test:publisher` runs offline local-Git regression fixtures with mocked
push/remote transport; it installs no packages and does not contact House. These
checks are included in `npm run verify` before the existing App-specific gates.
Publication requires clean committed `main`, runs exactly that full verify gate,
pins the source SHA, and atomically pushes source `main` plus a parentless dist-only
`release`. It preserves the normal index and source branch, rejects unsafe origin
rewrites, index flags, metadata mismatches, and conflicting publisher/worktree locks.
It never commits source, resets work, or substitutes a build-only verification.

Failure diagnostics suppress arbitrary subprocess output to avoid leaking credentials.
Run `npm run verify` locally for full compiler/test output; never share credential
values or verbose HTTP traces. A reported creation receipt or advertised source SHA
does not prove release admission: inspect the known App's published revision in House.
After a failed or uncertain push, inspect that state before deciding whether to retry.


## House navigation

The outer App address identifies the open article as `/articles?room=<Room locator>&path=<document path>`.
Initial links wait for the Room, query, draft and completed-sync observations. A missing or foreign article is unavailable; a URL never creates or authorizes a document. Root opens the first available article with a history replacement.

Article choices use the existing House bridge. Back, Forward and reload restore the addressed article without saving or discarding its native Room draft. Each document's existing presentation mode remains in House presentation storage. Native drafts survive closing a source view or a new-article dialog. Query refresh and a previous article's Save completion cannot select a different article.
