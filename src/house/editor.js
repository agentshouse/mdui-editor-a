/** Adaptation of dokieli Editor.createEditor: original schema, author toolbar, article layout and formatting commands. Yjs and social backends removed. */
import { EditorView } from 'prosemirror-view';
import { DOMParser, DOMSerializer } from 'prosemirror-model';
import { EditorState, Plugin } from 'prosemirror-state';
import { baseKeymap } from 'prosemirror-commands';
import { history, undo, redo } from 'prosemirror-history';
import { keymapPlugin } from '../editor/toolbar/author/keymap.js';
import { tableToolsPlugin } from '../editor/plugins/tableTools.js';
import { fragmentLinksPlugin } from '../editor/plugins/fragmentLinks.js';
import { parseMarkdown, htmlToMarkdown } from './markdown.js';
import { documentTemplatePlugins, installDocumentTemplateMethods, prepareDocumentTemplateForEdit, refreshDocumentTemplateView, serializeDocumentTemplate } from './document-templates.js';
import { SlashMenu } from '../editor/slashmenu/slashmenu.js';
import {documentAnchorsPlugin} from '../editor/plugins/documentAnchors.js';
import {refreshDocumentAnchors} from '../ui/anchors.js';
import { keymap } from 'prosemirror-keymap';
import { schema } from '../editor/schema/base.js';
import {getLanguageOptionsHTML,getLicenseOptionsHTML} from './local-metadata.js';
import {formFooterHTML,advancedFieldsHTML} from '../editor/toolbar/toolbar.js';
import { AuthorToolbar } from '../editor/toolbar/author/author.js';
import { ImageResizeView } from '../editor/nodeviews/imageResize.js';
import { InputView } from '../editor/nodeviews/input.js';
import { SelectView } from '../editor/nodeviews/select.js';
import { TextareaView } from '../editor/nodeviews/textarea.js';
import { DetailsView } from '../editor/nodeviews/details.js';
import { placeholderPlugin } from '../editor/plugins/placeholder.js';
import { autoIdPlugin } from '../editor/plugins/autoId.js';
import Config from '../config.js';
import { sanitizeArticle } from '../utils/sanitization.js';
const buttons = ['strong','em','a','img','p','h1','h2','h3','h4','ol','ul','pre','code','align-left','align-center','align-right','blockquote','q','semantics','lang','note','citation','requirement'];
class HouseAuthorToolbar extends AuthorToolbar {
  getSubmenuButtons() { return super.getSubmenuButtons().filter(b => buttons.includes(b)); }
  getToolbarPopups() {
    const popups=super.getToolbarPopups();
    // Retain donor fields and footnote structure; remote lookup/distribution is intentionally absent.
    popups.note=options=>`<fieldset><legend>${options.legend}</legend><label for="note-content">Note</label><textarea class="editor-form-textarea" id="note-content" name="note-content" rows="5" required></textarea>${advancedFieldsHTML(`<label for="note-tagging">Tags</label><input class="editor-form-input" id="note-tagging" name="note-tagging"><label for="note-language">Language</label><select id="note-language" name="note-language">${getLanguageOptionsHTML({selected:''})}</select><label for="note-license">License</label><select id="note-license" name="note-license">${getLicenseOptionsHTML({selected:''})}</select>`)}${formFooterHTML({action:'save'})}</fieldset>`;
    const citation=popups.citation;
    popups.citation=options=>{const template=document.createElement('template');template.innerHTML=citation(options);template.content.querySelectorAll('[for="citation-specref-search"],#citation-specref-search,.editor-form-search-row,.editor-form-sources,.specref-search-results,#ref-reference,[for="ref-reference"]').forEach(node=>node.remove());template.content.querySelector('#ref-footnote').checked=true;template.content.querySelector('.info').textContent='Local footnote only. External citation lookup and notifications are unavailable.';return template.innerHTML;};
    return popups;
  }
  populateFormCitation(_button,node) { node.querySelector('#ref-footnote').checked=true;node.querySelector('#citation-url').focus(); }


}
export class HouseEditor {
 constructor(node, onChange, onMode) { this.node = node; this.onChange = onChange; this.onMode = onMode; this.mode = 'social'; Config.Editor = this;this.markdownListener=event=>this.toggleMarkdown(event.detail.markdown);window.addEventListener('house:markdown-mode',this.markdownListener);installDocumentTemplateMethods(this); }
 load(html) { this.loadRevision=(this.loadRevision||0)+1;this.destroy(); this.node.innerHTML = sanitizeArticle(html); this.mode = 'social'; this.onMode?.(this.mode);Config.DocumentURL=window.location.href;refreshDocumentTemplateView();refreshDocumentAnchors(); }
 toggleEditor(mode) {
   if(this.markdownNode)this.toggleMarkdown(false);
   if (mode === 'author' && !this.editorView) this.edit();
   else if (mode !== 'author' && this.editorView) { const html = this.html(); this.destroy(); this.node.innerHTML = html; this.mode = 'social'; this.onMode?.(this.mode);Config.DocumentURL=window.location.href;refreshDocumentTemplateView();refreshDocumentAnchors(); }
 }
 edit() {
   prepareDocumentTemplateForEdit(this.node);
   const doc = DOMParser.fromSchema(schema).parse(this.node);
   this.node.replaceChildren(); this.mode = 'author';
   const owner = this;
   const toolbar = new Plugin({ view(view) { const bar = new HouseAuthorToolbar('author', buttons, view); owner.authorToolbarView = bar; return bar; } });
   this.editorView = new EditorView(this.node, {
     editable:()=>!this.locked,
     state: EditorState.create({ doc, plugins: [history(), ...documentTemplatePlugins(), documentAnchorsPlugin, keymapPlugin, fragmentLinksPlugin, tableToolsPlugin(), keymap({'Mod-z':undo,'Mod-y':redo,'Shift-Mod-z':redo}), keymap(baseKeymap), placeholderPlugin, autoIdPlugin, toolbar] }),
     attributes: { dir:'auto', 'aria-label':'Article editor' },
     transformPastedHTML: sanitizeArticle,
     nodeViews: { img(node,view,getPos){return new ImageResizeView(node,view,getPos);}, input(node,view,getPos){return new InputView(node,view,getPos);}, select(node,view,getPos){return new SelectView(node,view,getPos);}, textarea(node,view,getPos){return new TextareaView(node,view,getPos);}, details(node) { return new DetailsView(node); } },
     dispatchTransaction(tr) { if(owner.locked&&tr.docChanged)return;const next = this.state.apply(tr); this.updateState(next); if (tr.docChanged) owner.onChange?.(); }
   });
   this.slashMenu=new SlashMenu(this.editorView);
   this.onMode?.(this.mode);refreshDocumentTemplateView();refreshDocumentAnchors(); this.editorView.focus();
 }
 toggleMarkdown(enabled, restoring=false) {
   if(this.locked)return;
   if(enabled && !this.markdownNode){
     if(!restoring&&!window.confirm('Switch to Markdown? Editing Markdown can lose document structure, attributes and formatting. Cancel to keep using the rich editor.'))return;
     const html=this.html(), root=document.createElement('div');root.innerHTML=html;
     const toggle=document.getElementById('editor-area-toggle');
     this.editorView?.destroy();this.editorView=null;this.authorToolbarView=null;this.slashMenu?.destroy();
     this.node.replaceChildren();this.markdownNode=document.createElement('textarea');this.markdownNode.className='house-markdown';this.markdownNode.setAttribute('aria-label','Markdown editor');this.markdownOriginalHTML=html;this.markdownOriginalText=htmlToMarkdown(root);this.markdownNode.value=this.markdownOriginalText;this.markdownNode.addEventListener('input',()=>this.onChange?.());this.node.append(this.markdownNode);if(toggle&&!toggle.isConnected)document.body.append(toggle);
     toggle?.querySelectorAll('button').forEach(button=>{const active=button.classList.contains('mode-markdown');button.disabled=active;button.setAttribute('aria-pressed',String(active));});
   }else if(!enabled && this.markdownNode){const html=this.html();if(html!==this.markdownOriginalHTML)this.onChange?.();this.markdownNode=null;this.node.innerHTML=html;document.getElementById('editor-area-toggle')?.remove();this.edit();if(html!==this.markdownOriginalHTML)this.onChange?.();}
 }
 restoreMarkdown(text) { this.toggleMarkdown(true,true);if(this.markdownNode)this.markdownNode.value=text||''; }
 setLocked(locked) { this.locked=locked;this.node.inert=locked;document.querySelectorAll('#editor-table-tools,.editor-table-panel,.editor-table-suggestions,#document-slashmenu,#editor-area-toggle,#source-view').forEach(node=>node.inert=locked);if(this.markdownNode)this.markdownNode.disabled=locked;this.editorView?.setProps({editable:()=>!this.locked});if(this.authorToolbarView)this.authorToolbarView.dom.inert=locked; }
 html() { if(this.markdownNode)return this.markdownNode.value===this.markdownOriginalText?this.markdownOriginalHTML:sanitizeArticle(parseMarkdown(this.markdownNode.value));if (!this.editorView) return sanitizeArticle(this.node.innerHTML); const container = document.createElement('div'); container.append(DOMSerializer.fromSchema(schema).serializeFragment(this.editorView.state.doc.content)); return sanitizeArticle(serializeDocumentTemplate(container.innerHTML)); }
 dispose() {this.sourceState?.aside.remove();this.sourceState=null;this.destroy();window.removeEventListener('house:markdown-mode',this.markdownListener);}
 destroy() { this.slashMenu?.destroy();this.markdownNode=null;document.getElementById('editor-area-toggle')?.remove();this.editorView?.destroy(); this.editorView = null; this.authorToolbarView = null; document.getElementById('document-editor')?.remove(); }
}
