/** House implementation of dokieli's StorageBackend and StorageRouter seam. All writes are guarded Room Drafts. */
import type { Runtime } from './runtime';
export type Article = { room: string; path: string; markdown: string; fields: { title: string; html: string; archived: boolean; source_url: string; source_revision: string; author: string; license: string; license_url: string } };
export const articleQuery = {types:['document_article'], select:{fields:'all' as const, markdown:true as const}, orderBy:[{by:'path' as const,direction:'asc' as const}]};
export function decodeArticle(doc: {room: string; path: string; markdown?: string; fields?: Readonly<Record<string,unknown>>}): Article {
 const fields = doc.fields;
 if (!fields || typeof fields.archived !== 'boolean' || ['title','html','source_url','source_revision','author','license','license_url'].some(key=>typeof fields[key] !== 'string') || !doc.markdown || !/^articles\/[a-zA-Z0-9_-]+\.md$/.test(doc.path)) throw new Error(`Invalid article document: ${doc.path}`);
 return {room:doc.room,path:doc.path,markdown:doc.markdown,fields:{...fields} as Article['fields']};
}
export class StorageBackend {
 get name() { return 'abstract'; }
 supports(_cap: string) { return false; }
}
export class HouseStorage extends StorageBackend {
 private busy = false;
 constructor(private runtime: Runtime, readonly room: string) { super(); }
 get name() { return 'house'; }
 async get(path: string): Promise<Article> {
  if (!/^articles\/[a-zA-Z0-9_-]+\.md$/.test(path)) throw new Error('Invalid article path.');
  const result = await this.runtime.query({...articleQuery, rooms:[this.room]});
  const doc = result.documents.find(row=>row.path === path);
  if (!doc) throw new Error('The article is no longer in this Room.');
  return decodeArticle(doc);
 }
 private async commit(path: string, parts: Parameters<Runtime['roomDraft']['write']>[3]) {
  if (this.busy) throw new Error('A save is already in progress.');
  this.busy = true;
  try {
   const room = (await this.runtime.rooms()).find(row=>row.locator === this.room);
   if (!room || room.replica.admission !== 'admitted' || room.refusal || !room.operations.write.length) throw new Error('This Room is not writable.');
   if (await this.runtime.roomDraft.read(this.room,path)) throw new Error('An unfinished House draft exists for this article. Your current edits remain on screen; resolve the draft in House before saving.');
   const draft = await this.runtime.roomDraft.write(this.room,path,null,parts);
   if (draft.outcome !== 'written' || !draft.roomDraft) throw new Error('Another tab changed the draft. Your edits remain on screen.');
   const saved = await this.runtime.save(this.room,[{path,revision:draft.roomDraft.revision}]);
   if (saved.outcome !== 'saved') throw new Error(`House refused this save (${saved.rule}). Drafts have been preserved. ${JSON.stringify(saved)}`);
   return saved;
  } finally { this.busy = false; }
 }
 put(opened: Article, html: string, title: string) {
  this.validateOpened(opened);
  if (!title.trim() || html.length > 2_000_000) throw new Error('An article needs a title and HTML below 2 MB.');
  return this.commit(opened.path,{fields:{html:{value:html,base:{value:opened.fields.html}},title:{value:title,base:{value:opened.fields.title}}}});
 }
 post(title: string, html: string) {
  if (!title.trim() || html.length > 2_000_000) throw new Error('An article needs a title and HTML below 2 MB.');
  const path = `articles/article-${crypto.randomUUID()}.md`;
  return this.commit(path,{creation:{type:'document_article',fields:{title,html,archived:false,source_url:'',source_revision:'',author:'',license:'',license_url:''},sections:{}}}).then(result=>({...result,path}));
 }
 /** The donor delete action becomes reversible archive, never a document removal. */
 delete(opened: Article) { return this.archive(opened,true); }
 archive(opened: Article, archived: boolean) { this.validateOpened(opened); return this.commit(opened.path,{fields:{archived:{value:archived,base:{value:opened.fields.archived}}}}); }
 save(opened: Article, html: string, title: string) { return this.put(opened,html,title); }
 private validateOpened(opened: Article) { if (opened.room !== this.room || !/^articles\/[a-zA-Z0-9_-]+\.md$/.test(opened.path)) throw new Error('Article does not belong to this Room.'); }
}
/** One concrete backend only; no HTTP, Solid, Gitforge or authentication routing. */
export class StorageRouter {
 constructor(readonly backend: HouseStorage) {}
 get(path: string) { return this.backend.get(path); }
 put(opened: Article, html: string, title: string) { return this.backend.put(opened,html,title); }
 post(title: string, html: string) { return this.backend.post(title,html); }
 delete(opened: Article) { return this.backend.delete(opened); }
 save(opened: Article, html: string, title: string) { return this.backend.save(opened,html,title); }
}
