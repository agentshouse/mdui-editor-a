# Local acceptance matrix

Donor anchors below are relative to upstream/src. Independent review found no unresolved P1 in its bounded review at 12:49 UTC. Browser/pixel acceptance remains pending; automated checks are not a substitute.

| Area | Retained donor anchor | Local status |
|---|---|---|
| Author controls | editor/toolbar/author/author.js 288–490 | Real toolbar, block/insert/more menus, semantics; actual-command tests |
| Keyboard | editor/toolbar/author/keymap.js 173–485 | Original list/section/table navigation and undo; PM and persisted empty-list tests |
| Table tools | editor/commands/table.js 372–920; plugins/tableTools.js | Original local tools and CSV; remote lookup disabled; adversarial popup escaping tested |
| Images | handlers.js 86+; nodeviews/imageResize.js | Original local insertion/resize; data raster files only, no remote loads |
| Source/Markdown | dialog.js 3533–3755 | Original-shaped source panel/conversion; revision guards, untouched rich roundtrip |
| Slash/metadata | editor/slashmenu | Original menus/forms/local metadata, no inbox delivery |
| Notes/requirements | toolbar/author/handlers.js 186+ | Local notes/manual footnotes, original rendering and requirement preview; no remote lookup/publication |
| Structure/anchors | plugins/documentStructure, documentAnchors, fragmentLinks | Original plugins and helpers mounted |
| Document types | editor/editor.js and ui/templates | All five local document types, native controls; no transmission/full-screen Shower |
| Menu/export/theme | ui/menu.js 85–146 | Donor right menu/tab/grouping and theme; semantic HTML export, no bundled styles/fonts in export; print not enabled |

Isolation regressions cover Source A→B stale Apply, source/rich content races, nonblocking local reload/archive and Save barriers, returned drafts, Room reach loss, malformed query recovery, widget lock and malicious table settings. Export source guidance is explicit. No actual Agent turns run.

## Initial synchronization readiness

Master1400: both rooms and sync-status observations redraw the actual controller. Before lastCompleted is non-null the article area shows Loading without a binding error. A completed-sync missing/ambiguous binding clears as soon as exactly one Room arrives; cached query data opens regardless of observation order. Later reach changes preserve local drafts and article/Source content for export. Regression tests exercise both startup orders, reset, completed ambiguity, recovery without a new query, and draft-content preservation. Hosted acceptance is separate.

## Master1415/1420/1425 local-first revision

Every article input is an exact-CAS browser-local Room Draft. Article navigation is immediate and never reloads the page, queries a provider, or prompts about unsaved changes. Raw HTML Source and raw Markdown use the article's own html field, unchanged as typed; Save sanitizes the document, while previews remain safe. Incomplete New titles are article creation drafts. Runtime presentation stores editor mode only. Half-typed popup fields may be lost on reload, as Master1425 explicitly accepts. The temporary buffer schema was removed; no buffer or conflict-recovery path/type exists.

Explicit Save queues only the business document. Pending typing survives Save barriers. Same-browser overlap rereads and merges the shared draft with later input and disjoint fields; other views redraw. Original first field bases and provider-returned conflict metadata remain intact for normal cross-device Save handling. Runtime observation races, reload hydration, rapid coalesced typing, local storage failures, real native form controls and title/body isolation are regression-tested. All code and fonts load initially; images are local and lazy. Hosted acceptance remains separate.

## Provider halt boundary correction

The installed Runtime contract explicitly permits local Room Draft typing and Save during Provider write-halt; queue delivery waits. The inherited controller halt gate and misleading read-only warning were removed. Real-controller regressions first failed on both disabled local editing and an overwritten connection-refusal alert, then passed after the correction. Genuine connection refusals remain blocking and visible across service-mode changes. No remote Action was enabled and no hosted acceptance is implied.
