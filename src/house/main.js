import {initMenuTabsEvents} from './menu.js';
import {showSource} from './source.js';
import {createDocumentTemplate,DOCUMENT_TEMPLATES,addDocumentSlide,selectDocumentSlide} from './document-templates.js';
import {connect} from './runtime';
import {articleQuery,decodeArticle} from './storage';
import {DraftSession} from './draft-session';
import {HouseEditor} from './editor';
import {htmlEncode,sanitizeArticle} from '../utils/sanitization';
import {parseMarkdown} from './markdown';
const $=id=>document.getElementById(id), key=row=>`${row.room}\n${row.path}`;
initMenuTabsEvents($('document-menu-tabs'));
let runtime,bridge,rooms=[],articles=[],allDrafts=[],selected=null,session=null,newSession=null,room='',writable=false,blocker='',dataBlocker='',warningKind='',restoring=false,active=true,displayedHTML=null;
let syncStatus={lastCompleted:null,attentionRequired:[]},queryReceived=false,draftsReceived=false,modes={};
const handles=[],sessions=new Map(),saving=new Set();
const editor=new HouseEditor($('article-content'),captureEditor,mode=>{$('edit-article').textContent=mode==='author'?'Read':'Edit';});
editor.onSourceState=renderControls;
editor.onSourceInput=text=>{if(session){displayedHTML=text;session.enqueue({html:text});setMode('source');}};
editor.onSourceApplied=()=>setMode('author');
editor.onSourceClosed=()=>{setMode(editor.mode);if(selected)openArticle(selected);};
$('article-content').addEventListener('submit',event=>event.preventDefault());
$('article-content').addEventListener('input',event=>{
 const node=event.target;if(editor.editorView||editor.markdownNode||!node.matches?.('input,textarea,select')||node.type==='file')return;
 if(node.tagName==='TEXTAREA')node.textContent=node.value;
 else if(node.tagName==='SELECT'){node.setAttribute('data-value',node.value);for(const option of node.options)option.toggleAttribute('selected',option.selected);}
 else{node.setAttribute('value',node.value);if(['checkbox','radio'].includes(node.type))node.toggleAttribute('checked',node.checked);}
 captureEditor();
});
function warning(text='',kind='action'){if(!active)return;warningKind=text?kind:'';$('house-warning').hidden=!text;$('house-warning').textContent=text;}
function sessionFor(row,creation=false){
 const id=key(row);let found=sessions.get(id);
 if(!found){found=new DraftSession(runtime,row,allDrafts.find(d=>key(d)===id)||null,{creation,onError:error=>warning(`Local draft needs attention: ${error.message}`,'draft-error'),onChange:changed=>{if(active&&changed===session&&!changed.pending&&!restoring&&changed.fields.html!==displayedHTML)openArticle(selected);renderControls();}});sessions.set(id,found);}
 return found;
}
function setMode(mode){if(!selected||modes[key(selected)]===mode)return;modes={...modes,[key(selected)]:mode};runtime.presentation.write({editorModes:modes}).catch(error=>warning(`Could not retain editor mode: ${error.message}`));}
function modeFor(row=selected){return row?modes[key(row)]||'social':'social';}
function captureEditor(){
 if(restoring||!session||!selected)return;
 const html=editor.markdownNode?editor.markdownNode.value:editor.html(), root=document.createElement('template'), previous=document.createElement('template');root.innerHTML=html;previous.innerHTML=displayedHTML||'';
 const title=root.content.querySelector('h1')?.textContent?.trim(),oldTitle=previous.content.querySelector('h1')?.textContent?.trim();
 displayedHTML=html;session.enqueue({html,...(title&&title!==oldTitle?{title}:{})});
 setMode(editor.markdownNode?'markdown':editor.mode);
 renderControls();
}
function validArticle(fields){return typeof fields.archived==='boolean'&&['title','html','source_url','source_revision','author','license','license_url'].every(name=>typeof fields[name]==='string');}
function renderControls(){
 if(!active)return;
 const valid=!session||validArticle(session.fields);
 if(!valid)warning('The shared article draft has invalid fields. Its draft and the previous displayed content are preserved. Resolve it in House.','draft-invalid');else if(warningKind==='draft-invalid')warning();
 const allowed=writable&&!blocker&&!dataBlocker&&valid;
 $('new-article').disabled=!allowed;
 editor.setLocked(!allowed);
 for(const id of ['edit-article','archive-article','source-article','add-slide','prev-slide','next-slide'])$(id).disabled=!selected||!allowed;
 $('save-article').disabled=!session||!allowed||saving.has(session)||!session.hasChanges;
 $('export-article').disabled=!selected;
 $('reload-article').disabled=!selected;
 $('archive-article').textContent=session?.fields.archived?'Restore':'Archive';
 $('edit-status').textContent=selected?(editor.mode==='author'?'Edit mode':'Read mode'):'';
}
function rows(){
 const result=new Map(articles.map(row=>[key(row),row]));
 for(const draft of allDrafts){const c=draft.parts?.creation;if(c&&'fields'in c&&c.type==='document_article')result.set(key(draft),{room:draft.room,path:draft.path,markdown:'',fields:c.fields});}
 for(const s of sessions.values())if(s.isCreation)result.set(`${s.room}\n${s.path}`,{room:s.room,path:s.path,markdown:'',fields:s.fields});
 return [...result.values()].map(row=>({...row,fields:sessions.get(key(row))?.fields||row.fields}));
}
function renderList(){
 if(!active)return;
 const query=$('article-search').value.toLowerCase(),show=$('show-archived').checked;
 $('article-list').replaceChildren();
 for(const row of rows().filter(row=>validArticle(row.fields)&&rooms.length===1&&row.room===rooms[0].locator&&(show||!row.fields.archived)&&row.fields.title.toLowerCase().includes(query))){
  const li=document.createElement('li'),button=document.createElement('button');button.type='button';button.textContent=(row.fields.title||'New article')+(row.fields.archived?' (archived)':'');button.setAttribute('aria-current',String(selected&&key(selected)===key(row)));button.addEventListener('click',()=>!row.markdown&&!row.fields.html?openNew(row):openArticle(row));li.append(button);$('article-list').append(li);
 }
}
function closeSource(){editor.sourceState?.aside.remove();editor.sourceState=null;}
function openArticle(row){
 // Navigation is entirely local. Sessions outlive their views and keep writing
 // exact-CAS Room drafts while a different article is already on screen.
 const next=sessionFor(row,!row.markdown);if(!validArticle(next.fields)){warning('The shared article draft has invalid fields. Its draft and previous displayed content are preserved. Resolve it in House.','draft-invalid');renderControls();return;}
 selected=row;room=row.room;session=next;restoring=true;closeSource();editor.load(modeFor(row)==='markdown'?parseMarkdown(session.fields.html):session.fields.html);displayedHTML=session.fields.html;
 if(modeFor(row)==='author'||modeFor(row)==='markdown')editor.edit();
 if(modeFor(row)==='markdown')editor.restoreMarkdown(session.fields.html);
 restoring=false;updateReach();document.title=`${session.fields.title} · Document editor`;bridge?.setTab({title:session.fields.title});
 $('article-provenance').textContent=[row.fields.author,row.fields.license,row.fields.source_url?`Adapted from ${row.fields.source_url} at ${row.fields.source_revision}`:''].filter(Boolean).join(' · ');
 if(session.draft?.returned)warning('A save was returned. The local draft and original conflict information are preserved. Resolve the conflict in House before committing again.','sync-error');
 else if(warningKind==='draft-error'&&!session.error)warning();
 if(modeFor(row)==='source')showSource(editor,{value:session.fields.html,base:editor.html()});
 renderList();renderControls();if(matchMedia('(max-width:768px)').matches)setMenu(false);
}
function setMenu(open){$('house-panel').hidden=!open;document.body.classList.toggle('menu-closed',!open);$('document-menu').classList.toggle('on',open);$('menu-toggle').setAttribute('aria-expanded',String(open));}
function updateReach(){
 if(!selected&&rooms.length===1)room=rooms[0].locator;
 const current=rooms.length===1?rooms.find(row=>row.locator===room):null,completed=syncStatus.lastCompleted!==null;
 writable=completed&&!!current&&current.replica.admission==='admitted'&&!current.refusal&&current.operations.write.length>0;
 const message=completed&&rooms.length!==1?'The article collection binding is missing or ambiguous. Resolve the App binding in House; local drafts are kept.':completed&&selected&&!current?'Access to the opened collection changed. Local drafts and open content are kept. Select an available article to continue.':'';
 if(message&&(!warningKind||warningKind==='binding'))warning(message,'binding');else if(!message&&warningKind==='binding')warning();
 renderControls();renderList();
}
function reconcileArticle(){
 if(syncStatus.lastCompleted===null||rooms.length!==1){if(!selected)$('article-content').textContent=syncStatus.lastCompleted===null?'Loading articles…':'';return;}
 if(!queryReceived||!draftsReceived||dataBlocker)return;
 const fresh=articles.find(row=>row.room===room&&row.path===selected?.path);
 if(fresh&&session&&!session.hasChanges&&!session.pending&&!saving.has(session)&&!editor.sourceState&&(fresh.fields.html!==selected.fields.html||fresh.fields.title!==selected.fields.title||fresh.fields.archived!==selected.fields.archived)){
  sessions.delete(key(fresh));openArticle(fresh);
 }else if(!selected){const first=rows().find(row=>row.room===room&&!row.fields.archived&&(row.markdown||row.fields.html));if(first)openArticle(first);else $('article-content').textContent='This collection has no articles yet.';}
 renderControls();
}
function refreshRooms(value){rooms=value;updateReach();reconcileArticle();}
function refreshSync(value){syncStatus=value;if(value.attentionRequired.length)warning('A save was returned and needs attention. Your local drafts have been kept.','sync-error');else if(warningKind==='sync-error')warning();updateReach();reconcileArticle();}
function acceptQuery(result){try{articles=result.documents.map(decodeArticle);dataBlocker='';queryReceived=true;}catch(error){dataBlocker=error.message;warning(dataBlocker);renderControls();return;}renderList();reconcileArticle();renderControls();}
function acceptDrafts(value){allDrafts=value;draftsReceived=true;for(const s of sessions.values())s.observe(value.find(d=>d.room===s.room&&d.path===s.path)||null);renderList();reconcileArticle();renderControls();}
async function commit(s){
 if(!s||!s.path.startsWith('articles/')||saving.has(s)||!writable||blocker||dataBlocker)return;
 saving.add(s);renderControls();try{if(s===session){const html=sanitizeArticle(editor.markdownNode?parseMarkdown(editor.markdownNode.value):s.fields.html),node=document.createElement('template'),before=document.createElement('template');node.innerHTML=html;before.innerHTML=selected.fields.html;const title=node.content.querySelector('h1')?.textContent?.trim(),oldTitle=before.content.querySelector('h1')?.textContent?.trim();s.enqueue({html,...(title&&title!==oldTitle?{title}:{})});if(editor.markdownNode)setMode('author');}const result=await s.save();if(active&&result?.outcome==='saved')$('house-status').textContent='Save queued';}
 catch(error){warning(error.message,'draft-error');}finally{saving.delete(s);renderControls();renderList();}
}
$('source-article').addEventListener('click',()=>{setMode('source');showSource(editor,{value:session.fields.html,base:editor.html()});});
$('theme-toggle').addEventListener('change',event=>{const theme=event.target.value;if(theme==='auto')delete document.documentElement.dataset.theme;else if(['dark','light'].includes(theme))document.documentElement.dataset.theme=theme;});
$('add-slide').addEventListener('click',()=>{if(editor.mode!=='author')editor.edit();addDocumentSlide(editor);captureEditor();});
$('prev-slide').addEventListener('click',()=>selectDocumentSlide(editor,-1));$('next-slide').addEventListener('click',()=>selectDocumentSlide(editor,1));
for(const template of DOCUMENT_TEMPLATES){const option=document.createElement('option');option.value=template.value||template.id||template.type;option.textContent=template.label||template.title;$('new-template').append(option);}
$('menu-toggle').addEventListener('click',()=>setMenu($('house-panel').hidden));$('article-search').addEventListener('input',renderList);$('show-archived').addEventListener('change',renderList);
$('edit-article').addEventListener('click',()=>{editor.toggleEditor(editor.mode==='author'?'social':'author');setMode(editor.mode);});
$('save-article').addEventListener('click',()=>commit(session));
// Reload is a local view refresh, never a network request or draft discard.
$('reload-article').addEventListener('click',()=>{if(selected)openArticle(selected);});
$('archive-article').addEventListener('click',()=>{if(session){session.enqueue({archived:!session.fields.archived});renderList();commit(session);}});
$('export-article').addEventListener('click',()=>{const title=typeof session?.fields.title==='string'?session.fields.title:selected.fields.title,html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${htmlEncode(title)}</title></head><body><main><article>${editor.html()}</article></main></body></html>`;const url=URL.createObjectURL(new Blob([html],{type:'text/html'})),link=document.createElement('a');link.href=url;link.download=`${title.replace(/[^a-zA-Z0-9_-]/g,'-')||'article'}.html`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
function openNew(row){
 const existing=row||rows().find(row=>row.room===room&&!row.markdown&&!row.fields.html);
 const initial=existing||{room,path:`articles/article-${crypto.randomUUID()}.md`,fields:{title:'',html:'',archived:false,source_url:'',source_revision:'',author:'',license:'',license_url:''}};
 newSession=sessionFor(initial,true);if(!existing)newSession.enqueue({});
 $('new-title').value=newSession.fields.title;$('new-dialog').showModal();$('new-title').focus();
}
$('new-article').addEventListener('click',()=>openNew());$('cancel-new').addEventListener('click',()=>$('new-dialog').close());
function captureNew(){newSession?.enqueue({title:$('new-title').value});}
$('new-title').addEventListener('input',captureNew);$('new-template').addEventListener('change',captureNew);
$('new-form').addEventListener('submit',event=>{event.preventDefault();const title=$('new-title').value.trim();if(!title||!newSession)return;const content=createDocumentTemplate($('new-template').value,{title});newSession.enqueue({title,html:content.html||content});modes={...modes,[`${newSession.room}\n${newSession.path}`]:'author'};const s=newSession;$('new-dialog').close();newSession=null;openArticle({room:s.room,path:s.path,markdown:'',fields:s.fields});commit(s);});
// Half-typed popup controls remain donor UI state and may be lost on reload.
async function watch(promise,fn){const obs=await promise;handles.push(obs);fn(obs.current());obs.subscribe(fn);}
async function start(){try{
 ({runtime,bridge}=await connect());const presentation=await runtime.presentation.read();if(presentation&&typeof presentation==='object'&&presentation.editorModes&&typeof presentation.editorModes==='object')modes=presentation.editorModes;await watch(runtime.observe('rooms'),refreshRooms);await watch(runtime.observe('room-drafts'),acceptDrafts);await watch(runtime.observe('query',articleQuery),acceptQuery);await watch(runtime.observe('sync-status'),refreshSync);
 // A Provider write halt delays delivery, not local Room drafting or Save.
 // This App exposes no immediate remote Actions; access/refusal guards remain.
 await watch(runtime.observe('service-mode'),renderControls);
 await watch(runtime.observe('storage-loss'),value=>{if(value){blocker=`House reported storage loss: ${value}`;warning(blocker);renderControls();}});
 await watch(runtime.observe('connection-refusal'),value=>{if(value){blocker=`House connection refused: ${value.reason}. Reopen after resolving access.`;warning(blocker);renderControls();}});
 if(!(await runtime.persistence()))warning('House reports non-durable browser storage. Export important local drafts before closing.');
}catch(error){blocker=error.message;warning(`Could not load House: ${blocker}`);renderControls();}}
window.addEventListener('pagehide',()=>{active=false;handles.forEach(handle=>handle.close());editor.dispose();});
start();
