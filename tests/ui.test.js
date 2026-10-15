import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import fs from 'node:fs';
import {held} from '../node_modules/@agentshouse/mdruntime/dist/room-draft.js';
const fixtures=vi.hoisted(()=>({runtime:null,bridge:{setTab:vi.fn()},handlers:new Map()}));
vi.mock('../src/house/runtime',()=>({connect:async()=>({runtime:fixtures.runtime,bridge:fixtures.bridge})}));
const fields={title:'Title',html:'<h1>Title</h1><p>Original</p>',archived:false,source_url:'',source_revision:'',author:'',license:'',license_url:''};
let docs,drafts,rooms,writeResolve,config,revision,presentation,address,addressListeners;
const $=id=>document.getElementById(id);
const articleDraft=()=>drafts.find(d=>d.room==='r_a'&&d.path==='articles/one.md');
const emit=(topic,value)=>fixtures.handlers.get(topic)?.(value);
const room=id=>({locator:id,name:id,operations:{write:['/']},replica:{admission:'admitted'},refusal:null});
function doc(id='r_a',path='articles/one.md'){return{room:id,path,markdown:'opened',fields:{...fields}};}
function view(){return config.Editor.editorView;}
function edit(text='Changed'){if(!$('edit-article').textContent.includes('Read'))$('edit-article').click();const v=view();v.dispatch(v.state.tr.insertText(text,1,6));}
beforeEach(async()=>{
 address='/';addressListeners=new Set();
 fixtures.bridge.address=()=>address;fixtures.bridge.onAddress=fn=>{addressListeners.add(fn);return()=>addressListeners.delete(fn);};
 const move=next=>{address=next;addressListeners.forEach(fn=>fn(next));return Promise.resolve(next);};
 fixtures.bridge.push=vi.fn(move);fixtures.bridge.replace=vi.fn(move);
 vi.resetModules();fixtures.handlers.clear();fixtures.bridge.setTab.mockClear();docs=[doc(),doc('r_b')];drafts=[];rooms=[room('r_a')];writeResolve=null;revision=0;presentation={};
 document.documentElement.innerHTML=fs.readFileSync('index.html','utf8').replace(/<!DOCTYPE html>/i,'').replace(/<script[^>]*><\/script>/g,'');
 window.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});globalThis.matchMedia=window.matchMedia;
 Range.prototype.getBoundingClientRect=()=>({top:0,bottom:0,left:0,right:0,width:0,height:0});Range.prototype.getClientRects=()=>[];
 window.confirm=vi.fn(()=>true);
 HTMLDialogElement.prototype.showModal=function(){this.open=true;};HTMLDialogElement.prototype.close=function(){this.open=false;};
 fixtures.runtime={
  presentation:{read:vi.fn(async()=>presentation),write:vi.fn(async value=>{presentation=structuredClone(value);})},
  rooms:vi.fn(async()=>rooms),query:vi.fn(async()=>({documents:docs})),persistence:vi.fn(async()=>true),
  observe:vi.fn(async(topic)=>({current:()=>({rooms,query:{documents:docs},'room-drafts':drafts,'sync-status':{lastCompleted:'2026-10-11T13:00:00Z',attentionRequired:[],providerUnreachable:false,state:'synced',reset:null},'service-mode':'open','storage-loss':null,'connection-refusal':null})[topic],subscribe:fn=>{fixtures.handlers.set(topic,fn);return()=>fixtures.handlers.delete(topic);},close:()=>fixtures.handlers.delete(topic)})),
  roomDraft:{read:vi.fn(async(id,path)=>drafts.find(d=>d.room===id&&d.path===path)||null),write:vi.fn(async(id,path,base,parts)=>{if(writeResolve)await writeResolve;const old=drafts.find(d=>d.room===id&&d.path===path)||null;if((old?.revision||null)!==base)return{outcome:'stale',current:old};const d={room:id,path,revision:`draft-${++revision}`,parts:held(old?.parts,parts),returned:old?.returned||null,changedUnderneath:{}};drafts=[...drafts.filter(d=>d.room!==id||d.path!==path),d];emit('room-drafts',drafts);return{outcome:'written',roomDraft:d};}),discard:vi.fn()},
  save:vi.fn(async(id,requests)=>{const request=requests[0],d=drafts.find(d=>d.room===id&&d.path===request.path);if(!d||d.revision!==request.revision)return{outcome:'refused',code:'stale', retryable: false};if(d.parts.creation){docs.push({room:id,path:d.path,markdown:'created',fields:{...d.parts.creation.fields}});}else{docs=docs.map(row=>row.room===id&&row.path===d.path?{...row,fields:{...row.fields,...Object.fromEntries(Object.entries(d.parts.fields).map(([k,v])=>[k,v.value]))}}:row);}drafts=drafts.filter(row=>row!==d);emit('room-drafts',drafts);emit('query',{documents:docs});return{outcome:'saved',identifier:'queued'};})
 };
 await import('../src/house/main.js');config=(await import('../src/config.js')).default;await vi.waitFor(()=>expect(fixtures.runtime.persistence).toHaveBeenCalled());
});
afterEach(()=>{window.dispatchEvent(new Event('pagehide'));document.body.innerHTML='';vi.restoreAllMocks();});
it('provider write halt still permits local typing and explicit Save queue admission',async()=>{
 emit('service-mode','write-halted');
 expect($('edit-article').disabled).toBe(false);
 expect($('new-article').disabled).toBe(false);
 edit('Held provider edit');
 expect(view().editable).toBe(true);
 await vi.waitFor(()=>expect(articleDraft()?.parts.fields.html?.value).toContain('Held provider edit'));
 expect(fixtures.runtime.save).not.toHaveBeenCalled();
 expect($('save-article').disabled).toBe(false);
 $('save-article').click();
 await vi.waitFor(()=>expect(fixtures.runtime.save).toHaveBeenCalledTimes(1));
 expect(docs[0].fields.html).toContain('Held provider edit');
 expect($('house-status').textContent).toBe('Save queued');
 expect($('house-warning').hidden).toBe(true);
 emit('service-mode','open');
 expect(view().editable).toBe(true);
 expect(fixtures.runtime.save).toHaveBeenCalledTimes(1);
});
it('provider reopening does not clear a genuine connection refusal',()=>{
 emit('connection-refusal',{code:'revoked-authorization',retryable:false});
 emit('service-mode','write-halted');emit('service-mode','open');
 expect($('edit-article').disabled).toBe(true);
 expect($('new-article').disabled).toBe(true);
 expect($('house-warning').textContent).toContain('revoked-authorization');
 expect(fixtures.runtime.save).not.toHaveBeenCalled();
});
it('loads only bound Room content and normal save clears own draft warning',async()=>{expect($('article-content').textContent).toContain('Original');edit();$('save-article').click();await vi.waitFor(()=>expect(fixtures.runtime.save).toHaveBeenCalledTimes(1));await vi.waitFor(()=>expect($('save-article').disabled).toBe(true));expect($('house-warning').hidden).toBe(true);expect(docs[0].fields.html).toContain('Changed');});
it('Reload is an immediate local view refresh retaining typed drafts without queries',()=>{edit('Before');$('reload-article').click();expect($('article-content').textContent).toContain('Before');expect(view().editable).toBe(true);expect(fixtures.runtime.query).not.toHaveBeenCalled();expect(window.confirm).not.toHaveBeenCalled();});
it('changing collection reach keeps identical draft paths isolated',async()=>{edit('Room A');await vi.waitFor(()=>expect(drafts.some(d=>d.room==='r_a')).toBe(true));rooms=[room('r_b')];emit('rooms',rooms);emit('query',{documents:[docs[1]]});document.querySelector('#article-list button').click();expect($('article-content').textContent).toContain('Original');expect($('article-content').textContent).not.toContain('Room A');expect($('edit-article').disabled).toBe(false);});
it('revoking the open Room preserves dirty content for export',()=>{edit('Retain');rooms=[room('r_b')];emit('rooms',rooms);emit('query',{documents:[docs[1]]});expect($('article-content').textContent).toContain('Retain');expect($('export-article').disabled).toBe(false);expect($('save-article').disabled).toBe(true);expect($('article-content').textContent).toMatch(/Retain|Remain/);});
it('archive commits typed drafts without discarding article edits or prompting',async()=>{edit('Retained');$('archive-article').click();await vi.waitFor(()=>expect(fixtures.runtime.save).toHaveBeenCalled());expect($('article-content').textContent).toContain('Retained');expect($('archive-article').textContent).toBe('Restore');expect(window.confirm).not.toHaveBeenCalled();});
it('typing remains enabled while a local draft write is pending',async()=>{let release;writeResolve=new Promise(resolve=>{release=resolve;});edit('First');expect(view().editable).toBe(true);view().dispatch(view().state.tr.insertText('Newer',1,6));expect($('article-content').textContent).toContain('Newer');release();writeResolve=null;await vi.waitFor(()=>expect(articleDraft()?.parts.fields.html.value).toContain('Newer'));expect(window.confirm).not.toHaveBeenCalled();});
it('navigation never prompts and returning restores locally queued edits after the House address acknowledgement',async()=>{edit('Remain');rooms=[room('r_b')];emit('rooms',rooms);emit('query',{documents:[docs[1]]});document.querySelector('#article-list button').click();expect($('article-content').textContent).toContain('Original');rooms=[room('r_a')];emit('rooms',rooms);emit('query',{documents:[docs[0]]});document.querySelector('#article-list button').click();await vi.waitFor(()=>expect($('article-content').textContent).toContain('Remain'));expect(window.confirm).not.toHaveBeenCalled();});
it('a rejected save preserves edits and the refused draft',async()=>{fixtures.runtime.save.mockResolvedValue({outcome:'refused',code:'changed-underneath', retryable: false});edit('Mine');$('save-article').click();await vi.waitFor(()=>expect($('house-warning').textContent).toContain('changed-underneath'));expect($('article-content').textContent).toContain('Mine');expect(fixtures.runtime.roomDraft.discard).not.toHaveBeenCalled();expect(drafts.filter(d=>d.path.startsWith('articles/'))).toHaveLength(1);});
it('creates a user-titled article and enters real editor',async()=>{$('new-article').click();$('new-title').value='User authored';$('new-form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await vi.waitFor(()=>expect($('article-content').textContent).toContain('User authored'));expect(document.querySelector('.ProseMirror')).toBeTruthy();expect($('new-dialog').open).toBe(false);});
it('corrected malformed query recovers without clearing a connection refusal',()=>{emit('query',{documents:[{...docs[0],fields:{}}]});expect($('new-article').disabled).toBe(true);emit('query',{documents:docs});expect($('new-article').disabled).toBe(false);emit('connection-refusal',{code:'revoked-authorization',retryable:false});emit('query',{documents:docs});expect($('new-article').disabled).toBe(true);});
it('waits for a pending Local Query before rendering its completed documents',async()=>{
 const observe=fixtures.runtime.observe;
 fixtures.runtime.observe=vi.fn(async(topic,...args)=>topic==='query'?{current:()=>({pending:[{room:'r_a',awaits:'index'}]}),subscribe:fn=>{fixtures.handlers.set(topic,fn);return()=>fixtures.handlers.delete(topic);},close:()=>fixtures.handlers.delete(topic)}:observe(topic,...args));
 await remount();
 expect($('article-content').textContent).toContain('Loading articles');
 expect($('house-warning').hidden).toBe(true);
 emit('query',{documents:docs});
 await vi.waitFor(()=>expect($('article-content').textContent).toContain('Original'));
 expect($('new-article').disabled).toBe(false);
});
it('source drafts persist per article and never apply across article navigation',async()=>{docs.push({...doc('r_a','articles/two.md'),fields:{...fields,title:'Second',html:'<h1>Second</h1><p>Second body</p>'}});emit('query',{documents:docs});$('source-article').click();$('source-edit').value='<h1>Source draft A</h1>';$('source-edit').dispatchEvent(new Event('input'));[...document.querySelectorAll('#article-list button')].find(node=>node.textContent==='Second').click();expect($('source-view')).toBeNull();expect($('article-content').textContent).toContain('Second body');[...document.querySelectorAll('#article-list button')].find(node=>node.textContent==='Title').click();await vi.waitFor(()=>expect(address).toBe(articleURL('articles/one.md')));$('source-article').click();expect($('source-edit').value).toContain('Source draft A');await vi.waitFor(()=>expect(articleDraft()?.parts.fields.html?.value).toContain('Source draft A'));expect(window.confirm).not.toHaveBeenCalled();});
it('query refresh preserves typed source and same-article rich edits invalidate stale Apply',()=>{$('source-article').click();$('source-edit').value='<h1>Source draft</h1>';$('source-edit').dispatchEvent(new Event('input'));docs[0].fields.html='<h1>Remote</h1>';emit('query',{documents:docs});expect($('source-edit').value).toContain('Source draft');expect($('article-content').textContent).toContain('Original');edit('New rich edit');document.querySelector('#source-view .update').click();expect($('article-content').textContent).toContain('New rich edit');expect(document.querySelector('#source-view [role="alert"]').textContent).toContain('not applied');});
it('uses the donor menu tabs and theme controls without added Room selectors',()=>{expect($('room-select')).toBeNull();$('menu-toggle').click();expect($('document-menu').classList.contains('on')).toBe(true);document.querySelector('#document-menu-tabs a[href="#menu-tools"]').click();expect($('menu-tools').classList.contains('selected')).toBe(true);expect($('source-article').closest('#menu-tools')).toBeTruthy();document.querySelector('#document-menu-tabs a[href="#menu-settings"]').click();$('do-theme-dark').checked=true;$('do-theme-dark').dispatchEvent(new Event('change',{bubbles:true}));expect(document.documentElement.dataset.theme).toBe('dark');});

it('initial empty Rooms wait for first completed sync and redraw from cached query',()=>{
 // A later sync reset also keeps already open content recoverable.
 emit('sync-status',{lastCompleted:null,attentionRequired:[],state:'syncing'});
 emit('rooms',[]);
 expect($('house-warning').textContent).not.toContain('binding is missing');
 expect($('save-article').disabled).toBe(true);
 expect($('article-content').textContent).toContain('Original');
 emit('rooms',[room('r_a')]);
 expect($('edit-article').disabled).toBe(true);
 emit('sync-status',{lastCompleted:'2026-10-11T14:00:00Z',attentionRequired:[],state:'synced'});
 expect($('edit-article').disabled).toBe(false);
 expect($('house-warning').hidden).toBe(true);
});
it('completed-sync binding errors clear on the next single Room value without another query',()=>{
 edit('Keep unsaved');emit('rooms',[]);
 expect($('house-warning').textContent).toContain('binding is missing');
 expect($('save-article').disabled).toBe(true);
 expect($('article-content').textContent).toContain('Keep unsaved');
 emit('rooms',[room('r_a'),room('r_b')]);
 expect($('house-warning').textContent).toContain('binding is missing');
 emit('rooms',[room('r_a')]);
 expect($('house-warning').hidden).toBe(true);
 expect($('save-article').disabled).toBe(false);
 expect($('article-content').textContent).toContain('Keep unsaved');
 expect(fixtures.runtime.save).not.toHaveBeenCalled();
});
it.each(['sync-first','rooms-first'])('cold startup opens cached query with %s observation order',async order=>{
 window.dispatchEvent(new Event('pagehide'));fixtures.handlers.clear();vi.resetModules();
 document.documentElement.innerHTML=fs.readFileSync('index.html','utf8').replace(/<!DOCTYPE html>/i,'').replace(/<script[^>]*><\/script>/g,'');
 rooms=[];
 const original=fixtures.runtime.observe;
 fixtures.runtime.observe=vi.fn(async topic=>topic==='sync-status'?{current:()=>({lastCompleted:null,attentionRequired:[],state:'pending'}),subscribe:fn=>fixtures.handlers.set(topic,fn),close:()=>fixtures.handlers.delete(topic)}:original(topic));
 await import('../src/house/main.js');await vi.waitFor(()=>expect(fixtures.handlers.has('connection-refusal')).toBe(true));
 expect($('article-content').textContent).toContain('Loading articles');
 expect($('house-warning').hidden).toBe(true);
 if(order==='sync-first'){
  emit('sync-status',{lastCompleted:'2026-10-11T14:00:00Z',attentionRequired:[],state:'synced'});
  expect($('house-warning').textContent).toContain('binding is missing');
  emit('rooms',[room('r_a')]);
 }else{
  emit('rooms',[room('r_a')]);
  expect($('article-content').textContent).toContain('Loading articles');
  expect($('house-warning').hidden).toBe(true);
  emit('sync-status',{lastCompleted:'2026-10-11T14:00:00Z',attentionRequired:[],state:'synced'});
 }
 expect($('article-content').textContent).toContain('Original');
 expect($('house-warning').hidden).toBe(true);
 expect($('edit-article').disabled).toBe(false);
});

async function remount(){window.dispatchEvent(new Event('pagehide'));fixtures.handlers.clear();vi.resetModules();document.documentElement.innerHTML=fs.readFileSync('index.html','utf8').replace(/<!DOCTYPE html>/i,'').replace(/<script[^>]*><\/script>/g,'');await import('../src/house/main.js');config=(await import('../src/config.js')).default;await vi.waitFor(()=>expect(fixtures.handlers.has('connection-refusal')).toBe(true));}
it('raw Source replaces article content and rehydrates exactly from its own draft',async()=>{edit('Durable');$('source-article').click();$('source-edit').value='<p>Incomplete source';$('source-edit').dispatchEvent(new Event('input'));await vi.waitFor(()=>expect(articleDraft()?.parts.fields.html?.value).toBe('<p>Incomplete source'));await remount();$('source-article').click();expect($('source-edit').value).toBe('<p>Incomplete source');expect(fixtures.runtime.save).not.toHaveBeenCalled();});
it('New title is a local creation draft before submit and survives closing plus remount',async()=>{$('new-article').click();$('new-title').value='Half written title';$('new-title').dispatchEvent(new Event('input'));$('cancel-new').click();await vi.waitFor(()=>expect(drafts.find(d=>d.parts.creation?.type==='document_article')?.parts.creation.fields.title).toBe('Half written title'));await remount();$('new-article').click();expect($('new-title').value).toBe('Half written title');expect(fixtures.runtime.save).not.toHaveBeenCalled();expect(window.confirm).not.toHaveBeenCalled();});
it('raw Markdown is staged as the article content and rehydrates in its editor mode',async()=>{edit();config.Editor.toggleMarkdown(true);config.Editor.markdownNode.value='# Unfinished\n**half';config.Editor.markdownNode.dispatchEvent(new Event('input'));await vi.waitFor(()=>expect(articleDraft()?.parts.fields.html?.value).toBe('# Unfinished\n**half'));await remount();expect(config.Editor.markdownNode.value).toBe('# Unfinished\n**half');expect(fixtures.runtime.save).not.toHaveBeenCalled();expect(drafts.every(d=>d.path.startsWith('articles/'))).toBe(true);});
it('a local persistence failure is visible and does not erase current typed text',async()=>{fixtures.runtime.roomDraft.write.mockRejectedValue(new Error('local-store-failed'));edit('Keep visible');await vi.waitFor(()=>expect($('house-warning').textContent).toContain('local draft could not be stored'));expect($('article-content').textContent).toContain('Keep visible');expect(fixtures.runtime.roomDraft.discard).not.toHaveBeenCalled();});

it('a clean viewer renders an observed shared draft before its next edit',()=>{const d={room:'r_a',path:'articles/one.md',revision:'foreign-1',parts:{fields:{html:{value:'<h1>Other editor</h1><p>Shared draft</p>',base:{value:fields.html}}}},returned:null,changedUnderneath:{}};drafts=[d];emit('room-drafts',drafts);expect($('article-content').textContent).toContain('Shared draft');expect($('article-content').textContent).not.toContain('Original');});

it('native questionnaire typing in read mode also becomes a local Room draft',async()=>{docs[0]={...docs[0],fields:{...fields,html:'<h1>Title</h1><p><input value=""><textarea></textarea></p>'}};emit('query',{documents:docs});const input=document.querySelector('#article-content input'),textarea=document.querySelector('#article-content textarea');input.value='Partial answer';input.dispatchEvent(new Event('input',{bubbles:true}));textarea.value='Partial explanation';textarea.dispatchEvent(new Event('input',{bubbles:true}));await vi.waitFor(()=>expect(articleDraft()?.parts.fields.html?.value).toContain('Partial explanation'));expect(articleDraft().parts.fields.html.value).toContain('Partial answer');expect(fixtures.runtime.save).not.toHaveBeenCalled();});

it('raw Source stays exact while typing and Save validates only the article content',async()=>{edit('Business edit');$('source-article').click();$('source-edit').value='<h1>Raw source</h1><p>Incomplete<script>bad()</script>';$('source-edit').dispatchEvent(new Event('input'));await vi.waitFor(()=>expect(articleDraft()?.parts.fields.html?.value).toContain('<script>bad()</script>'));expect(document.querySelector('#article-content script')).toBeNull();$('save-article').click();await vi.waitFor(()=>expect(fixtures.runtime.save).toHaveBeenCalledTimes(1));expect(fixtures.runtime.save.mock.calls[0][1][0].path).toBe('articles/one.md');expect(Object.keys(docs[0].fields).some(name=>name.startsWith('edit_'))).toBe(false);expect(docs[0].fields.html).not.toContain('<script>');expect(docs[0].fields.html).toContain('Raw source');expect(drafts.every(d=>d.path.startsWith('articles/'))).toBe(true);});
it('half-typed donor popup content is intentionally not stored as document or UI schema',async()=>{edit();const note=document.querySelector('#editor-form-note [name="note-content"]');note.value='Popup only';note.dispatchEvent(new Event('input',{bubbles:true}));await remount();if(!view())$('edit-article').click();expect(document.querySelector('#editor-form-note [name="note-content"]').value).toBe('');expect(JSON.stringify(drafts)).not.toContain('Popup only');});

it('later shared draft typing redraws a tab that had already staged earlier typing',async()=>{edit('Earlier typing');await vi.waitFor(()=>expect(articleDraft()?.parts.fields.html?.value).toContain('Earlier typing'));const previous=articleDraft(),later={...previous,revision:'later-tab',parts:{...previous.parts,fields:{...previous.parts.fields,html:{...previous.parts.fields.html,value:'<h1>Later typing</h1><p>Other tab</p>'}}}};drafts=drafts.map(d=>d===previous?later:d);emit('room-drafts',drafts);await vi.waitFor(()=>expect($('article-content').textContent).toContain('Other tab'));expect(window.confirm).not.toHaveBeenCalled();});

it('typing body text does not overwrite a disjoint shared title field',async()=>{edit();await vi.waitFor(()=>expect(presentation.editorModes?.['r_a\narticles/one.md']).toBe('author'));const previous=articleDraft(),later={room:'r_a',path:'articles/one.md',revision:'title-tab',parts:{fields:{...(previous?.parts.fields||{}),title:{value:'Shared metadata title',base:{value:'Title'}}}},returned:null,changedUnderneath:{}};drafts=[...drafts.filter(d=>d.path!=='articles/one.md'),later];emit('room-drafts',drafts);const v=view();v.dispatch(v.state.tr.insertText(' changed body',v.state.doc.content.size-1));await vi.waitFor(()=>expect(articleDraft()?.parts.fields.html?.value).toContain('changed body'));expect(articleDraft().parts.fields.title.value).toBe('Shared metadata title');});

function hostOpen(next){address=next;addressListeners.forEach(fn=>fn(next));}
const articleURL=(path,room='r_a')=>`/articles/${encodeURIComponent(room)}/${path.split('/').map(encodeURIComponent).join('/')}`;
it('cold article link waits for sync and query without choosing the first article or writing',async()=>{
 docs.push({...doc('r_a','articles/two.md'),fields:{...fields,title:'Second',html:'<h1>Second</h1><p>Linked body</p>'}});
 address=articleURL('articles/two.md');await remount();
 expect($('article-content').textContent).toContain('Linked body');
 expect(fixtures.bridge.push).not.toHaveBeenCalled();
 expect(fixtures.runtime.save).not.toHaveBeenCalled();expect(fixtures.runtime.roomDraft.write).not.toHaveBeenCalled();
});
it('host Back and Forward retain native drafts, with no echo, and reload restores the requested document',async()=>{
 docs.push({...doc('r_a','articles/two.md'),fields:{...fields,title:'Second',html:'<h1>Second</h1><p>Other body</p>'}});emit('query',{documents:docs});
 edit('Kept here');await vi.waitFor(()=>expect(articleDraft()?.parts.fields.html?.value).toContain('Kept here'));
 const pushes=fixtures.bridge.push.mock.calls.length;
 hostOpen(articleURL('articles/two.md'));expect($('article-content').textContent).toContain('Other body');
 hostOpen(articleURL('articles/one.md'));expect($('article-content').textContent).toContain('Kept here');
 await remount();expect($('article-content').textContent).toContain('Kept here');
 expect(fixtures.bridge.push).toHaveBeenCalledTimes(pushes);expect(fixtures.runtime.save).not.toHaveBeenCalled();expect(fixtures.runtime.roomDraft.discard).not.toHaveBeenCalled();
});
it('missing or foreign article links never create content or fall back to the first article',()=>{
 hostOpen(articleURL('articles/missing.md'));expect($('article-content').textContent).toContain('unavailable');expect($('save-article').disabled).toBe(true);
 hostOpen(articleURL('articles/one.md','r_b'));expect($('article-content').textContent).toContain('unavailable');
 expect(fixtures.runtime.save).not.toHaveBeenCalled();expect(fixtures.runtime.roomDraft.write).not.toHaveBeenCalled();
 hostOpen(articleURL('articles/one.md'));expect($('article-content').textContent).toContain('Original');expect($('edit-article').disabled).toBe(false);
});
it('a host navigation closes a half-written new dialog but preserves its Room creation draft',async()=>{
 $('new-article').click();$('new-title').value='Keep my title';$('new-title').dispatchEvent(new Event('input'));
 await vi.waitFor(()=>expect(drafts.some(d=>d.parts.creation?.fields.title==='Keep my title')).toBe(true));
 hostOpen(articleURL('articles/missing.md'));expect($('new-dialog').open).toBe(false);
 expect(drafts.some(d=>d.parts.creation?.fields.title==='Keep my title')).toBe(true);expect(fixtures.runtime.save).not.toHaveBeenCalled();
});
it('a Save completion for the previous article cannot reopen it over the newer address',async()=>{
 docs.push({...doc('r_a','articles/two.md'),fields:{...fields,title:'Second',html:'<h1>Second</h1><p>Current body</p>'}});emit('query',{documents:docs});
 edit('Saved A');await vi.waitFor(()=>expect(articleDraft()?.parts.fields.html?.value).toContain('Saved A'));
 let finish;const save=fixtures.runtime.save.getMockImplementation();fixtures.runtime.save.mockImplementation(async(...args)=>{await new Promise(resolve=>{finish=resolve;});return save(...args);});
 $('save-article').click();await vi.waitFor(()=>expect(finish).toBeTypeOf('function'));hostOpen(articleURL('articles/two.md'));finish();
 await vi.waitFor(()=>expect(docs[0].fields.html).toContain('Saved A'));expect($('article-content').textContent).toContain('Current body');expect(address).toBe(articleURL('articles/two.md'));
});

it('an initially unknown House address cannot overwrite a later deep link with the first article',async()=>{
 address=null;fixtures.bridge.replace.mockClear();await remount();
 expect(fixtures.bridge.replace).not.toHaveBeenCalled();expect($('article-content').textContent).not.toContain('Original');
 hostOpen(articleURL('articles/later.md'));expect($('article-content').textContent).toContain('unavailable');
 docs.push({...doc('r_a','articles/later.md'),fields:{...fields,title:'Later',html:'<h1>Later</h1><p>Arrived after address</p>'}});emit('query',{documents:docs});
 expect($('article-content').textContent).toContain('Arrived after address');expect(fixtures.bridge.replace).not.toHaveBeenCalled();expect(fixtures.runtime.save).not.toHaveBeenCalled();
});
