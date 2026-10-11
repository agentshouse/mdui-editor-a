# Document editor for House

A private dokieli document/article editor port. Donor: [dokieli/dokieli](https://github.com/dokieli/dokieli), exact revision `7deba503d5a5f5ea239aafaa630b705311453e81`, Apache-2.0. The complete source snapshot is in `upstream/`; all donor media are retained. Real source articles from `docs.html` and `index.html` are reused under CC BY 4.0, with attribution and source revision retained. No user identity or generated content is fabricated.

## Run and check

Use Node 24.21+ and pinned lockfile dependencies. Install with `npm ci --ignore-scripts --no-audit --no-fund`. Run `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run release:check`, and `npm run licenses:check`. Tests use the actual ProseMirror editor and donor commands; only the controller integration tests mock the House boundary. Production never uses those mocks or an in-memory runtime.

House must supply `connectHouseBridge().runtime`. There is one writable `articles` slot with the original `document_article` schema. Missing/ambiguous bindings fail closed. App and Room schemas must be byte-identical. The App stores semantic article HTML in typed frontmatter; no browser localStorage, standalone IndexedDB or provider HTTP backend is used.

## Persistence and isolation

Every typed article change immediately queues a browser-local runtime Room Draft, without a server request or navigation wait. Rich HTML, raw HTML Source, raw Markdown and incomplete New titles use the article's own fields. Raw source remains exactly as typed until Save sanitizes the document; the renderer never executes it. Sessions survive client-side article switches; a remount hydrates actual runtime drafts before opening articles. The runtime presentation surface stores only editor mode, no content or form buffers. Original native input/textarea views now emit each input, including questionnaire responses in read mode. There is no unsaved-changes prompt or before-close prompt. Per Master1425, half-typed popup controls may be lost on reload and are not written to a Room schema. No buffer/recovery paths or types exist.

Writes use the exact observed draft revision, retain all existing parts and original field bases, and safely coalesce adjacent pending inputs without crossing a Save barrier. Explicit Save commits only the exact latest prior article draft using runtime.save, which validates and queues locally; newer typing remains a new draft. Returned refusal/conflict metadata is preserved. Same-browser overlap rereads the shared draft, merges disjoint fields and reapplies later typing using exact CAS; other views redraw from it. Provider conflicts retain their original field bases and refusal metadata. A local storage failure remains a real error; there are no recovery-copy paths or automatic draft discards. Archive is reversible. Reach loss preserves local drafts and the open editor for export. Source Apply still refuses stale rich-content snapshots; closing Source keeps raw content in the article draft. Export renders safe current article content; raw source remains available in Source. No Agent is selected or executed.

All application code is in the initial bundle. Article navigation and Reload use cached local query/session state, never whole-page navigation, provider requests or post-start loading spinners. Initial readiness watches both rooms and sync-status and waits for lastCompleted before diagnosing a missing binding.

Provider write-halt does not disable local typing or explicit Save: the runtime admits the Change Batch locally and holds delivery until the Provider reopens. Actual access, connection refusal and storage-loss guards remain. This App exposes no immediate remote Actions.

## Local donor features

- Actual author toolbar, selection formatting, block/insert/more menus, semantics, list/section/table keymaps and undo/redo
- Actual table tools, CSV import, add/remove/move/sort rows/columns, captions and keyboard navigation; manual table semantics
- Local raster-image insertion and donor resize node view
- HTML Source apply/cancel and Markdown conversion with warning and exact unchanged rich-content round-trip
- Original slash menu: tables, image, TOC, language, license, status, resource type, test suite, in-reply-to and question metadata
- Local embedded notes/manual citation footnotes, backlinks and requirement semantics with original preview
- Document structure, anchors and fragment suggestions
- Article, specification, CV, slideshow and questionnaire templates, with local native editing widgets
- Original right-side grouped Actions/Tools/Settings menu, theme controls, reading mode and HTML export

## Deliberate boundaries and acceptance

External Solid/OIDC/Gitforge/ActivityPub/Yjs transports, social publication, remote vocabulary/citation lookup, notifications, remote media, authentication, questionnaire delivery and live cursors are removed. No plausible fake results or online/presence claims replace them. Table remote lookup settings are explicitly disabled. Author attribution is source attribution only; there is no current-member API or ownership claim.

The original full-screen Shower runtime is not started because it replaces top-level body/hash state; local slide content, ordering and navigation are retained. Printing is not enabled or claimed. Export produces standalone semantic article HTML, without separately bundled app styles/fonts. These are disclosed in the App and tracked in Porting. Hosted browser acceptance has not been claimed: the installed browser release is still pinned to release 2; Master confirms activation is a House defect being fixed. Published-source checks do not substitute for hosted acceptance.

Builds must keep `app.json`/`schema.yaml` at release root, use only local assets, contain no inline executable scripts, and remain within 20 MiB/2000 files. `main` contains source; `release` is one parentless built tree. Full source history stays local; first transport is depth-one.
