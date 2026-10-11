/** Adapted from dokieli dialog.js viewSource. Only the current article is editable, never the App shell. */
import {getButtonHTML} from '../ui/buttons.js';
import {fragmentFromString} from '../utils/html.js';
import {sanitizeArticle} from '../utils/sanitization.js';
export function showSource(editor, saved={}) {
 if(editor.locked||document.getElementById('source-view'))return;
 const aside=fragmentFromString(`<aside aria-labelledby="source-view-label" class="do on" id="source-view"><h2 id="source-view-label">Source</h2>${getButtonHTML({button:'close',buttonClass:'close'})}<p>Edit this article's HTML. Raw HTML is kept in this article's local draft as you type. Scripts and external resources are omitted from previews and removed on Save. Apply updates the preview; closing keeps the draft.</p><textarea dir="ltr" id="source-edit" rows="24" cols="80" aria-label="Article HTML source"></textarea><p><button class="update" type="button">Apply</button><button class="cancel" type="button">Cancel</button></p></aside>`).firstElementChild;
 const snapshot=Object.hasOwn(saved,'value')?saved.base:editor.html(), stamp=editor.loadRevision;const state={aside,dirty:false,snapshot};editor.sourceState=state;
 aside.querySelector('textarea').value=Object.hasOwn(saved,'value')?saved.value:snapshot;
 aside.querySelector('textarea').addEventListener('input',()=>{state.dirty=true;editor.onSourceInput?.(aside.querySelector('textarea').value);});
 const close=()=>{editor.sourceState=null;aside.remove();editor.onSourceState?.();editor.onSourceClosed?.();};
 editor.onSourceState?.();
 aside.addEventListener('click',event=>{
  if(event.target.closest('.close,.cancel')){close();return;}
  if(!event.target.closest('.update')||editor.locked)return;
  if(editor.loadRevision!==stamp||editor.html()!==snapshot){let message=aside.querySelector('[role="alert"]');if(!message){message=document.createElement('p');message.setAttribute('role','alert');aside.prepend(message);}message.textContent='The article changed after Source was opened. These source edits were not applied. Copy them before closing, then reopen Source for the current article.';return;}
  const input=sanitizeArticle(aside.querySelector('textarea').value);const parsed=new DOMParser().parseFromString(input,'text/html');const article=parsed.querySelector('article');const html=sanitizeArticle(article?article.innerHTML:parsed.body.innerHTML);const wasAuthor=editor.mode==='author';close();editor.onSourceApplied?.();editor.load(html);if(wasAuthor)editor.edit();
 });
 document.body.append(aside);aside.querySelector('textarea').focus();
}
