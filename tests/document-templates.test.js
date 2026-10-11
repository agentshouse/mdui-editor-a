import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DOMParser, DOMSerializer } from 'prosemirror-model';
import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { schema } from '../src/editor/schema/base.js';
import Config from '../src/config.js';
import { HouseEditor } from '../src/house/editor.js';
import { AuthorToolbar } from '../src/editor/toolbar/author/author.js';
import { InputView } from '../src/editor/nodeviews/input.js';
import { SelectView } from '../src/editor/nodeviews/select.js';
import { TextareaView } from '../src/editor/nodeviews/textarea.js';
import { createDocumentTemplate, DOCUMENT_TEMPLATES, documentTemplatePlugins, prepareDocumentTemplateForEdit, serializeDocumentTemplate, installDocumentTemplateMethods, refreshDocumentTemplateView, addDocumentSlide, selectDocumentSlide } from '../src/house/document-templates.js';
import { addSection, getSectionsTemplate, addSubsection } from '../src/ui/templates/sections.js';
import { questionHTML, insertQuestion, getQuestionnaires, collectAnswers } from '../src/ui/templates/questionnaire.js';
import { convertQuestion } from '../src/editor/plugins/questionnaireTools.js';
import { getActiveSlideIndex } from '../src/editor/plugins/slideshowDecorations.js';
let editor;
function mount(type) {
  const root = document.querySelector('article');
  root.innerHTML = createDocumentTemplate(type, { title: 'Local document' });
  prepareDocumentTemplateForEdit(root);
  const doc = DOMParser.fromSchema(schema).parse(root);
  root.replaceChildren();
  editor = { node: root, mode: 'author', locked: false };
  Config.Editor = editor;
  editor.editorView = new EditorView(root, {
    state: EditorState.create({ doc, plugins: documentTemplatePlugins() }),
    nodeViews: { input: (n,v,p)=>new InputView(n,v,p), select: (n,v,p)=>new SelectView(n,v,p), textarea: (n,v,p)=>new TextareaView(n,v,p) },
  });
  editor.authorToolbarView = Object.create(AuthorToolbar.prototype);
  editor.authorToolbarView.editorView = editor.editorView;
  installDocumentTemplateMethods(editor);
  refreshDocumentTemplateView();
  return editor;
}
function html() {
  const root = document.createElement('div');
  root.append(DOMSerializer.fromSchema(schema).serializeFragment(editor.editorView.state.doc.content));
  return root.innerHTML;
}
beforeEach(()=>{
  document.body.innerHTML = '<div id="host"><main><article></article></main></div>';
  window.matchMedia = ()=>({matches:false,addEventListener(){},removeEventListener(){}});
  Range.prototype.getBoundingClientRect = ()=>({top:0,bottom:0,left:0,right:0,width:0,height:0});
  Range.prototype.getClientRects = ()=>[];
  if (!globalThis.CSS) globalThis.CSS = {};
  CSS.escape ||= value=>String(value).replace(/[^\w-]/g, '\\$&');
});
afterEach(()=>{editor?.editorView.destroy();editor=null;Config.Editor={};vi.restoreAllMocks();});
describe('local donor document templates',()=>{
  it.each(DOCUMENT_TEMPLATES)('creates the actual $label template without changing the host or inventing people',({id})=>{
    const html = createDocumentTemplate(id,{title:'A <safe> title'});
    expect(html).toContain('A &lt;safe&gt; title');
    expect(document.querySelector('#host')).toBeTruthy();
    expect(html).not.toMatch(/Your Name|you@example|example\.org\/profile|<script| action=|formaction=/);
  });
  it('round-trips every template through the integrated HouseEditor and repeated mode changes',()=>{
    const host=new HouseEditor(document.querySelector('article'),vi.fn());
    try {
      for(const {id} of DOCUMENT_TEMPLATES) {
        host.load(createDocumentTemplate(id,{title:`Roundtrip ${id}`}));
        for(let n=0;n<2;n++) {
          host.toggleEditor('author');
          expect(host.editorView.state.doc.textContent).toContain(`Roundtrip ${id}`);
          expect(document.querySelectorAll('#document-editor')).toHaveLength(1);
          expect(host.html()).toContain(`Roundtrip ${id}`);
          host.toggleEditor('social');
          expect(document.querySelectorAll('#document-editor')).toHaveLength(0);
        }
      }
    } finally {host.dispose();}
  });
  it('mounts every donor template plugin and serializes each type',()=>{
    for(const {id} of DOCUMENT_TEMPLATES) {
      mount(id);
      expect(editor.editorView.state.doc.textContent).toContain('Local document');
      expect(()=>serializeDocumentTemplate(html())).not.toThrow();
      editor.editorView.destroy();
      document.querySelector('article').replaceChildren();
      editor=null;
    }
  });
  it('uses donor specification section and conformance subsection commands',()=>{
    mount('specification');
    const config = getSectionsTemplate('specification');
    addSection(config, editor.node, 'conformance');
    expect(html()).toContain('id="conformance"');
    addSubsection(config, editor.node, 'conformance', 'subdivisions');
    expect(html()).toContain('id="subdivisions"');
    expect(document.querySelector('nav .section-add')).toBeTruthy();
    const saved = serializeDocumentTemplate(html());
    expect(saved).toContain('doap#Specification');
    expect(saved).not.toContain('data-select="document-type"');
  });
  it('persists document type choices from the donor native select view',()=>{
    mount('specification');
    const select=editor.node.querySelector('select[data-select="document-type"]');
    select.value='http://schema.org/Article';
    select.dispatchEvent(new Event('change',{bubbles:true}));
    expect(serializeDocumentTemplate(html())).toContain('href="http://schema.org/Article"');
    expect(serializeDocumentTemplate(html())).not.toContain('href="http://usefulinc.com/ns/doap#Specification"');
  });
  it('sanitizes values restored by template parse transforms',()=>{
    const root=document.querySelector('article');
    root.innerHTML='<details><summary>Details</summary><dl id="document-type"><dt>Type</dt><dd><a rel="rdf:type" href="https://example.test/&quot; onclick=&quot;alert(1)">An &lt;img src=x onerror=alert(1)&gt;</a></dd></dl></details>';
    prepareDocumentTemplateForEdit(root);
    expect(root.querySelector('[onclick], [onerror]')).toBeNull();
    expect(root.querySelector('img')).toBeNull();
    expect(root.querySelector('option').textContent).toContain('<img');
  });
  it('adds an actual CV section while leaving author identity blank',()=>{
    mount('cv');
    addSection(getSectionsTemplate('cv'),editor.node,'awards');
    expect(html()).toContain('data-cv-section="awards"');
    expect(html()).not.toContain('Your Name');
  });
  it('adds and selects slides through the donor toolbar transactions',()=>{
    mount('slideshow');
    addDocumentSlide(editor,'normal');
    expect(editor.node.querySelectorAll('section.slide')).toHaveLength(2);
    expect(selectDocumentSlide(editor,1)).toBe(1);
    expect(getActiveSlideIndex(editor.editorView)).toBe(1);
    editor.locked=true;
    expect(addDocumentSlide(editor,'normal')).toBe(false);
    expect(editor.node.querySelectorAll('section.slide')).toHaveLength(2);
  });
  it('inserts and changes questionnaire kinds with donor widgets, without external transport',()=>{
    mount('questionnaire');
    insertQuestion(editor.editorView,questionHTML({kind:'short-text',text:'Local prompt'}));
    expect(html()).toContain('Local prompt');
    let pos;
    editor.editorView.state.doc.descendants((node, at)=>{if(node.type.name==='dl'&&node.attrs.originalAttributes?.typeof==='as:Question'&&pos===undefined)pos=at;});
    const tr=convertQuestion(editor.editorView.state,pos,'multiple');
    if(tr)editor.editorView.dispatch(tr);
    expect(html()).toContain('as:anyOf');
    expect(editor.node.querySelector('.questionnaire-add')).toBeTruthy();
    expect(editor.node.querySelector('.questionnaire-inbox-tools')).toBeNull();
    expect(serializeDocumentTemplate(html())).not.toMatch(/ action=|method="post"|type="submit"/);
  });
  it('prevents native questionnaire submission and validates local answers',()=>{
    const root=document.querySelector('article');
    root.innerHTML=createDocumentTemplate('questionnaire');
    Config.Editor={mode:'social'};
    refreshDocumentTemplateView();
    const form=root.querySelector('form');
    const event=new Event('submit',{bubbles:true,cancelable:true});
    expect(form.dispatchEvent(event)).toBe(false);
    expect(root.querySelector('.questionnaire-submit')).toBeNull();
    expect(collectAnswers(getQuestionnaires(root)[0]).answers).toEqual([]);
  });
});
