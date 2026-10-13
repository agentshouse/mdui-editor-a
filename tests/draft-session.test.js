import {describe, it, expect, vi} from 'vitest';
import {DraftSession} from '../src/house/draft-session';
// Use the installed runtime's real base-retention/replacement implementation.
import {held} from '../node_modules/@agentshouse/mdruntime/dist/room-draft.js';

const opened = {room: 'r_articles', path: 'articles/one.md', fields: {title: 'Original', html: '<p>Original</p>', archived: false}};
const clone = value => structuredClone(value);
function draft(parts, extra = {}) {
 return {room: opened.room, path: opened.path, revision: 'existing-1', parts, returned: null, changedUnderneath: {}, ...extra};
}
function deferred() {
 let resolve, reject;
 const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
 return {promise, resolve, reject};
}
function runtime(initial = null) {
 const state = new Map(initial ? [[initial.path, clone(initial)]] : []);
 let sequence = 0;
 const md = {
  state,
  emit: () => {},
  beforeWrite: null,
  beforeSave: null,
  refuse: null,
  roomDraft: {
   read: vi.fn(async (_room, path) => clone(state.get(path) ?? null)),
   write: vi.fn(async (room, path, revision, parts) => {
    if (md.beforeWrite) await md.beforeWrite();
    const current = state.get(path);
    if ((current?.revision ?? null) !== revision) return {outcome: 'stale', current: clone(current ?? null)};
    const next = {room, path, revision: `written-${++sequence}`, parts: held(current?.parts, parts), returned: clone(current?.returned ?? null), changedUnderneath: clone(current?.changedUnderneath ?? {})};
    state.set(path, next);
    md.emit(clone(next));
    return {outcome: 'written', roomDraft: clone(next)};
   }),
   discard: vi.fn(),
  },
  save: vi.fn(async (_room, named) => {
   if (md.beforeSave) await md.beforeSave();
   const [{path, revision}] = named;
   if (state.get(path)?.revision !== revision) return {outcome: 'refused', code: 'stale', retryable: false, file: path};
   if (md.refuse) return clone(md.refuse);
   state.delete(path);
   md.emit(null);
   return {outcome: 'saved', identifier: `save-${sequence}`};
  }),
  query: vi.fn(),
  rooms: vi.fn(),
  call: vi.fn(),
 };
 return md;
}

describe('document-local Room Draft session', () => {
 it('captures input synchronously and stores each edit with exact CAS and original bases', async () => {
  const md = runtime(), session = new DraftSession(md, opened);
  const patch = {html: '<p>First</p>'};
  session.enqueue(patch);
  patch.html = 'caller changed its object';
  expect(session.fields.html).toBe('<p>First</p>');
  expect(session.pending).toBe(true);
  await session.flush();
  session.enqueue({title: 'Second'});
  await session.flush();
  session.enqueue({html: '<p>Third</p>', edit_source: 'raw <unfinished'});
  await session.flush();
  expect(md.roomDraft.write.mock.calls.map(call => call[2])).toEqual([null, 'written-1', 'written-2']);
  expect(md.roomDraft.write.mock.calls[2][3]).toEqual({fields: {
   html: {value: '<p>Third</p>', base: {value: '<p>Original</p>'}},
   title: {value: 'Second', base: {value: 'Original'}},
   edit_source: {value: 'raw <unfinished', base: null},
  }});
  expect(session.pending).toBe(false);
  expect(session.hasChanges).toBe(true);
  expect(md.save).not.toHaveBeenCalled();
  expect(md.rooms).not.toHaveBeenCalled();
  expect(md.query).not.toHaveBeenCalled();
  expect(md.call).not.toHaveBeenCalled();
 });

 it('keeps every rapid edit while a prior local write is pending', async () => {
  const gate = deferred(), md = runtime(), session = new DraftSession(md, opened);
  md.beforeWrite = () => gate.promise;
  session.enqueue({html: '1'});
  await Promise.resolve();
  session.enqueue({edit_source: '<raw kept', edit_forms: '{"note":"kept"}'});
  for (let i = 2; i <= 30; i++) session.enqueue({html: String(i), title: `Title ${i}`});
  expect(md.roomDraft.write).toHaveBeenCalledTimes(1);
  expect(session.fields).toMatchObject({html: '30', title: 'Title 30'});
  gate.resolve();
  await session.flush();
  expect(md.roomDraft.write).toHaveBeenCalledTimes(2);
  expect(md.roomDraft.write.mock.calls[1][3].fields.title.value).toBe('Title 30');
  expect(md.roomDraft.write.mock.calls[1][3].fields.edit_source.value).toBe('<raw kept');
  expect(md.roomDraft.write.mock.calls[1][3].fields.edit_forms.value).toBe('{"note":"kept"}');
  expect(md.state.get(opened.path).parts.fields.html).toEqual({value: '30', base: {value: opened.fields.html}});
 });

 it('outlives instant navigation to another article without losing either queue', async () => {
  const gate = deferred(), md = runtime();
  md.beforeWrite = () => gate.promise;
  const sessions = new Map();
  const a = new DraftSession(md, opened);
  const b = new DraftSession(md, {...opened, path: 'articles/two.md'});
  sessions.set(a.path, a); sessions.set(b.path, b);
  let selected = a;
  selected.enqueue({html: 'First article edit'});
  selected = b;
  selected.enqueue({html: 'Second article edit'});
  expect(selected.path).toBe('articles/two.md');
  gate.resolve();
  await Promise.all([...sessions.values()].map(session => session.flush()));
  expect(md.state.get(a.path).parts.fields.html.value).toBe('First article edit');
  expect(md.state.get(b.path).parts.fields.html.value).toBe('Second article edit');
  expect(sessions.get(a.path).fields.html).toBe('First article edit');
 });

 it('adopts the exact restart snapshot including raw editing buffers and bases', async () => {
  const stored = draft({fields: {html: {value: 'Recovered', base: {value: 'Old head'}}, edit_mode: {value: 'source', base: null}, edit_source: {value: '<raw', base: null}}});
  const md = runtime(stored), session = new DraftSession(md, opened, stored);
  expect(session.fields).toMatchObject({html: 'Recovered', edit_mode: 'source', edit_source: '<raw'});
  session.enqueue({html: 'Recovered and edited', edit_source: '<raw and edited'});
  await session.flush();
  expect(md.roomDraft.write.mock.calls[0][2]).toBe('existing-1');
  expect(session.draft.parts.fields.html.base).toEqual({value: 'Old head'});
  expect(session.draft.parts.fields.edit_source.base).toBe(null);
 });

 it('retains an explicit missing-field base even when the opened head now has that field', async () => {
  const stored = draft({fields: {title: {value: 'Draft title', base: null}}});
  const md = runtime(stored), session = new DraftSession(md, opened, stored);
  session.enqueue({title: 'New title'});
  await session.flush();
  expect(md.roomDraft.write.mock.calls[0][3].fields.title.base).toBe(null);
 });

 it('preserves every unknown held part when replacing the runtime draft', async () => {
  const stored = draft({fields: {author: {value: 'Ada', base: {value: ''}}}, sections: {Notes: {value: 'Retain me', base: 'Before'}}, preamble: {value: 'Intro', base: ''}, move: {to: 'articles/renamed.md', base: 'full original markdown'}});
  const md = runtime(stored), session = new DraftSession(md, opened, stored);
  session.enqueue({html: 'New article'});
  await session.flush();
  expect(session.draft.parts).toMatchObject(stored.parts);
  expect(session.draft.parts.fields.html.value).toBe('New article');
 });

 it('rereads shared overlap and reapplies latest input while preserving disjoint fields and bases', async () => {
  const gate = deferred(), md = runtime(), errors = vi.fn();
  md.beforeWrite = () => gate.promise;
  const session = new DraftSession(md, opened, null, {onError: errors});
  session.enqueue({html: 'My first input'});
  await Promise.resolve();
  const shared = draft({fields: {html: {value: 'Other tab', base: {value: opened.fields.html}}, title: {value: 'Other title', base: {value: 'Original'}}}}, {revision: 'shared-newer'});
  md.state.set(opened.path, shared);
  session.enqueue({html: 'My newest input', edit_markdown: '# Latest'});
  gate.resolve();
  await session.flush();
  expect(session.fields).toMatchObject({html: 'My newest input', title: 'Other title', edit_markdown: '# Latest'});
  expect(md.state.get(opened.path).parts.fields.html).toEqual({value: 'My newest input', base: {value: opened.fields.html}});
  expect(md.state.get(opened.path).parts.fields.title).toEqual(shared.parts.fields.title);
  expect(md.roomDraft.read).toHaveBeenCalled();
  expect(md.roomDraft.write.mock.calls.map(call => call[2])).toEqual([null, 'shared-newer', 'written-1']);
  expect(errors).not.toHaveBeenCalled();
  expect(md.roomDraft.discard).not.toHaveBeenCalled();
 });

 it('reports local durability failures and retains new input without an unhandled rejection', async () => {
  const md = runtime(), errors = vi.fn();
  md.roomDraft.write.mockRejectedValue(new Error('disk full'));
  const session = new DraftSession(md, opened, null, {onError: errors});
  session.enqueue({html: 'Still here'});
  await expect(session.flush()).rejects.toMatchObject({code: 'write-failed'});
  session.enqueue({title: 'Also here'});
  await expect(session.flush()).rejects.toThrow('local draft');
  expect(session.fields).toMatchObject({html: 'Still here', title: 'Also here'});
  expect(errors).toHaveBeenCalledTimes(1);
  expect(md.roomDraft.write).toHaveBeenCalledTimes(1);
 });

 it.each(['conflicted', 'rejected', 'expired', 'withdrawn'])('continues local editing without erasing a returned %s refusal or conflict bases', async kind => {
  const returned = {kind, ...(kind === 'conflicted' || kind === 'rejected' ? {code: 'provider-rule', fields: {reason: 'changed'}} : {})};
  const stored = draft({fields: {html: {value: 'Returned text', base: {value: 'Original base'}}}}, {returned, changedUnderneath: {fields: {html: {value: 'Changed head'}}}});
  const md = runtime(stored), session = new DraftSession(md, opened, stored);
  session.enqueue({html: 'Continue returned text'});
  await session.flush();
  expect(session.draft.returned).toEqual(returned);
  expect(session.draft.changedUnderneath).toEqual(stored.changedUnderneath);
  expect(session.draft.parts.fields.html.base).toEqual({value: 'Original base'});
  expect(md.save).not.toHaveBeenCalled();
  expect(md.roomDraft.discard).not.toHaveBeenCalled();
 });

 it('refuses incompatible whole-markdown edits while retaining both versions', async () => {
  const stored = draft({markdown: {value: 'Whole draft', base: 'Whole base'}});
  const md = runtime(stored), session = new DraftSession(md, opened, stored);
  session.enqueue({html: 'New typed HTML'});
  await expect(session.flush()).rejects.toMatchObject({code: 'unsupported-draft'});
  expect(session.draft).toEqual(stored);
  expect(session.fields.html).toBe('New typed HTML');
  expect(md.roomDraft.write).not.toHaveBeenCalled();
 });

 it('saves only the latest prior local revision, without querying or waiting for the provider', async () => {
  const md = runtime(), session = new DraftSession(md, opened);
  session.enqueue({html: 'One'});
  await session.flush();
  session.enqueue({title: 'Two'});
  expect(await session.save()).toEqual({outcome: 'saved', identifier: 'save-2'});
  expect(md.save).toHaveBeenCalledWith(opened.room, [{path: opened.path, revision: 'written-2'}]);
  expect(session.hasChanges).toBe(false);
  expect(session.draft).toBe(null);
  expect(session.fields).toMatchObject({html: 'One', title: 'Two'});
  expect(md.query).not.toHaveBeenCalled();
  expect(md.call).not.toHaveBeenCalled();
 });

 it('preserves newer typing during a pending save and gives it bases from only the saved version', async () => {
  const gate = deferred(), md = runtime(), session = new DraftSession(md, opened);
  md.beforeSave = () => gate.promise;
  session.enqueue({html: 'Saved text', title: 'Saved title'});
  await session.flush();
  const saving = session.save();
  await Promise.resolve();
  expect(md.save).toHaveBeenCalledTimes(1);
  session.enqueue({html: 'Newer text'});
  session.enqueue({edit_source: '<unfinished', title: 'Newest title'});
  expect(session.fields.html).toBe('Newer text');
  expect(md.roomDraft.write).toHaveBeenCalledTimes(1);
  gate.resolve();
  await saving;
  await session.flush();
  expect(session.fields).toMatchObject({html: 'Newer text', title: 'Newest title', edit_source: '<unfinished'});
  expect(md.roomDraft.write.mock.calls[1][2]).toBe(null);
  expect(session.draft.parts.fields).toEqual({html: {value: 'Newer text', base: {value: 'Saved text'}}, title: {value: 'Newest title', base: {value: 'Saved title'}}, edit_source: {value: '<unfinished', base: null}});
  expect(session.hasChanges).toBe(true);
 });

 it('serializes consecutive save barriers and never clears edits after the later barrier', async () => {
  const md = runtime(), session = new DraftSession(md, opened);
  session.enqueue({html: 'First'});
  const first = session.save();
  session.enqueue({html: 'Second'});
  const second = session.save();
  session.enqueue({html: 'Third'});
  await Promise.all([first, second]);
  await session.flush();
  expect(md.save.mock.calls.map(call => call[1][0].revision)).toEqual(['written-1', 'written-2']);
  expect(session.draft.parts.fields.html).toEqual({value: 'Third', base: {value: 'Second'}});
 });

 it('keeps refused drafts editable without rebasing and returns the native refusal', async () => {
  const md = runtime(), errors = vi.fn(), session = new DraftSession(md, opened, null, {onError: errors});
  md.refuse = {outcome: 'refused', code: 'changed-underneath', retryable: false, parts: [{path: opened.path, part: 'field', name: 'html'}]};
  session.enqueue({html: 'My draft'});
  expect(await session.save()).toEqual(md.refuse);
  const firstRevision = session.draft.revision;
  session.enqueue({html: 'Continue my draft'});
  await session.flush();
  expect(md.roomDraft.write.mock.calls[1][2]).toBe(firstRevision);
  expect(session.draft.parts.fields.html.base).toEqual({value: opened.fields.html});
  expect(session.error).toBe(null);
  expect(errors).toHaveBeenCalledTimes(1);
  expect(md.roomDraft.discard).not.toHaveBeenCalled();
 });

 it('retries Save against the latest shared exact revision while retaining its merged fields', async () => {
  const md = runtime(), session = new DraftSession(md, opened);
  session.enqueue({html: 'Mine'});
  await session.flush();
  const shared = draft({fields: {...session.draft.parts.fields, title: {value: 'Theirs', base: {value: 'Original'}}}}, {revision: 'shared-newer'});
  md.state.set(opened.path, shared);
  expect(await session.save()).toMatchObject({outcome: 'saved'});
  expect(md.save.mock.calls.map(call => call[1][0].revision)).toEqual(['written-1', 'shared-newer']);
  expect(session.fields).toMatchObject({html: 'Mine', title: 'Theirs'});
  expect(session.error).toBe(null);
  expect(session.draft).toBe(null);
  expect(md.state.has(opened.path)).toBe(false);
 });

 it('does not misidentify its own observations emitted before write/save resolves', async () => {
  const md = runtime(), errors = vi.fn(), session = new DraftSession(md, opened, null, {onError: errors});
  md.emit = next => session.observe(next);
  session.enqueue({html: 'One'});
  session.enqueue({html: 'Two'});
  await session.save();
  session.enqueue({html: 'Three'});
  await session.flush();
  expect(errors).not.toHaveBeenCalled();
  expect(session.draft.parts.fields.html).toEqual({value: 'Three', base: {value: 'Two'}});
 });

 it('redraws already-stored input from the latest shared draft without an overlap warning', async () => {
  const md = runtime(), session = new DraftSession(md, opened);
  const recovered = draft({fields: {html: {value: 'Recovered externally', base: {value: 'Original'}}}});
  md.state.set(opened.path, recovered);
  session.observe(recovered);
  expect(session.fields.html).toBe('Recovered externally');
  session.enqueue({html: 'My input'});
  await session.flush();
  const foreign = {...recovered, revision: 'foreign'};
  session.observe(foreign);
  expect(session.fields.html).toBe('Recovered externally');
  expect(session.error).toBe(null);
 });

 it('updates same-revision returned/conflict metadata without replacing the typing buffer', async () => {
  const md = runtime(), session = new DraftSession(md, opened);
  session.enqueue({html: 'Held'});
  await session.flush();
  const updated = {...session.draft, returned: {kind: 'rejected', code: 'denied', fields: {}}, changedUnderneath: {fields: {html: {value: 'Remote'}}}};
  session.observe(updated);
  expect(session.draft.returned).toEqual(updated.returned);
  expect(session.fields.html).toBe('Held');
  expect(session.error).toBe(null);
 });

 it('persists an empty New form and each later creation edit using exact creation CAS', async () => {
  const md = runtime(), empty = {...opened, path: 'articles/new.md', fields: {title: '', html: '', edit_mode: 'new'}};
  const session = new DraftSession(md, empty, null, {creation: true});
  session.enqueue({});
  await session.flush();
  session.enqueue({title: 'A typed new title', edit_template: 'report'});
  await session.flush();
  expect(md.roomDraft.write.mock.calls.map(call => call[2])).toEqual([null, 'written-1']);
  expect(session.draft.parts).toEqual({creation: {type: 'document_article', fields: {title: 'A typed new title', html: '', edit_mode: 'new', edit_template: 'report'}, sections: {}}});
  expect(md.save).not.toHaveBeenCalled();
  expect(session.isCreation).toBe(true);
 });

 it('restores unfinished creation fields and preserves creation sections and overrides', async () => {
  const stored = draft({creation: {type: 'document_article', fields: {title: 'New saved locally', html: '<p>Draft</p>', edit_mode: 'new'}, sections: {Notes: 'Keep me'}}, fields: {title: {value: 'Override title', base: null}}});
  const md = runtime(stored), session = new DraftSession(md, opened, stored);
  expect(session.fields.title).toBe('Override title');
  session.enqueue({title: 'Final title'});
  await session.flush();
  expect(session.draft.parts.creation.sections).toEqual({Notes: 'Keep me'});
  expect(session.draft.parts.fields.title).toEqual({value: 'Final title', base: null});
  await session.save();
  expect(session.isCreation).toBe(false);
  session.enqueue({title: 'After creation'});
  await session.flush();
  expect(session.draft.parts.creation).toBeUndefined();
  expect(session.draft.parts.fields.title).toEqual({value: 'After creation', base: {value: 'Final title'}});
 });

 it('does not let view callbacks or detached getters corrupt the persistence queue', async () => {
  const md = runtime(), session = new DraftSession(md, opened, null, {onChange: () => { throw new Error('unmounted view'); }});
  session.enqueue({html: 'Safe'});
  session.fields.html = 'Mutation attempt';
  await session.flush();
  session.draft.parts.fields.html.value = 'Another mutation';
  expect(session.fields.html).toBe('Safe');
  expect(session.draft.parts.fields.html.value).toBe('Safe');
 });

 it('recovers a provider-returned draft after a successful local save and keeps its refusal on later typing', async () => {
  const md = runtime(), session = new DraftSession(md, opened);
  session.enqueue({html: 'Submitted locally'});
  await session.flush();
  const submitted = session.draft;
  await session.save();
  const returned = {...submitted, revision: 'returned-after-save', returned: {kind: 'rejected', code: 'provider-rule', fields: {}}};
  md.state.set(opened.path, returned);
  session.observe(returned);
  expect(session.fields.html).toBe('Submitted locally');
  expect(session.draft.returned).toEqual(returned.returned);
  session.enqueue({html: 'Continue returned text'});
  await session.flush();
  expect(md.roomDraft.write.mock.calls[1][2]).toBe('returned-after-save');
  expect(session.draft.returned).toEqual(returned.returned);
  expect(session.draft.parts.fields.html.base).toEqual({value: opened.fields.html});
 });

 it('retains a newer buffer after an uncertain save without guessing a fresh null revision', async () => {
  const gate = deferred(), md = runtime(), errors = vi.fn();
  const session = new DraftSession(md, opened, null, {onError: errors});
  session.enqueue({html: 'Before Save'});
  await session.flush();
  const before = session.draft;
  md.save.mockImplementation(async () => { await gate.promise; throw new Error('bridge disconnected'); });
  const saving = session.save();
  session.enqueue({html: 'Typed during Save'});
  gate.resolve();
  await expect(saving).rejects.toMatchObject({code: 'save-failed'});
  await expect(session.flush()).rejects.toMatchObject({code: 'save-failed'});
  expect(session.fields.html).toBe('Typed during Save');
  expect(session.draft).toEqual(before);
  expect(md.roomDraft.write).toHaveBeenCalledTimes(1);
  expect(errors).toHaveBeenCalledTimes(1);
 });

 it('lets later same-browser typing win and redraws both tabs from one shared draft', async () => {
  const md = runtime(), errors = vi.fn();
  const a = new DraftSession(md, opened, null, {onError: errors});
  const b = new DraftSession(md, opened, null, {onError: errors});
  md.emit = next => { a.observe(next); b.observe(next); };
  a.enqueue({html: 'Typed earlier'});
  b.enqueue({html: 'Typed later'});
  await Promise.all([a.flush(), b.flush()]);
  expect(a.fields.html).toBe('Typed later');
  expect(b.fields.html).toBe('Typed later');
  expect(md.state.size).toBe(1);
  expect(md.state.get(opened.path).parts.fields.html).toEqual({value: 'Typed later', base: {value: opened.fields.html}});
  expect(errors).not.toHaveBeenCalled();
  expect(md.roomDraft.discard).not.toHaveBeenCalled();
 });

 it('merges disjoint edits from full snapshots without reasserting unchanged fields', async () => {
  const md = runtime();
  const a = new DraftSession(md, opened), b = new DraftSession(md, opened);
  md.emit = next => { a.observe(next); b.observe(next); };
  a.enqueue({...opened.fields, html: 'Changed by A'});
  b.enqueue({...opened.fields, title: 'Changed by B'});
  await Promise.all([a.flush(), b.flush()]);
  expect(md.state.get(opened.path).parts.fields).toEqual({html: {value: 'Changed by A', base: {value: opened.fields.html}}, title: {value: 'Changed by B', base: {value: 'Original'}}});
  expect(a.fields).toMatchObject({html: 'Changed by A', title: 'Changed by B'});
  expect(b.fields).toEqual(a.fields);
 });

 it('shows shared disjoint changes immediately while overlaying genuinely pending typing', async () => {
  const gate = deferred(), md = runtime(), changes = vi.fn();
  const session = new DraftSession(md, opened, null, {onChange: changes});
  md.beforeWrite = () => gate.promise;
  session.enqueue({edit_source: 'Unfinished local source'});
  const shared = draft({fields: {html: {value: 'Other tab content', base: {value: opened.fields.html}}}}, {revision: 'shared-html'});
  md.state.set(opened.path, shared);
  session.observe(shared);
  expect(session.pending).toBe(true);
  expect(session.fields).toMatchObject({html: 'Other tab content', edit_source: 'Unfinished local source'});
  gate.resolve();
  await session.flush();
  expect(session.fields).toMatchObject({html: 'Other tab content', edit_source: 'Unfinished local source'});
  expect(md.state.get(opened.path).parts.fields.html).toEqual(shared.parts.fields.html);
  expect(changes).toHaveBeenCalled();
 });

 it('preserves returned refusal metadata and original bases through a stale merge', async () => {
  const md = runtime(), session = new DraftSession(md, opened);
  const returned = draft({fields: {html: {value: 'Returned input', base: {value: 'Original provider base'}}, title: {value: 'Returned title', base: {value: 'Old title'}}}}, {revision: 'returned-shared', returned: {kind: 'conflicted', code: 'provider-conflict', fields: {reason: 'changed'}}, changedUnderneath: {fields: {html: {value: 'Remote head'}}}});
  md.state.set(opened.path, returned);
  session.enqueue({html: 'Later local input'});
  await session.flush();
  expect(session.draft.returned).toEqual(returned.returned);
  expect(session.draft.changedUnderneath).toEqual(returned.changedUnderneath);
  expect(session.draft.parts.fields.html).toEqual({value: 'Later local input', base: {value: 'Original provider base'}});
  expect(session.draft.parts.fields.title).toEqual(returned.parts.fields.title);
  md.refuse = {outcome: 'refused', code: 'changed-underneath', retryable: false};
  expect(await session.save()).toEqual(md.refuse);
  expect(session.draft.returned).toEqual(returned.returned);
 });

 it('bounds continuous CAS contention while retaining input and allowing the next edit to retry', async () => {
  const md = runtime(), session = new DraftSession(md, opened);
  const write = md.roomDraft.write.getMockImplementation();
  md.roomDraft.write.mockImplementation(async () => ({outcome: 'stale', current: null}));
  session.enqueue({html: 'Latest retained', edit_source: 'Keep this too'});
  await expect(session.flush()).rejects.toMatchObject({code: 'stale'});
  expect(md.roomDraft.write).toHaveBeenCalledTimes(8);
  expect(md.roomDraft.read).toHaveBeenCalledTimes(8);
  expect(session.fields).toMatchObject({html: 'Latest retained', edit_source: 'Keep this too'});
  md.roomDraft.write.mockImplementation(write);
  session.enqueue({title: 'Now available'});
  await session.flush();
  expect(session.error).toBe(null);
  expect(session.draft.parts.fields).toMatchObject({html: {value: 'Latest retained'}, edit_source: {value: 'Keep this too'}, title: {value: 'Now available'}});
 });

 it('rejects adoption of a draft from a different room or path', () => {
  expect(() => new DraftSession(runtime(), opened, draft({}, {room: 'another-room'}))).toThrow('does not belong');
 });
});

it('does not retain a ghost Save state after another tab consumes the shared draft',async()=>{const md=runtime(),session=new DraftSession(md,opened);session.enqueue({html:'Earlier input'});await session.flush();expect(session.hasChanges).toBe(true);md.state.delete(opened.path);session.observe(null);expect(session.hasChanges).toBe(false);expect(await session.save()).toBeNull();expect(md.save).not.toHaveBeenCalled();});
