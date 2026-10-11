/** A document's shared local Room Draft outlives the editor displaying it. */
import type { Runtime } from './runtime';

type Draft = NonNullable<Awaited<ReturnType<Runtime['roomDraft']['read']>>>;
type Parts = Parameters<Runtime['roomDraft']['write']>[3];
type SaveResult = Awaited<ReturnType<Runtime['save']>>;
type Fields = Readonly<Record<string, unknown>>;
export type DraftDocument = { room: string; path: string; fields: Fields };
export type DraftSessionOptions = {
 creation?: boolean;
 onError?: (error: DraftSessionError, session: DraftSession) => void;
 onChange?: (session: DraftSession) => void;
};

export class DraftSessionError extends Error {
 constructor(
  readonly code: 'stale' | 'write-failed' | 'save-failed' | 'save-refused' | 'unsupported-draft',
  message: string,
  readonly current: Draft | null,
  readonly detail?: unknown,
 ) { super(message); this.name = 'DraftSessionError'; }
}

const copy = <T>(value: T): T => structuredClone(value);
const OVERLAP_ATTEMPTS = 8;
function equal(left: unknown, right: unknown): boolean {
 return Object.is(left, right) || (Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((value, index) => equal(value, right[index])));
}
function projected(fields: Fields, draft: Draft | null): Record<string, unknown> {
 const creation = draft?.parts.creation;
 const result = { ...copy(fields), ...(creation && 'fields' in creation ? copy(creation.fields) : {}) };
 for (const [name, part] of Object.entries(draft?.parts.fields ?? {})) result[name] = copy(part.value);
 return result;
}

/**
 * Room Draft writes and Save are local-runtime calls, never provider requests.
 * All tabs share one draft. A stale local revision is reread and this tab's
 * pending input is merged onto it with exact CAS. Other fields, original bases
 * and returned provider refusals are retained; no draft is discarded or rebased.
 */
export class DraftSession {
 readonly room: string;
 readonly path: string;
 private baseline: Fields;
 private buffer: Record<string, unknown>;
 private durableFields: Fields;
 private held: Draft | null;
 private creating: boolean;
 private tail: Promise<void> = Promise.resolve();
 private queued = 0;
 private pendingEdit: {patch: Record<string, unknown>; version: number} | null = null;
 private readonly unstored = new Map<string, {value: unknown; version: number}>();
 private editVersion = 0;
 private blocked: DraftSessionError | null = null;
 private failure: DraftSessionError | null = null;
 private observed: Draft | null | undefined;
 private readonly revisions = new Set<string>();

 constructor(
  private readonly runtime: Pick<Runtime, 'roomDraft' | 'save'>,
  opened: DraftDocument,
  draft: Draft | null = null,
  private readonly options: DraftSessionOptions = {},
 ) {
  this.room = opened.room;
  this.path = opened.path;
  if (draft && (draft.room !== this.room || draft.path !== this.path)) throw new Error('The draft does not belong to this article.');
  this.baseline = copy(opened.fields);
  this.held = copy(draft);
  this.creating = !!options.creation || !!draft?.parts.creation;
  this.buffer = projected(this.baseline, draft);
  this.durableFields = copy(this.buffer);
  if (draft) this.revisions.add(draft.revision);
 }

 get fields(): Fields { return copy(this.buffer); }
 get draft(): Draft | null { return copy(this.held); }
 get error(): DraftSessionError | null { return this.failure; }
 get pending(): boolean { return this.queued > 0; }
 get hasChanges(): boolean { return this.held !== null || this.unstored.size > 0 || (this.creating && this.pending); }
 get isCreation(): boolean { return this.creating; }

 /** Capture only changed input fields synchronously; full UI snapshots are safe. */
 enqueue(patch: Record<string, unknown>): void {
  const captured: Record<string, unknown> = {};
  // Repeated contention is bounded per job. The next input may retry all the
  // retained values, without making a permanent recovery state or extra draft.
  if (this.blocked?.code === 'stale') {
   this.blocked = null;
   for (const [name, part] of this.unstored) captured[name] = copy(part.value);
  }
  for (const [name, value] of Object.entries(patch)) {
   if (!Object.hasOwn(this.buffer, name) || !equal(value, this.buffer[name])) captured[name] = copy(value);
  }
  if (!Object.keys(captured).length && !(this.creating && !this.held)) return;
  Object.assign(this.buffer, captured);
  const version = ++this.editVersion;
  for (const [name, value] of Object.entries(captured)) this.unstored.set(name, {value, version});
  if (this.pendingEdit) {
   Object.assign(this.pendingEdit.patch, captured);
   this.pendingEdit.version = version;
   this.notify();
   return;
  }
  const edit = {patch: captured, version};
  this.pendingEdit = edit;
  void this.schedule(async () => {
   if (this.pendingEdit === edit) this.pendingEdit = null;
   if (this.blocked) throw this.blocked;
   for (let attempt = 0; attempt < OVERLAP_ATTEMPTS; attempt++) {
    const parts = this.partsWith(edit.patch);
    let result: Awaited<ReturnType<Runtime['roomDraft']['write']>>;
    try {
     result = await this.runtime.roomDraft.write(this.room, this.path, this.held?.revision ?? null, parts);
    } catch (cause) {
     throw this.fail('write-failed', 'The local draft could not be stored. Your latest text is kept in this session.', this.held, cause, true);
    }
    if (result.outcome === 'stale') {
     await this.readShared();
     continue;
    }
    if (!result.roomDraft) throw this.fail('write-failed', 'The local draft write returned no stored draft. Your latest text is kept in this session.', this.held, result, true);
    this.revisions.add(result.roomDraft.revision);
    this.adopt(result.roomDraft);
    for (const name of Object.keys(edit.patch)) {
     if ((this.unstored.get(name)?.version ?? Infinity) <= edit.version) this.unstored.delete(name);
    }
    this.failure = null;
    // The shared observer can deliver another tab's newer write before our
    // own write promise resolves. A fresh local read avoids rolling it back.
    const seen = this.observed;
    if (seen !== undefined && seen?.revision !== result.roomDraft.revision && (!seen || !this.revisions.has(seen.revision))) await this.readShared();
    this.refreshBuffer();
    return;
   }
   throw this.fail('stale', 'The shared local draft is changing continuously. Your latest input is kept and will retry with your next edit.', this.held, undefined, true);
  }).catch(() => { /* onError reports local failures without unhandled rejection. */ });
 }

 async flush(): Promise<void> {
  await this.tail;
  if (this.blocked) throw this.blocked;
 }

 /** Save is a queue barrier; edits typed afterward stay out of this commit. */
 save(): Promise<SaveResult | null> {
  this.pendingEdit = null;
  return this.schedule(async () => {
   if (this.blocked) throw this.blocked;
   for (let attempt = 0; attempt < OVERLAP_ATTEMPTS; attempt++) {
    if (!this.held) return null;
    const draft = copy(this.held);
    const savedFields = copy(this.durableFields);
    let result: SaveResult;
    try {
     result = await this.runtime.save(this.room, [{path: this.path, revision: draft.revision}]);
    } catch (cause) {
     throw this.fail('save-failed', 'The local save could not be confirmed. Your draft and latest text have been kept.', this.held, cause, true);
    }
    if (result.outcome !== 'saved') {
     if (result.rule === 'stale') { await this.readShared(); continue; }
     this.fail('save-refused', `House refused this save (${result.rule}). Your draft and latest text have been kept.`, this.held, result);
     return result;
    }
    this.baseline = savedFields;
    this.durableFields = savedFields;
    this.held = null;
    this.creating = false;
    this.failure = null;
    this.refreshBuffer();
    return result;
   }
   throw this.fail('stale', 'The shared local draft is changing continuously. Your draft and latest input are kept.', this.held, undefined, true);
  });
 }

 /** Redraw shared fields now, overlaying only genuinely not-yet-stored input. */
 observe(draft: Draft | null): void {
  if (draft && (draft.room !== this.room || draft.path !== this.path)) return;
  this.observed = copy(draft);
  if (draft && this.revisions.has(draft.revision) && draft.revision !== this.held?.revision) return;
  // While a call is in flight its CAS response controls held ownership. The UI
  // can still show disjoint shared changes without overwriting queued input.
  if (this.pending) {
   this.refreshBuffer(projected(this.baseline, draft));
   this.notify();
  } else this.reconcileObserved();
 }

 private async readShared(): Promise<void> {
  try {
   const current = await this.runtime.roomDraft.read(this.room, this.path);
   this.observed = undefined;
   this.adopt(current);
  } catch (cause) {
   throw this.fail('write-failed', 'The shared local draft could not be read. Your latest text is kept in this session.', this.held, cause, true);
  }
 }

 private adopt(draft: Draft | null): void {
  this.held = copy(draft);
  this.creating = !!draft?.parts.creation || (this.creating && !draft);
  this.durableFields = projected(this.baseline, draft);
  this.refreshBuffer();
 }

 private refreshBuffer(fields: Fields = this.durableFields): void {
  this.buffer = copy(fields);
  for (const [name, part] of this.unstored) this.buffer[name] = copy(part.value);
 }

 private partsWith(patch: Fields): Parts {
  const parts: Parts = copy(this.held?.parts ?? {});
  if (parts.markdown || (parts.creation && 'markdown' in parts.creation)) throw this.fail('unsupported-draft', 'This whole-document draft cannot be combined with editor fields. Its contents and your latest text have been kept.', this.held, undefined, true);
  if (this.creating) {
   const creation = parts.creation;
   const fields = {...copy(this.durableFields), ...(creation && 'fields' in creation ? copy(creation.fields) : {}), ...copy(patch)};
   const overrides = {...parts.fields};
   for (const [name, value] of Object.entries(patch)) if (Object.hasOwn(overrides, name)) overrides[name] = {...overrides[name], value};
   return {...parts, ...(parts.fields ? {fields: overrides} : {}), creation: {type: creation && 'type' in creation ? creation.type : 'document_article', fields, sections: creation && 'sections' in creation ? creation.sections : {}}};
  }
  const fields = {...parts.fields};
  for (const [name, value] of Object.entries(patch)) fields[name] = {value, base: fields[name] ? fields[name].base : (Object.hasOwn(this.baseline, name) ? {value: copy(this.baseline[name])} : null)};
  return {...parts, fields};
 }

 private schedule<T>(operation: () => Promise<T>): Promise<T> {
  this.queued++;
  const running = this.tail.then(operation);
  const settled = running.finally(() => {
   this.queued--;
   if (!this.pending) this.reconcileObserved();
   this.notify();
  });
  this.tail = settled.then(() => undefined, () => undefined);
  this.notify();
  return settled;
 }

 private reconcileObserved(): void {
  const seen = this.observed;
  this.observed = undefined;
  if (seen === undefined) return;
  if (seen && this.revisions.has(seen.revision) && seen.revision !== this.held?.revision) return;
  this.adopt(seen);
  this.notify();
 }

 private fail(code: DraftSessionError['code'], message: string, current: Draft | null, detail?: unknown, block = false): DraftSessionError {
  const error = new DraftSessionError(code, message, copy(current), detail);
  this.failure = error;
  if (block) this.blocked = error;
  try { this.options.onError?.(error, this); } catch { /* a view cannot interrupt persistence */ }
  return error;
 }

 private notify(): void {
  try { this.options.onChange?.(this); } catch { /* a view cannot interrupt persistence */ }
 }
}
